import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { ContaId, ProjetoId, UsuarioId } from '../../shared/ids.js';
import type { EntradaPaginacao, Pagina } from '../../shared/pagination.js';
import { montarPagina } from '../../shared/pagination.js';
import type { Projeto, ProjetosRepositorio } from './projetos.repositorio.js';

export type { Projeto };

export interface ProjetosServico {
  criar(contaId: ContaId, usuarioId: UsuarioId, nome: string): Promise<Projeto>;
  listar(contaId: ContaId, paginacao: EntradaPaginacao): Promise<Pagina<Projeto>>;
  obter(contaId: ContaId, projetoId: ProjetoId): Promise<Projeto>;
  renomear(contaId: ContaId, projetoId: ProjetoId, nome: string): Promise<Projeto>;
  apagar(contaId: ContaId, projetoId: ProjetoId): Promise<void>;
}

function projetoNaoEncontrado(): ErroNaoEncontrado {
  return new ErroNaoEncontrado('Projeto não encontrado.', 'projeto_nao_encontrado');
}

export function criarProjetosServico(repositorio: ProjetosRepositorio): ProjetosServico {
  return {
    criar: (contaId, usuarioId, nome) => repositorio.criar(contaId, nome, usuarioId),

    async listar(contaId, paginacao) {
      const { projetos, total } = await repositorio.listar(contaId, paginacao);
      return montarPagina(projetos, total, paginacao);
    },

    async obter(contaId, projetoId) {
      const projeto = await repositorio.buscarPorId(contaId, projetoId);
      if (projeto === undefined) {
        throw projetoNaoEncontrado();
      }
      return projeto;
    },

    async renomear(contaId, projetoId, nome) {
      const projeto = await repositorio.renomear(contaId, projetoId, nome);
      if (projeto === undefined) {
        throw projetoNaoEncontrado();
      }
      return projeto;
    },

    async apagar(contaId, projetoId) {
      if (!(await repositorio.apagar(contaId, projetoId))) {
        throw projetoNaoEncontrado();
      }
    },
  };
}
