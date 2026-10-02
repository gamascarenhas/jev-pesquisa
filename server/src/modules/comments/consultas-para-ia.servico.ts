import type { ContaId, ProjetoId } from '../../shared/ids.js';
import type { EntradaPaginacao } from '../../shared/pagination.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import type {
  AgregadoDoTema,
  AlvoDaPergunta,
  CandidatoDoResumo,
  ComentarioCitado,
  ContagemPorFaixa,
  FaixaDaPergunta,
  FiltroDoResumo,
  LimiaresDeFaixa,
  RespostaListada,
  TextoParaPergunta,
} from './comentarios.tipos.js';
import type { ConsultasPerguntaRepositorio } from './consultas-pergunta.repositorio.js';
import type { ConsultasResumoRepositorio } from './consultas-resumo.repositorio.js';
import type { FiltrosDeComentarios } from './filtros-comentarios.js';

// O que o resumo executivo e as perguntas livres precisam ler dos comentários.
export interface ConsultasParaIa {
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
  alvosDaPergunta(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    limite: number,
    tamanhoMaximoDoTexto: number,
  ): Promise<{ total: number; alvos: AlvoDaPergunta[] }>;
  textosParaPergunta(
    contaId: ContaId,
    projetoId: ProjetoId,
    ids: string[],
  ): Promise<TextoParaPergunta[]>;
  contarRespostasPorFaixa(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    limiares: LimiaresDeFaixa,
  ): Promise<ContagemPorFaixa>;
  listarRespostasDaPergunta(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    faixa: FaixaDaPergunta,
    limiares: LimiaresDeFaixa,
    paginacao: EntradaPaginacao,
  ): Promise<{ itens: RespostaListada[]; total: number }>;
}

export interface DependenciasParaIa {
  consultasResumo: ConsultasResumoRepositorio;
  consultasPergunta: ConsultasPerguntaRepositorio;
  projetos: ProjetosServico;
}

export class ConsultasParaIaImpl implements ConsultasParaIa {
  constructor(protected readonly dep: DependenciasParaIa) {}

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

  alvosDaPergunta(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    limite: number,
    tamanhoMaximoDoTexto: number,
  ) {
    return this.dep.consultasPergunta.alvos(
      contaId,
      projetoId,
      filtros,
      limite,
      tamanhoMaximoDoTexto,
    );
  }

  textosParaPergunta(contaId: ContaId, projetoId: ProjetoId, ids: string[]) {
    return this.dep.consultasPergunta.textos(contaId, projetoId, ids);
  }

  contarRespostasPorFaixa(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    limiares: LimiaresDeFaixa,
  ) {
    return this.dep.consultasPergunta.contarPorFaixa(
      contaId,
      projetoId,
      perguntaId,
      filtros,
      limiares,
    );
  }

  listarRespostasDaPergunta(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    faixa: FaixaDaPergunta,
    limiares: LimiaresDeFaixa,
    paginacao: EntradaPaginacao,
  ) {
    return this.dep.consultasPergunta.listarRespostas(
      contaId,
      projetoId,
      perguntaId,
      filtros,
      faixa,
      limiares,
      paginacao,
    );
  }

  async citados(contaId: ContaId, projetoId: ProjetoId, ids: string[]) {
    await this.dep.projetos.obter(contaId, projetoId);
    return this.dep.consultasResumo.citados(contaId, projetoId, ids);
  }
}
