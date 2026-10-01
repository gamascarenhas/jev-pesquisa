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
  ComentarioListado,
  ComentarioParaImportar,
  ContagemDeGravidade,
  ContagemTemaSentimento,
  OpcoesDeFiltro,
  ResultadoDoLote,
  ResumoDoPainel,
} from './comentarios.tipos.js';
import type { ConsultasComentariosRepositorio } from './consultas-comentarios.repositorio.js';
import type { FiltrosDeComentarios } from './filtros-comentarios.js';

export { converterFiltros, esquemaFiltrosDeComentarios } from './filtros-comentarios.js';
import { calcularHashDeUpload } from './hash-conteudo.js';

export type {
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
