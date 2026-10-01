import type {
  ClassificadorDeComentarios,
  EstadoDoComentario,
  RespostasDoComentario,
} from '../../integrations/jev/classificador-comentarios.js';
import { ErroTemporarioDeTrabalho, type Trabalho } from '../../jobs/trabalhos.tipos.js';
import type { TrabalhosServico } from '../../jobs/trabalhos.servico.js';
import {
  ErroDeValidacao,
  ErroLimiteDeCustoAtingido,
  nomeSeguroDoErro,
} from '../../shared/errors.js';
import type { ComentarioId, ContaId, ProjetoId, UsuarioId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import type {
  ControleDeCusto,
  EstimativaDoPlano,
  RequisicaoDeIa,
  RespostaDeIa,
  ReservaAtiva,
} from '../usage/controle-custo.servico.js';
import type {
  ClassificacoesRepositorio,
  ResumoDaClassificacao,
} from './classificacoes.repositorio.js';
import {
  MAX_CARACTERES_COMENTARIO,
  NIVEL_MAXIMO_DE_GRAVIDADE,
  montarEstado,
  posProcessar,
  type ComentarioParaClassificar,
} from './pos-processamento.js';
import { estimarMinutos } from './estimativa-de-tempo.js';
import { perguntasDoComentario } from './questions.js';
import type { RevisoesRepositorio } from './revisoes.repositorio.js';

export const MAX_TENTATIVAS_CLASSIFICACAO = 3;
export const TAMANHO_LOTE_CLASSIFICACAO = 50;
// Um lote inteiro sem nenhum sucesso, a partir deste tamanho, aponta o serviço fora do ar e não os comentários.
const MENOR_LOTE_QUE_INDICA_QUEDA = 5;
// Perguntas e envelope da requisição, contados na estimativa de cada comentário.
const CARACTERES_DAS_PERGUNTAS = JSON.stringify(perguntasDoComentario).length;
const CARACTERES_DO_ENVELOPE_DO_ESTADO = 60;

export { NIVEL_MAXIMO_DE_GRAVIDADE };

export interface EstimativaDaClassificacao extends EstimativaDoPlano {
  pendentes: number;
  minutosEstimados: number;
}

export interface ProgressoDaClassificacao extends ResumoDaClassificacao {
  trabalho: { id: string; status: string } | undefined;
}

export interface ResultadoDoInicio {
  trabalho: Trabalho;
  jaExistia: boolean;
}

export interface AcompanhamentoDaClassificacao {
  sinal?: AbortSignal | undefined;
  aoProgredir: (total: number, feito: number) => Promise<void>;
}

export interface ClassificacaoServico {
  estimar(contaId: ContaId, projetoId: ProjetoId): Promise<EstimativaDaClassificacao>;
  iniciar(contaId: ContaId, usuarioId: UsuarioId, projetoId: ProjetoId): Promise<ResultadoDoInicio>;
  reprocessarFalhas(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
  ): Promise<ResultadoDoInicio>;
  progresso(contaId: ContaId, projetoId: ProjetoId): Promise<ProgressoDaClassificacao>;
  corrigir(
    contaId: ContaId,
    usuarioId: UsuarioId,
    comentarioId: ComentarioId,
    tema: string,
    sentimento: string,
  ): Promise<void>;
  classificarPendentes(
    contaId: ContaId,
    projetoId: ProjetoId,
    acompanhamento: AcompanhamentoDaClassificacao,
  ): Promise<void>;
}

export interface DependenciasDaClassificacao {
  classificacoes: ClassificacoesRepositorio;
  revisoes: RevisoesRepositorio;
  projetos: ProjetosServico;
  trabalhos: TrabalhosServico;
  controleDeCusto: ControleDeCusto;
  classificador: ClassificadorDeComentarios;
  registrador: Registrador;
  concorrencia: number;
}

function totalClassificavel(resumo: ResumoDaClassificacao): number {
  return resumo.pendentes + resumo.classificados + resumo.falhos;
}

// A estimativa usa o state exato que será enviado, mais as perguntas, que vão em toda requisição.
function requisicaoDe(
  comentario: ComentarioParaClassificar,
  estado: EstadoDoComentario,
): RequisicaoDeIa {
  return {
    provedor: 'jev',
    operacao: 'classify',
    caracteresEntrada: JSON.stringify(estado).length + CARACTERES_DAS_PERGUNTAS,
    comentarioRef: comentario.id,
  };
}

class ClassificacaoServicoImpl implements ClassificacaoServico {
  constructor(private readonly dep: DependenciasDaClassificacao) {}

  async estimar(contaId: ContaId, projetoId: ProjetoId): Promise<EstimativaDaClassificacao> {
    await this.dep.projetos.obter(contaId, projetoId);
    const tamanhos = await this.dep.classificacoes.tamanhosDosPendentes(
      contaId,
      projetoId,
      MAX_CARACTERES_COMENTARIO,
    );
    const estimativa = await this.dep.controleDeCusto.estimarConsumoDoPlano(
      contaId,
      tamanhos.map((caracteres) => ({
        provedor: 'jev' as const,
        caracteresEntrada: caracteres + CARACTERES_DAS_PERGUNTAS + CARACTERES_DO_ENVELOPE_DO_ESTADO,
      })),
    );
    return {
      ...estimativa,
      pendentes: tamanhos.length,
      minutosEstimados: estimarMinutos(tamanhos.length, this.dep.concorrencia),
    };
  }

  async iniciar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
  ): Promise<ResultadoDoInicio> {
    await this.dep.projetos.obter(contaId, projetoId);
    const { pendentes } = await this.dep.classificacoes.resumo(contaId, projetoId);
    if (pendentes === 0) {
      throw new ErroDeValidacao('Não há comentários para classificar.', 'nada_para_classificar');
    }
    return this.dep.trabalhos.criar(contaId, { tipo: 'classify', projetoId, criadoPor: usuarioId });
  }

  async reprocessarFalhas(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
  ): Promise<ResultadoDoInicio> {
    await this.dep.projetos.obter(contaId, projetoId);
    await this.dep.classificacoes.reprocessarFalhas(contaId, projetoId);
    return this.iniciar(contaId, usuarioId, projetoId);
  }

  async progresso(contaId: ContaId, projetoId: ProjetoId): Promise<ProgressoDaClassificacao> {
    await this.dep.projetos.obter(contaId, projetoId);
    const resumo = await this.dep.classificacoes.resumo(contaId, projetoId);
    const ativos = await this.dep.trabalhos.listarAtivosDoTipo(contaId, 'classify');
    const ativo = ativos.find((trabalho) => trabalho.projetoId === projetoId);
    return { ...resumo, trabalho: ativo && { id: ativo.id, status: ativo.status } };
  }

  async corrigir(
    contaId: ContaId,
    usuarioId: UsuarioId,
    comentarioId: ComentarioId,
    tema: string,
    sentimento: string,
  ): Promise<void> {
    await this.dep.revisoes.gravar(contaId, comentarioId, tema, sentimento, usuarioId);
  }

  async classificarPendentes(
    contaId: ContaId,
    projetoId: ProjetoId,
    acompanhamento: AcompanhamentoDaClassificacao,
  ): Promise<void> {
    const total = totalClassificavel(await this.dep.classificacoes.resumo(contaId, projetoId));
    for (;;) {
      if (acompanhamento.sinal?.aborted === true) {
        throw new Error('classificacao_interrompida');
      }
      const lote = await this.dep.classificacoes.proximosPendentes(
        contaId,
        projetoId,
        TAMANHO_LOTE_CLASSIFICACAO,
      );
      if (lote.length === 0) {
        return;
      }
      await this.processarLote(contaId, lote, acompanhamento.sinal);
      const { pendentes } = await this.dep.classificacoes.resumo(contaId, projetoId);
      await acompanhamento.aoProgredir(total, Math.max(0, total - pendentes));
    }
  }

  private async processarLote(
    contaId: ContaId,
    lote: ComentarioParaClassificar[],
    sinal: AbortSignal | undefined,
  ): Promise<void> {
    const estados = lote.map(montarEstado);
    const { resultados, naoReservados } = await this.dep.controleDeCusto.executarEmLoteComReserva(
      contaId,
      lote.map((comentario, i) =>
        requisicaoDe(comentario, estados[i]?.estado ?? montarEstado(comentario).estado),
      ),
      (reserva, indice) => this.chamarJev(estados[indice]?.estado, reserva, sinal),
      { concorrencia: this.dep.concorrencia },
    );
    const sucessos = resultados.flatMap((r, i) => (r?.ok === true ? [i] : []));
    const falhas = resultados.flatMap((r, i) => (r?.ok === false ? [i] : []));
    if (sucessos.length === 0 && falhas.length >= MENOR_LOTE_QUE_INDICA_QUEDA) {
      throw new ErroTemporarioDeTrabalho('jev_indisponivel');
    }
    for (const i of sucessos) {
      await this.gravarSucesso(contaId, lote[i], estados[i]?.truncado === true, resultados[i]);
    }
    for (const i of falhas) {
      await this.gravarFalha(contaId, lote[i], resultados[i]);
    }
    if (naoReservados.length > 0) {
      throw new ErroLimiteDeCustoAtingido();
    }
  }

  private async chamarJev(
    estado: ReturnType<typeof montarEstado>['estado'] | undefined,
    reserva: ReservaAtiva,
    sinal: AbortSignal | undefined,
  ): Promise<RespostaDeIa<RespostasDoComentario>> {
    if (estado === undefined) {
      throw new Error('estado_ausente');
    }
    const resultado = await this.dep.classificador.classificarComentario(estado, { sinal });
    // As tentativas anteriores que podem ter sido cobradas valem a estimativa cada uma.
    return {
      valor: resultado,
      uso: {
        tokensEntrada:
          resultado.uso.tokensEntrada +
          resultado.tentativasAmbiguas * reserva.tokensEntradaEstimados,
        tokensSaida:
          resultado.uso.tokensSaida + resultado.tentativasAmbiguas * reserva.tokensSaidaEstimados,
      },
    };
  }

  private async gravarSucesso(
    contaId: ContaId,
    comentario: ComentarioParaClassificar | undefined,
    truncado: boolean,
    resultado: { ok: boolean; valor?: RespostasDoComentario } | undefined,
  ): Promise<void> {
    if (comentario === undefined || resultado?.valor === undefined) {
      return;
    }
    await this.dep.classificacoes.gravar(
      contaId,
      comentario.id,
      posProcessar(resultado.valor),
      truncado,
    );
    if (truncado) {
      this.dep.registrador.info(
        { categoria: 'classificacao', idComentario: comentario.id },
        'comentário truncado antes de enviar ao Jev',
      );
    }
  }

  private async gravarFalha(
    contaId: ContaId,
    comentario: ComentarioParaClassificar | undefined,
    resultado: { ok: boolean; erro?: unknown } | undefined,
  ): Promise<void> {
    if (comentario === undefined) {
      return;
    }
    const situacao = await this.dep.classificacoes.registrarFalha(
      contaId,
      comentario.id,
      nomeSeguroDoErro(resultado?.erro),
      MAX_TENTATIVAS_CLASSIFICACAO,
    );
    this.dep.registrador.warn(
      { categoria: 'classificacao', idComentario: comentario.id, situacao },
      'falha ao classificar o comentário',
    );
  }
}

export function criarClassificacaoServico(
  dependencias: DependenciasDaClassificacao,
): ClassificacaoServico {
  return new ClassificacaoServicoImpl(dependencias);
}
