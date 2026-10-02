import {
  ErroDeValidacao,
  ErroNaoEncontrado,
  ErroServicoIndisponivel,
} from '../../shared/errors.js';
import type { ContaId, ProjetoId, TrabalhoId, UsuarioId } from '../../shared/ids.js';
import { ErroDeIaAmbiguo, ErroDeIaNaoCobrado } from '../usage/controle-custo.servico.js';
import type { EntradaPaginacao } from '../../shared/pagination.js';
import {
  converterFiltros,
  mascararTexto,
  type EntradaDosFiltros,
  type FaixaDaPergunta,
  type FiltrosDeComentarios,
} from '../comments/comentarios.servico.js';
import { gerarCsvDaPergunta } from './csv-pergunta.js';
import { estimarPergunta } from './estimativa-pergunta.js';
import type { ProgressoDaPergunta } from './executor-pergunta.js';
import { LIMIARES } from './faixas-pergunta.js';
import { calcularHashDaPergunta } from './hash-pergunta.js';
import type {
  ArquivoDaPergunta,
  DependenciasDoPerguntar,
  PerguntaComConfirmacao,
  PerguntarServico,
  ResultadoDaPergunta,
} from './perguntar.contratos.js';
import {
  MAX_CARACTERES_POR_COMENTARIO,
  PERGUNTAS_NO_HISTORICO,
  type InterpretacaoGravada,
  type PerguntaGravada,
} from './perguntar.tipos.js';

export type {
  ArquivoDaPergunta,
  DependenciasDoPerguntar,
  EstimativaDaPergunta,
  PerguntaComConfirmacao,
  PerguntarServico,
  ResultadoDaPergunta,
} from './perguntar.contratos.js';

function naoEncontrada(): ErroNaoEncontrado {
  return new ErroNaoEncontrado('Pergunta não encontrada.', 'pergunta_nao_encontrada');
}

// Chaves em ordem fixa: os mesmos filtros viram sempre o mesmo JSON.
function normalizarFiltros(filtros: EntradaDosFiltros): EntradaDosFiltros {
  return Object.fromEntries(
    Object.entries(filtros)
      .filter(([, valor]) => valor !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

class PerguntarServicoImpl implements PerguntarServico {
  constructor(private readonly dep: DependenciasDoPerguntar) {}

  async interpretar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    entrada: { texto: string; filtros: EntradaDosFiltros },
  ): Promise<PerguntaComConfirmacao> {
    await this.dep.projetos.obter(contaId, projetoId);
    const hash = calcularHashDaPergunta(entrada.texto);
    const filtros = normalizarFiltros(entrada.filtros);
    const igual = await this.dep.repositorio.buscarIgual(contaId, projetoId, hash, filtros);
    if (igual !== undefined) {
      return this.comConfirmacao(contaId, projetoId, igual);
    }
    const nova = await this.dep.repositorio.criar(contaId, projetoId, usuarioId, {
      textoOriginal: entrada.texto,
      hashPergunta: hash,
      filtros,
    });
    const interpretacao = await this.obterInterpretacao(contaId, projetoId, nova);
    const alvos = interpretacao.respondivel
      ? await this.dep.comentarios.alvosDaPergunta(
          contaId,
          projetoId,
          converterFiltros(filtros),
          this.dep.maximoDeComentarios,
          MAX_CARACTERES_POR_COMENTARIO,
        )
      : null;
    const gravada = await this.dep.repositorio.gravarInterpretacao(
      contaId,
      nova.id,
      interpretacao,
      alvos?.alvos.length ?? null,
    );
    return this.comConfirmacao(contaId, projetoId, gravada);
  }

  async confirmar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    perguntaId: string,
  ): Promise<{ trabalhoId: TrabalhoId | null; jaExistia: boolean }> {
    const pergunta = await this.exigir(contaId, projetoId, perguntaId);
    if (pergunta.respondivel !== true) {
      throw new ErroDeValidacao(
        'Esta pergunta não pode ser respondida.',
        'pergunta_nao_respondivel',
      );
    }
    if (pergunta.status === 'done') {
      return { trabalhoId: null, jaExistia: true };
    }
    const { trabalho, jaExistia } = await this.dep.trabalhos.criar(contaId, {
      tipo: 'ask',
      projetoId,
      carga: { perguntaId },
      criadoPor: usuarioId,
    });
    if (!jaExistia) {
      await this.dep.repositorio.atualizarStatus(contaId, perguntaId, 'running');
    }
    return { trabalhoId: trabalho.id, jaExistia };
  }

  async obter(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
  ): Promise<PerguntaComConfirmacao> {
    const pergunta = await this.exigir(contaId, projetoId, perguntaId);
    return this.comConfirmacao(contaId, projetoId, await this.reconciliar(contaId, pergunta));
  }

  async listar(contaId: ContaId, projetoId: ProjetoId): Promise<PerguntaGravada[]> {
    await this.dep.projetos.obter(contaId, projetoId);
    return this.dep.repositorio.listarRecentes(contaId, projetoId, PERGUNTAS_NO_HISTORICO);
  }

  async resultado(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    faixa: FaixaDaPergunta,
    paginacao: EntradaPaginacao,
  ): Promise<ResultadoDaPergunta> {
    await this.exigir(contaId, projetoId, perguntaId);
    const [contagens, pagina] = await Promise.all([
      this.dep.comentarios.contarRespostasPorFaixa(
        contaId,
        projetoId,
        perguntaId,
        filtros,
        LIMIARES,
      ),
      this.dep.comentarios.listarRespostasDaPergunta(
        contaId,
        projetoId,
        perguntaId,
        filtros,
        faixa,
        LIMIARES,
        paginacao,
      ),
    ]);
    return { contagens, ...pagina };
  }

  async exportar(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    faixa: FaixaDaPergunta,
  ): Promise<ArquivoDaPergunta> {
    await this.exigir(contaId, projetoId, perguntaId);
    return {
      nomeDoArquivo: 'resposta-da-pergunta.csv',
      conteudo: gerarCsvDaPergunta(
        this.dep.comentarios,
        contaId,
        projetoId,
        perguntaId,
        filtros,
        faixa,
      ),
    };
  }

  executar(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    progresso: ProgressoDaPergunta,
  ): Promise<void> {
    return this.dep.executor.executar(contaId, projetoId, perguntaId, progresso);
  }

  private async exigir(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
  ): Promise<PerguntaGravada> {
    await this.dep.projetos.obter(contaId, projetoId);
    const pergunta = await this.dep.repositorio.buscarPorId(contaId, projetoId, perguntaId);
    if (pergunta === undefined) {
      throw naoEncontrada();
    }
    return pergunta;
  }

  // Um job que terminou sem concluir não pode deixar a pergunta "em andamento" para sempre.
  private async reconciliar(contaId: ContaId, pergunta: PerguntaGravada): Promise<PerguntaGravada> {
    if (pergunta.status !== 'running' && pergunta.status !== 'paused_limit') {
      return pergunta;
    }
    const ativos = await this.dep.trabalhos.listarAtivosDoTipo(contaId, 'ask');
    if (ativos.some((t) => t.carga.perguntaId === pergunta.id)) {
      return pergunta;
    }
    await this.dep.repositorio.atualizarStatus(contaId, pergunta.id, 'failed');
    return { ...pergunta, status: 'failed' };
  }

  private async obterInterpretacao(
    contaId: ContaId,
    projetoId: ProjetoId,
    nova: PerguntaGravada,
  ): Promise<InterpretacaoGravada> {
    const existente = await this.dep.repositorio.buscarInterpretacao(
      contaId,
      projetoId,
      nova.hashPergunta,
    );
    if (existente?.respondivel !== undefined && existente.respondivel !== null) {
      return {
        respondivel: existente.respondivel,
        instrucoes: existente.instrucoes,
        criterios: existente.criterios,
        interpretacao: existente.interpretacao ?? '',
        motivoNaoRespondivel: existente.motivoNaoRespondivel,
      };
    }
    const mascarada = mascararTexto(nova.textoOriginal);
    const lida = await this.interpretarComSeguranca(contaId, nova.id, mascarada);
    if (lida === undefined) {
      await this.dep.repositorio.atualizarStatus(contaId, nova.id, 'failed');
      throw new ErroServicoIndisponivel(
        'Não foi possível interpretar a pergunta. Tente escrevê-la de outro jeito.',
        'interpretacao_invalida',
      );
    }
    return {
      respondivel: lida.respondivel,
      instrucoes: lida.respondivel ? lida.instrucoes : null,
      criterios: lida.respondivel ? lida.criterios : null,
      interpretacao: lida.interpretacao_pt,
      motivoNaoRespondivel: lida.respondivel ? null : lida.motivo_se_nao_respondivel_pt,
    };
  }

  // Falha do provedor de IA vira aviso claro, e a pergunta fica marcada como falha para poder tentar de novo.
  private async interpretarComSeguranca(contaId: ContaId, perguntaId: string, texto: string) {
    try {
      return await this.dep.interpretador.interpretar(contaId, perguntaId, texto);
    } catch (erro) {
      await this.dep.repositorio.atualizarStatus(contaId, perguntaId, 'failed');
      if (erro instanceof ErroDeIaNaoCobrado || erro instanceof ErroDeIaAmbiguo) {
        throw new ErroServicoIndisponivel(
          'O serviço de IA não respondeu agora. Tente de novo em alguns minutos.',
          'ia_indisponivel',
        );
      }
      throw erro;
    }
  }

  private async comConfirmacao(
    contaId: ContaId,
    projetoId: ProjetoId,
    pergunta: PerguntaGravada,
  ): Promise<PerguntaComConfirmacao> {
    const respondidos = await this.dep.repositorio.idsRespondidos(contaId, pergunta.id);
    const progresso = { feito: respondidos.size, total: pergunta.totalAlvo ?? 0 };
    if (pergunta.respondivel !== true || pergunta.status !== 'awaiting_confirmation') {
      return { pergunta, progresso, confirmacao: null };
    }
    return {
      pergunta,
      progresso,
      confirmacao: await estimarPergunta(this.dep, contaId, projetoId, pergunta),
    };
  }
}

export function criarPerguntarServico(dep: DependenciasDoPerguntar): PerguntarServico {
  return new PerguntarServicoImpl(dep);
}
