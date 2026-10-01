import type { EntradaDaComposicao } from './composicao.js';
import { criarAutenticacaoSistemaRepositorio } from './modules/auth/autenticacao.sistema.repositorio.js';
import type { DependenciasDeAuth } from './modules/auth/dependencias.js';
import { criarGestorDeTokens } from './modules/auth/gestor-tokens.js';
import { criarTokensAutenticacaoRepositorio } from './modules/auth/tokens-autenticacao.repositorio.js';
import { criarUsuariosRepositorio } from './modules/auth/usuarios.repositorio.js';

export function montarDependenciasDeAuth(entrada: EntradaDaComposicao): DependenciasDeAuth {
  const { banco, configuracao, registrador, relogio } = entrada;
  const usuarios = criarUsuariosRepositorio(banco);
  const tokens = criarTokensAutenticacaoRepositorio(banco);
  const sistema = criarAutenticacaoSistemaRepositorio(banco);
  return {
    banco,
    usuarios,
    tokens,
    sistema,
    gestorDeTokens: criarGestorDeTokens({
      tokens,
      sistema,
      enviador: entrada.enviador,
      relogio,
      registrador,
      urlApp: configuracao.origemApp,
      nomeNegocio: configuracao.nomeNegocio,
    }),
    encerradorDeSessoes: entrada.armazenamentoDeSessao,
    relogio,
    registrador,
    configuracao: {
      nomeNegocio: configuracao.nomeNegocio,
      urlApp: configuracao.origemApp,
      versaoTermos: configuracao.versaoTermos,
      planoPadraoId: configuracao.planoPadraoId,
    },
  };
}
