import { registrarAuditoria } from '../../shared/auditoria.js';
import { ErroDeValidacao } from '../../shared/errors.js';
import type { ContaId, ProjetoId, UsuarioId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ContasServico } from '../accounts/contas.servico.js';
import type { EncerradorDeSessoes } from '../auth/autenticacao.tipos.js';
import type { UsuariosServico } from '../auth/usuarios.servico.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';

// A fase 10 acrescenta aqui a revogação do token do Google, antes de apagar a conta.
export type PassoAntesDeEncerrarConta = (contaId: ContaId) => Promise<void>;

export interface DependenciasDeExclusao {
  projetos: ProjetosServico;
  contas: ContasServico;
  usuarios: UsuariosServico;
  encerradorDeSessoes: EncerradorDeSessoes;
  registrador: Registrador;
  passosAntesDeEncerrarConta: PassoAntesDeEncerrarConta[];
}

export interface ExclusaoDadosServico {
  apagarProjeto(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    nomeDigitado: string,
  ): Promise<void>;
  encerrarConta(contaId: ContaId, usuarioId: UsuarioId, senha: string): Promise<void>;
}

export function criarExclusaoDadosServico(dep: DependenciasDeExclusao): ExclusaoDadosServico {
  return {
    async apagarProjeto(contaId, usuarioId, projetoId, nomeDigitado) {
      const projeto = await dep.projetos.obter(contaId, projetoId);
      if (nomeDigitado.trim() !== projeto.nome) {
        throw new ErroDeValidacao(
          'Digite o nome exato do projeto para confirmar.',
          'confirmacao_invalida',
        );
      }
      // Comentários, classificações e demais dados do projeto saem por ON DELETE CASCADE.
      await dep.projetos.apagar(contaId, projetoId);
      registrarAuditoria(dep.registrador, 'projeto_apagado', {
        contaId,
        usuarioId,
        alvoId: projetoId,
      });
    },

    async encerrarConta(contaId, usuarioId, senha) {
      await dep.usuarios.conferirSenha(contaId, usuarioId, senha);
      for (const passo of dep.passosAntesDeEncerrarConta) {
        await passo(contaId);
      }
      await dep.encerradorDeSessoes.encerrarDaConta(contaId);
      // Usuários, projetos e demais dados da conta saem por ON DELETE CASCADE.
      await dep.contas.apagar(contaId);
      registrarAuditoria(dep.registrador, 'conta_encerrada', { contaId, usuarioId });
    },
  };
}
