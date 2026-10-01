import { ehViolacaoDeChaveEstrangeira } from '../db/erros-banco.js';
import { ErroDeValidacao, ErroNaoEncontrado } from '../shared/errors.js';
import type { ContaId, ProjetoId, TrabalhoId } from '../shared/ids.js';
import type { TrabalhosRepositorio } from './trabalhos.repositorio.js';
import type { EntradaDeNovoTrabalho, TipoDeTrabalho, Trabalho } from './trabalhos.tipos.js';

export interface ResultadoDeCriacao {
  trabalho: Trabalho;
  jaExistia: boolean;
}

export interface TrabalhosServico {
  criar(contaId: ContaId, entrada: EntradaDeNovoTrabalho): Promise<ResultadoDeCriacao>;
  obter(contaId: ContaId, trabalhoId: TrabalhoId): Promise<Trabalho>;
  listarAtivosDoTipo(contaId: ContaId, tipo: TipoDeTrabalho): Promise<Trabalho[]>;
  cancelarNaoIniciados(
    contaId: ContaId,
    projetoId: ProjetoId,
    tipo: TipoDeTrabalho,
  ): Promise<number>;
}

// O job existente pode terminar entre o INSERT e a busca; a segunda rodada cria o novo.
const RODADAS_DE_CRIACAO = 3;

function exigirChaveDeUnicidade(entrada: EntradaDeNovoTrabalho): void {
  const falta =
    entrada.tipo === 'ask'
      ? typeof entrada.carga?.perguntaId !== 'string'
      : (entrada.tipo === 'classify' || entrada.tipo === 'google_sync') &&
        entrada.projetoId === undefined;
  if (falta) {
    throw new ErroDeValidacao('O job precisa do projeto ou da pergunta que o identifica.');
  }
}

export function criarTrabalhosServico(repositorio: TrabalhosRepositorio): TrabalhosServico {
  async function tentarCriar(
    contaId: ContaId,
    entrada: EntradaDeNovoTrabalho,
  ): Promise<ResultadoDeCriacao | undefined> {
    const criado = await repositorio.criarSeNaoHouverAtivo(contaId, entrada);
    if (criado !== undefined) {
      return { trabalho: criado, jaExistia: false };
    }
    const existente = await repositorio.buscarAtivoEquivalente(contaId, entrada);
    return existente && { trabalho: existente, jaExistia: true };
  }

  return {
    async criar(contaId, entrada) {
      exigirChaveDeUnicidade(entrada);
      for (let rodada = 0; rodada < RODADAS_DE_CRIACAO; rodada += 1) {
        try {
          const resultado = await tentarCriar(contaId, entrada);
          if (resultado !== undefined) {
            return resultado;
          }
        } catch (erro) {
          if (ehViolacaoDeChaveEstrangeira(erro)) {
            throw new ErroNaoEncontrado('Projeto não encontrado.', 'projeto_nao_encontrado');
          }
          throw erro;
        }
      }
      throw new Error('Não foi possível criar nem localizar o job ativo.');
    },

    listarAtivosDoTipo: (contaId, tipo) => repositorio.listarAtivosDoTipo(contaId, tipo),
    cancelarNaoIniciados: (contaId, projetoId, tipo) =>
      repositorio.cancelarNaoIniciados(contaId, projetoId, tipo),

    async obter(contaId, trabalhoId) {
      const trabalho = await repositorio.buscarPorId(contaId, trabalhoId);
      if (trabalho === undefined) {
        throw new ErroNaoEncontrado('Job não encontrado.', 'trabalho_nao_encontrado');
      }
      return trabalho;
    },
  };
}
