import { z } from 'zod';

import type { ClassificadorDeComentarios } from '../../integrations/jev/classificador-comentarios.js';
import type { ProvedorLlm } from '../../integrations/llm/provedor-llm.js';
import type { TrabalhosServico } from '../../jobs/trabalhos.servico.js';
import { dataNoFusoLocal, type Relogio } from '../../shared/clock.js';
import { ErroNaoEncontrado, nomeSeguroDoErro } from '../../shared/errors.js';
import type { ContaId, ProjetoId, TrabalhoId, UsuarioId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ComentarioCitado, ComentariosServico } from '../comments/comentarios.servico.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import type { ControleDeCusto } from '../usage/controle-custo.servico.js';
import { inicioDoDia, resolverPeriodo, somarDias } from './periodo-resumo.js';
import { agregar } from './agregar.js';
import { calcularHashDeDados } from './hash-dados.js';
import { VOLUME_MINIMO_PARA_RESUMIR, calcularNivelDeAlerta } from './nivel-alerta.js';
import { ProdutorDeResumo, type ConfiguracaoDoProdutor } from './produtor-resumo.js';
import type { ResumosRepositorio, ResumoGravado } from './resumos.repositorio.js';
import { selecionarAmostra } from './selecionar-amostra.js';
import type { Agregados } from './resumos.tipos.js';

const IDADE_MAXIMA_DA_GERACAO_MS = 15 * 60 * 1000;
const ORDEM_DO_ALERTA = { critical: 0, attention: 1, stable: 2 } as const;

export const esquemaCargaDoResumo = z
  .object({
    de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    unidade: z.string().nullable(),
    usuarioId: z.string().nullable(),
  })
  .strict();
export type CargaDoResumo = z.infer<typeof esquemaCargaDoResumo>;

export interface EntradaDoResumo {
  de?: string | undefined;
  ate?: string | undefined;
  unidade?: string | undefined;
}

export interface ProgressoDoResumo {
  sinal: AbortSignal;
  atualizarProgresso: (total: number, feito: number) => Promise<void>;
}

export interface ListaDeResumos {
  emAndamento: boolean;
  resumos: ResumoGravado[];
}

export interface ResumosServico {
  iniciar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    entrada: EntradaDoResumo,
  ): Promise<{ trabalhoId: TrabalhoId; jaExistia: boolean }>;
  gerar(
    contaId: ContaId,
    projetoId: ProjetoId,
    carga: unknown,
    progresso: ProgressoDoResumo,
  ): Promise<void>;
  listar(contaId: ContaId, projetoId: ProjetoId): Promise<ListaDeResumos>;
  evidencias(
    contaId: ContaId,
    projetoId: ProjetoId,
    resumoId: string,
    indiceDoAchado: number,
  ): Promise<ComentarioCitado[]>;
}

export interface DependenciasDeResumos {
  repositorio: ResumosRepositorio;
  comentarios: Pick<
    ComentariosServico,
    | 'agregarParaResumo'
    | 'primeiraDataComentada'
    | 'candidatosParaResumo'
    | 'impressaoParaResumo'
    | 'porTemaESentimento'
    | 'citados'
  >;
  projetos: ProjetosServico;
  trabalhos: Pick<TrabalhosServico, 'criar' | 'listarAtivosDoTipo'>;
  controleDeCusto: ControleDeCusto;
  llm: ProvedorLlm;
  classificador: Pick<ClassificadorDeComentarios, 'avaliar'>;
  relogio: Relogio;
  registrador: Registrador;
  configuracao: ConfiguracaoDoProdutor;
}

interface JanelaDeTempo {
  de: Date | undefined;
  ateExclusivo: Date | undefined;
  anterior: { de: Date; ateExclusivo: Date } | null;
}

class ResumosServicoImpl implements ResumosServico {
  private readonly produtor: ProdutorDeResumo;

  constructor(private readonly dep: DependenciasDeResumos) {
    this.produtor = new ProdutorDeResumo(dep);
  }

  async iniciar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    entrada: EntradaDoResumo,
  ) {
    await this.dep.projetos.obter(contaId, projetoId);
    const periodo = resolverPeriodo(entrada, dataNoFusoLocal(this.dep.relogio.agora()));
    const ativo = await this.ativoDoProjeto(contaId, projetoId);
    if (ativo !== undefined) {
      return { trabalhoId: ativo, jaExistia: true };
    }
    const carga: CargaDoResumo = { ...periodo, unidade: entrada.unidade ?? null, usuarioId };
    const { trabalho } = await this.dep.trabalhos.criar(contaId, {
      tipo: 'summarize',
      projetoId,
      carga,
      criadoPor: usuarioId,
    });
    return { trabalhoId: trabalho.id, jaExistia: false };
  }

  async gerar(
    contaId: ContaId,
    projetoId: ProjetoId,
    cargaBruta: unknown,
    progresso: ProgressoDoResumo,
  ): Promise<void> {
    const carga = esquemaCargaDoResumo.parse(cargaBruta);
    const janela = await this.janela(contaId, projetoId, carga);
    const filtroBase = {
      unidade: carga.unidade ?? undefined,
      de: janela.de,
      ateExclusivo: janela.ateExclusivo,
    };
    const temas = await this.temasComComentarios(contaId, projetoId, filtroBase);
    await this.dep.repositorio.encerrarGeracoesAntigas(
      contaId,
      projetoId,
      new Date(this.dep.relogio.agora().getTime() - IDADE_MAXIMA_DA_GERACAO_MS),
    );
    for (const [indice, tema] of temas.entries()) {
      if (progresso.sinal.aborted) {
        throw new Error('resumo_interrompido');
      }
      await this.gerarDoTema(contaId, projetoId, carga, janela, tema, progresso.sinal);
      await progresso.atualizarProgresso(temas.length, indice + 1);
    }
  }

  async listar(contaId: ContaId, projetoId: ProjetoId): Promise<ListaDeResumos> {
    await this.dep.projetos.obter(contaId, projetoId);
    const resumos = await this.dep.repositorio.listarUltimoConjunto(contaId, projetoId);
    resumos.sort(
      (a, b) =>
        ORDEM_DO_ALERTA[a.nivelDeAlerta] - ORDEM_DO_ALERTA[b.nivelDeAlerta] ||
        b.agregados.volume - a.agregados.volume ||
        a.tema.localeCompare(b.tema),
    );
    return {
      emAndamento: (await this.ativoDoProjeto(contaId, projetoId)) !== undefined,
      resumos,
    };
  }

  async evidencias(
    contaId: ContaId,
    projetoId: ProjetoId,
    resumoId: string,
    indiceDoAchado: number,
  ): Promise<ComentarioCitado[]> {
    await this.dep.projetos.obter(contaId, projetoId);
    const resumo = await this.dep.repositorio.buscarPorId(contaId, projetoId, resumoId);
    const achado = resumo?.achados?.[indiceDoAchado];
    if (achado === undefined) {
      throw new ErroNaoEncontrado('Achado não encontrado.', 'achado_nao_encontrado');
    }
    return this.dep.comentarios.citados(
      contaId,
      projetoId,
      achado.evidencias.map((e) => e.comentarioId),
    );
  }

  private async ativoDoProjeto(contaId: ContaId, projetoId: ProjetoId) {
    const ativos = await this.dep.trabalhos.listarAtivosDoTipo(contaId, 'summarize');
    return ativos.find((trabalho) => trabalho.projetoId === projetoId)?.id;
  }

  // Sem nenhuma data nos comentários não existem dois períodos: o resumo usa o total e omite variações.
  private async janela(
    contaId: ContaId,
    projetoId: ProjetoId,
    carga: CargaDoResumo,
  ): Promise<JanelaDeTempo> {
    const primeira = await this.dep.comentarios.primeiraDataComentada(contaId, projetoId);
    if (primeira === null) {
      return { de: undefined, ateExclusivo: undefined, anterior: null };
    }
    const de = inicioDoDia(carga.de);
    const ateExclusivo = inicioDoDia(somarDias(carga.ate, 1));
    const duracao = ateExclusivo.getTime() - de.getTime();
    const anterior = { de: new Date(de.getTime() - duracao), ateExclusivo: de };
    return { de, ateExclusivo, anterior: primeira <= anterior.de ? anterior : null };
  }

  private async temasComComentarios(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtro: { unidade: string | undefined; de: Date | undefined; ateExclusivo: Date | undefined },
  ): Promise<string[]> {
    const linhas = await this.dep.comentarios.porTemaESentimento(contaId, projetoId, filtro);
    return [...new Set(linhas.map((linha) => linha.tema))].sort();
  }

  private async agregados(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtro: {
      tema: string;
      unidade: string | undefined;
      de: Date | undefined;
      ateExclusivo: Date | undefined;
    },
    janela: JanelaDeTempo,
  ): Promise<Agregados> {
    const atual = await this.dep.comentarios.agregarParaResumo(contaId, projetoId, filtro);
    const anterior =
      janela.anterior === null
        ? null
        : await this.dep.comentarios.agregarParaResumo(contaId, projetoId, {
            ...filtro,
            ...janela.anterior,
          });
    return agregar(atual, anterior);
  }

  private async gerarDoTema(
    contaId: ContaId,
    projetoId: ProjetoId,
    carga: CargaDoResumo,
    janela: JanelaDeTempo,
    tema: string,
    sinal: AbortSignal,
  ): Promise<void> {
    const filtro = {
      tema,
      unidade: carga.unidade ?? undefined,
      de: janela.de,
      ateExclusivo: janela.ateExclusivo,
    };
    const agregados = await this.agregados(contaId, projetoId, filtro, janela);
    const impressao = await this.dep.comentarios.impressaoParaResumo(contaId, projetoId, filtro);
    const chave = {
      tema,
      inicio: carga.de,
      fim: carga.ate,
      unidade: carga.unidade,
      hashDados: calcularHashDeDados(impressao, agregados),
    };
    if ((await this.dep.repositorio.buscarEquivalente(contaId, projetoId, chave)) !== undefined) {
      return;
    }
    const nivelDeAlerta = calcularNivelDeAlerta(agregados);
    const pequeno = agregados.volume < VOLUME_MINIMO_PARA_RESUMIR;
    const candidatos = pequeno
      ? []
      : await this.dep.comentarios.candidatosParaResumo(contaId, projetoId, filtro);
    const amostra = pequeno ? null : selecionarAmostra(candidatos, agregados.unidadesPrincipais);
    const usuarioId = carga.usuarioId as UsuarioId | null;
    const gravado = await this.dep.repositorio.inserir(contaId, projetoId, usuarioId, {
      ...chave,
      agregados,
      amostra,
      nivelDeAlerta,
      status: pequeno ? 'too_few_comments' : 'generating',
    });
    if (gravado === undefined || pequeno || amostra === null) {
      return;
    }
    try {
      await this.produtor.produzir(contaId, gravado, amostra, agregados, sinal);
    } catch (erro) {
      await this.dep.repositorio.marcarFalha(contaId, gravado.id, nomeSeguroDoErro(erro));
      throw erro;
    }
  }
}

export function criarResumosServico(dep: DependenciasDeResumos): ResumosServico {
  return new ResumosServicoImpl(dep);
}
