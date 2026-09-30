import type { Banco } from '../../db/conexoes.js';
import type { Relogio } from '../../shared/clock.js';
import type { Registrador } from '../../shared/logger.js';
import type { AutenticacaoSistemaRepositorio } from './autenticacao.sistema.repositorio.js';
import type { EncerradorDeSessoes } from './autenticacao.tipos.js';
import type { GestorDeTokens } from './gestor-tokens.js';
import type { TokensAutenticacaoRepositorio } from './tokens-autenticacao.repositorio.js';
import type { UsuariosRepositorio } from './usuarios.repositorio.js';

export interface DependenciasDeAuth {
  banco: Banco;
  usuarios: UsuariosRepositorio;
  tokens: TokensAutenticacaoRepositorio;
  sistema: AutenticacaoSistemaRepositorio;
  gestorDeTokens: GestorDeTokens;
  encerradorDeSessoes: EncerradorDeSessoes;
  relogio: Relogio;
  registrador: Registrador;
  configuracao: {
    nomeNegocio: string;
    urlApp: string;
    versaoTermos: string;
    planoPadraoId: string;
  };
}
