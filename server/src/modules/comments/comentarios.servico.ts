import type { Executor } from '../../db/conexoes.js';
import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { ComentarioId, ContaId, FonteId, ProjetoId, UsuarioId } from '../../shared/ids.js';
import { montarPagina, type EntradaPaginacao, type Pagina } from '../../shared/pagination.js';
import {
  NIVEL_MAXIMO_DE_GRAVIDADE,
  type ClassificacaoServico,
} from '../classification/classificacao.servico.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import { mascararTexto } from './anonimizador.js';
import type { ComentariosRepositorio } from './comentarios.repositorio.js';
import type {
  AgregadoDoTema,
  CandidatoDoResumo,
  ComentarioCitado,
  FiltroDoResumo,
  ComentarioListado,
  ComentarioExterno,
  ComentarioParaImportar,
  ContagemDeGravidade,
  ContagemTemaSentimento,
  OpcoesDeFiltro,
  ResultadoDaSincronizacao,
  ResultadoDoLote,
  ResumoDoPainel,
} from './comentarios.tipos.js';
import type { ConsultasResumoRepositorio } from './consultas-resumo.repositorio.js';
import type { ConsultasComentariosRepositorio } from './consultas-comentarios.repositorio.js';
import type { FiltrosDeComentarios } from './filtros-comentarios.js';

export { converterFiltros, esquemaFiltrosDeComentarios } from './filtros-comentarios.js';
import { calcularHashDeUpload, calcularHashDoGoogle } from './hash-conteudo.js';

export type {
  AgregadoDoTema,
  CandidatoDoResumo,
  ComentarioCitado,
  FiltroDoResumo,
  ComentarioExterno,
  ResultadoDaSincronizacao,
  ComentarioListado,
  ComentarioParaImportar,
  ContagemDeGravidade,
  ContagemTemaSentimento,
  OpcoesDeFiltro,
  ResultadoDoLote,
  ResumoDoPainel,
};
export type { FiltrosDeComentarios };

export interface ComentariosServico {
  importarLote(
    contaId: ContaId,
    projetoId: ProjetoId,
    fonteId: FonteId,
    comentarios: ComentarioParaImportar[],
    executor?: Executor,
  ): Promise<ResultadoDoLote>;
  sincronizarExternos(
    contaId: ContaId,
    projetoId: ProjetoId,
    fonteId: FonteId,
    comentarios: ComentarioExterno[],
  ): Promise<ResultadoDaSincronizacao>;
  agregarParaResumo(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtro: FiltroDoResumo,
  ): Promise<AgregadoDoTema>;
  primeiraDataComentada(contaId: ContaId, projetoId: ProjetoId): Promise<Date | null>;
  candidatosParaResumo(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtro: FiltroDoResumo,
  ): Promise<CandidatoDoResumo[]>;
  impressaoParaResumo(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtro: FiltroDoResumo,
  ): Promise<string>;
  citados(contaId: ContaId, projetoId: ProjetoId, ids: string[]): Promise<ComentarioCitado[]>;
  resumo(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
  ): Promise<ResumoDoPainel>;
  porTemaESentimento(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
  ): Promise<ContagemTemaSentimento[]>;
  porGravidade(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
  ): Promise<ContagemDeGravidade[]>;
  opcoesDeFiltro(contaId: ContaId, projetoId: ProjetoId): Promise<OpcoesDeFiltro>;
  listar(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    paginacao: EntradaPaginacao,
  ): Promise<Pagina<ComentarioListado>>;
  listarFilaDeRevisao(
    contaId: ContaId,
    projetoId: ProjetoId,
    paginacao: EntradaPaginacao,
  ): Promise<Pagina<ComentarioListado>>;
  lerLoteParaExportar(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    depoisDe: string | undefined,
    limite: number,
  ): Promise<ComentarioListado[]>;
  corrigir(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    comentarioId: ComentarioId,
    tema: string,
    sentimento: string,
  ): Promise<void>;
}

export interface DependenciasDeComentarios {
  repositorio: ComentariosRepositorio;
  consultas: ConsultasComentariosRepositorio;
  consultasResumo: ConsultasResumoRepositorio;
  projetos: ProjetosServico;
  classificacao: Pick<ClassificacaoServico, 'corrigir'>;
}

async function importarLote(
  repositorio: ComentariosRepositorio,
  contaId: ContaId,
  projetoId: ProjetoId,
  fonteId: FonteId,
  comentarios: ComentarioParaImportar[],
  executor?: Executor,
): Promise<ResultadoDoLote> {
  const linhas = comentarios.map((comentario) => ({
    textoOriginal: comentario.texto,
    textoMascarado: mascararTexto(comentario.texto),
    nota: comentario.nota,
    unidade: comentario.unidade,
    autor: comentario.autor,
    comentadoEm: comentario.comentadoEm,
    hashConteudo: calcularHashDeUpload(comentario),
  }));
  const inseridos = await repositorio.inserirEmLote(contaId, projetoId, fonteId, linhas, executor);
  return { inseridos, duplicados: linhas.length - inseridos };
}

// Para quem só grava comentários (importação e dados de demonstração).
export function criarImportadorDeComentarios(
  repositorio: ComentariosRepositorio,
): Pick<ComentariosServico, 'importarLote'> {
  return {
    importarLote: (contaId, projetoId, fonteId, comentarios, executor) =>
      importarLote(repositorio, contaId, projetoId, fonteId, comentarios, executor),
  };
}

class ComentariosServicoImpl implements ComentariosServico {
  constructor(private readonly dep: DependenciasDeComentarios) {}

  importarLote(
    contaId: ContaId,
    projetoId: ProjetoId,
    fonteId: FonteId,
    comentarios: ComentarioParaImportar[],
    executor?: Executor,
  ): Promise<ResultadoDoLote> {
    return importarLote(this.dep.repositorio, contaId, projetoId, fonteId, comentarios, executor);
  }

  async sincronizarExternos(
    contaId: ContaId,
    projetoId: ProjetoId,
    fonteId: FonteId,
    comentarios: ComentarioExterno[],
  ): Promise<ResultadoDaSincronizacao> {
    const unicos = new Map(comentarios.map((comentario) => [comentario.idExterno, comentario]));
    const linhas = [...unicos.values()].map((comentario) => ({
      idExterno: comentario.idExterno,
      textoOriginal: comentario.texto,
      textoMascarado: comentario.texto === null ? null : mascararTexto(comentario.texto),
      nota: comentario.nota,
      unidade: comentario.unidade,
      autor: comentario.autor,
      comentadoEm: comentario.comentadoEm,
      atualizadoEm: comentario.atualizadoEm,
      hashConteudo: calcularHashDoGoogle(comentario.idExterno),
    }));
    return this.dep.repositorio.sincronizarExternos(contaId, projetoId, fonteId, linhas);
  }

  agregarParaResumo(contaId: ContaId, projetoId: ProjetoId, filtro: FiltroDoResumo) {
    return this.dep.consultasResumo.agregar(contaId, projetoId, filtro);
  }

  primeiraDataComentada(contaId: ContaId, projetoId: ProjetoId) {
    return this.dep.consultasResumo.primeiraDataComentada(contaId, projetoId);
  }

  candidatosParaResumo(contaId: ContaId, projetoId: ProjetoId, filtro: FiltroDoResumo) {
    return this.dep.consultasResumo.candidatos(contaId, projetoId, filtro);
  }

  impressaoParaResumo(contaId: ContaId, projetoId: ProjetoId, filtro: FiltroDoResumo) {
    return this.dep.consultasResumo.impressaoDigital(contaId, projetoId, filtro);
  }

  async citados(contaId: ContaId, projetoId: ProjetoId, ids: string[]) {
    await this.dep.projetos.obter(contaId, projetoId);
    return this.dep.consultasResumo.citados(contaId, projetoId, ids);
  }

  async resumo(contaId: ContaId, projetoId: ProjetoId, filtros: FiltrosDeComentarios) {
    await this.dep.projetos.obter(contaId, projetoId);
    return this.dep.consultas.resumo(contaId, projetoId, filtros);
  }

  async porTemaESentimento(contaId: ContaId, projetoId: ProjetoId, filtros: FiltrosDeComentarios) {
    await this.dep.projetos.obter(contaId, projetoId);
    return this.dep.consultas.porTemaESentimento(contaId, projetoId, filtros);
  }

  async porGravidade(contaId: ContaId, projetoId: ProjetoId, filtros: FiltrosDeComentarios) {
    await this.dep.projetos.obter(contaId, projetoId);
    return this.dep.consultas.porGravidade(contaId, projetoId, filtros, NIVEL_MAXIMO_DE_GRAVIDADE);
  }

  async opcoesDeFiltro(contaId: ContaId, projetoId: ProjetoId) {
    await this.dep.projetos.obter(contaId, projetoId);
    return this.dep.consultas.opcoesDeFiltro(contaId, projetoId);
  }

  async listar(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    paginacao: EntradaPaginacao,
  ) {
    await this.dep.projetos.obter(contaId, projetoId);
    const { comentarios, total } = await this.dep.consultas.listar(
      contaId,
      projetoId,
      filtros,
      paginacao,
      false,
    );
    return montarPagina(comentarios, total, paginacao);
  }

  async listarFilaDeRevisao(contaId: ContaId, projetoId: ProjetoId, paginacao: EntradaPaginacao) {
    await this.dep.projetos.obter(contaId, projetoId);
    const { comentarios, total } = await this.dep.consultas.listar(
      contaId,
      projetoId,
      {},
      paginacao,
      true,
    );
    return montarPagina(comentarios, total, paginacao);
  }

  async lerLoteParaExportar(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    depoisDe: string | undefined,
    limite: number,
  ) {
    return this.dep.consultas.lerLoteParaExportar(contaId, projetoId, filtros, depoisDe, limite);
  }

  async corrigir(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    comentarioId: ComentarioId,
    tema: string,
    sentimento: string,
  ): Promise<void> {
    await this.dep.projetos.obter(contaId, projetoId);
    if (!(await this.dep.consultas.existeNoProjeto(contaId, projetoId, comentarioId))) {
      throw new ErroNaoEncontrado('Comentário não encontrado.', 'comentario_nao_encontrado');
    }
    await this.dep.classificacao.corrigir(contaId, usuarioId, comentarioId, tema, sentimento);
  }
}

export function criarComentariosServico(dep: DependenciasDeComentarios): ComentariosServico {
  return new ComentariosServicoImpl(dep);
}
