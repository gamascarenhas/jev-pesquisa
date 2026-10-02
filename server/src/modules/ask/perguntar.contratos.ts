import type { TrabalhosServico } from '../../jobs/trabalhos.servico.js';
import type { ContaId, ProjetoId, TrabalhoId, UsuarioId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { EntradaPaginacao } from '../../shared/pagination.js';
import type {
  ComentariosServico,
  ContagemPorFaixa,
  EntradaDosFiltros,
  FaixaDaPergunta,
  FiltrosDeComentarios,
  RespostaListada,
} from '../comments/comentarios.servico.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import type { ControleDeCusto } from '../usage/controle-custo.servico.js';
import type { ExecutorDePergunta, ProgressoDaPergunta } from './executor-pergunta.js';
import type { InterpretadorDePergunta } from './interpretador-pergunta.js';
import type { PerguntasPersonalizadasRepositorio } from './perguntas-personalizadas.repositorio.js';
import type { PerguntaGravada } from './perguntar.tipos.js';

export interface EstimativaDaPergunta {
  totalAvaliar: number;
  foraDoLimite: number;
  jaRespondidos: number;
  porcentagemEstimada: number;
  porcentagemJaConsumida: number;
  cabe: boolean;
}

export interface PerguntaComConfirmacao {
  pergunta: PerguntaGravada;
  progresso: { feito: number; total: number };
  confirmacao: EstimativaDaPergunta | null;
}

export interface ResultadoDaPergunta {
  contagens: ContagemPorFaixa;
  itens: RespostaListada[];
  total: number;
}

export interface ArquivoDaPergunta {
  nomeDoArquivo: string;
  conteudo: AsyncGenerator<string>;
}

export interface PerguntarServico {
  interpretar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    entrada: { texto: string; filtros: EntradaDosFiltros },
  ): Promise<PerguntaComConfirmacao>;
  confirmar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    perguntaId: string,
  ): Promise<{ trabalhoId: TrabalhoId | null; jaExistia: boolean }>;
  obter(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
  ): Promise<PerguntaComConfirmacao>;
  listar(contaId: ContaId, projetoId: ProjetoId): Promise<PerguntaGravada[]>;
  resultado(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    faixa: FaixaDaPergunta,
    paginacao: EntradaPaginacao,
  ): Promise<ResultadoDaPergunta>;
  exportar(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    faixa: FaixaDaPergunta,
  ): Promise<ArquivoDaPergunta>;
  executar(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    progresso: ProgressoDaPergunta,
  ): Promise<void>;
}

export interface DependenciasDoPerguntar {
  repositorio: PerguntasPersonalizadasRepositorio;
  interpretador: InterpretadorDePergunta;
  executor: ExecutorDePergunta;
  comentarios: ComentariosServico;
  projetos: ProjetosServico;
  trabalhos: Pick<TrabalhosServico, 'criar' | 'listarAtivosDoTipo'>;
  controleDeCusto: ControleDeCusto;
  registrador: Registrador;
  maximoDeComentarios: number;
}
