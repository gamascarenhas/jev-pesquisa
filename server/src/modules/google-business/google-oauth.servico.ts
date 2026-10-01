import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { FonteDeAvaliacoes } from '../../integrations/google/fonte-avaliacoes.js';
import { ErroDoGoogle } from '../../integrations/google/fonte-avaliacoes.js';
import type { TrabalhosServico } from '../../jobs/trabalhos.servico.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import type { Relogio } from '../../shared/clock.js';
import type { Criptografia } from '../../shared/crypto.js';
import { ErroDeConflito, ErroDeValidacao, nomeSeguroDoErro } from '../../shared/errors.js';
import type { ContaId, ProjetoId, UsuarioId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import type { ConexoesGoogleRepositorio } from './conexoes-google.repositorio.js';
import type { ConexaoGoogle } from './conexoes-google.tipos.js';
import { traduzirErroDoGoogle } from './erros-google.js';
import type { FontesGoogleRepositorio } from './fontes-google.repositorio.js';

const VALIDADE_DO_ESTADO_MS = 10 * 60 * 1000;
const MARGEM_DE_RENOVACAO_MS = 60 * 1000;
const BYTES_DO_ESTADO = 32;

export interface EstadoDeAutorizacao {
  valor: string;
  projetoId: string;
  criadoEm: number;
}

export interface InicioDaAutorizacao {
  url: string;
  estado: EstadoDeAutorizacao;
}

export interface GoogleOauthServico {
  iniciar(contaId: ContaId, projetoId: ProjetoId): Promise<InicioDaAutorizacao>;
  /** Confere o `state` guardado na sessão e conclui a conexão; o estado é de uso único. */
  concluir(
    contaId: ContaId,
    usuarioId: UsuarioId,
    guardado: EstadoDeAutorizacao | undefined,
    recebido: { state: string; code: string },
  ): Promise<ProjetoId>;
  desconectar(contaId: ContaId, usuarioId: UsuarioId, projetoId: ProjetoId): Promise<void>;
  /** Revoga e apaga os tokens das conexões ativas; usado ao apagar projeto ou encerrar conta. */
  revogarDoProjeto(contaId: ContaId, projetoId: ProjetoId): Promise<void>;
  revogarDaConta(contaId: ContaId): Promise<void>;
  obterTokenDeAcesso(conexao: ConexaoGoogle): Promise<string>;
  /** Renova sem olhar a validade, para quando o Google recusa o token ainda "válido". */
  renovarToken(conexao: ConexaoGoogle): Promise<string>;
}

export interface DependenciasDoOauth {
  fonte: FonteDeAvaliacoes;
  conexoes: ConexoesGoogleRepositorio;
  fontes: FontesGoogleRepositorio;
  criptografia: Criptografia;
  projetos: ProjetosServico;
  trabalhos: Pick<TrabalhosServico, 'cancelarNaoIniciados'>;
  relogio: Relogio;
  registrador: Registrador;
}

function estadosIguais(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

function estadoInvalido(): ErroDeValidacao {
  return new ErroDeValidacao(
    'A autorização do Google expirou. Tente conectar de novo.',
    'google_estado_invalido',
  );
}

class GoogleOauthServicoImpl implements GoogleOauthServico {
  constructor(private readonly dep: DependenciasDoOauth) {}

  async iniciar(contaId: ContaId, projetoId: ProjetoId): Promise<InicioDaAutorizacao> {
    await this.dep.projetos.obter(contaId, projetoId);
    const valor = randomBytes(BYTES_DO_ESTADO).toString('base64url');
    return {
      url: this.dep.fonte.urlDeAutorizacao(valor),
      estado: { valor, projetoId, criadoEm: this.dep.relogio.agora().getTime() },
    };
  }

  async concluir(
    contaId: ContaId,
    usuarioId: UsuarioId,
    guardado: EstadoDeAutorizacao | undefined,
    recebido: { state: string; code: string },
  ): Promise<ProjetoId> {
    const projetoId = this.exigirEstadoValido(guardado, recebido.state);
    await this.dep.projetos.obter(contaId, projetoId);
    if ((await this.dep.conexoes.buscarAtiva(contaId, projetoId)) !== undefined) {
      throw new ErroDeConflito('O projeto já está conectado ao Google.', 'google_ja_conectado');
    }
    try {
      const tokens = await this.dep.fonte.trocarCodigo(recebido.code);
      const { criptografia } = this.dep;
      const conexao = await this.dep.conexoes.criar(contaId, projetoId, usuarioId, {
        email: tokens.email,
        tokenAtualizacaoCifrado: criptografia.criptografar(tokens.tokenAtualizacao),
        tokenAcessoCifrado: criptografia.criptografar(tokens.tokenAcesso),
        tokenAcessoExpiraEm: tokens.expiraEm,
        escopos: tokens.escopos,
      });
      await this.dep.fontes.religar(contaId, projetoId, conexao.id);
    } catch (erro) {
      throw traduzirErroDoGoogle(erro);
    }
    registrarAuditoria(this.dep.registrador, 'google_conectado', {
      contaId,
      usuarioId,
      alvoId: projetoId,
    });
    return projetoId;
  }

  async desconectar(contaId: ContaId, usuarioId: UsuarioId, projetoId: ProjetoId): Promise<void> {
    await this.dep.projetos.obter(contaId, projetoId);
    const conexao = await this.dep.conexoes.buscarAtiva(contaId, projetoId);
    if (conexao === undefined) {
      return;
    }
    await this.revogarConexao(conexao);
    await this.dep.trabalhos.cancelarNaoIniciados(contaId, projetoId, 'google_sync');
    registrarAuditoria(this.dep.registrador, 'google_desconectado', {
      contaId,
      usuarioId,
      alvoId: projetoId,
    });
  }

  async revogarDoProjeto(contaId: ContaId, projetoId: ProjetoId): Promise<void> {
    const conexao = await this.dep.conexoes.buscarAtiva(contaId, projetoId);
    if (conexao !== undefined) {
      await this.revogarConexao(conexao);
    }
  }

  async revogarDaConta(contaId: ContaId): Promise<void> {
    for (const conexao of await this.dep.conexoes.listarAtivasDaConta(contaId)) {
      await this.revogarConexao(conexao);
    }
  }

  async obterTokenDeAcesso(conexao: ConexaoGoogle): Promise<string> {
    const expira = conexao.tokenAcessoExpiraEm?.getTime() ?? 0;
    const aindaValido = expira - MARGEM_DE_RENOVACAO_MS > this.dep.relogio.agora().getTime();
    if (conexao.tokenAcessoCifrado !== null && aindaValido) {
      return this.dep.criptografia.descriptografar(conexao.tokenAcessoCifrado);
    }
    return this.renovarToken(conexao);
  }

  async renovarToken(conexao: ConexaoGoogle): Promise<string> {
    if (conexao.tokenAtualizacaoCifrado === null) {
      throw traduzirErroDoGoogle(new ErroDoGoogle('concessao_invalida'));
    }
    const { criptografia } = this.dep;
    try {
      const tokens = await this.dep.fonte.renovarToken(
        criptografia.descriptografar(conexao.tokenAtualizacaoCifrado),
      );
      await this.dep.conexoes.gravarTokenDeAcesso(
        conexao.contaId,
        conexao.id,
        criptografia.criptografar(tokens.tokenAcesso),
        tokens.expiraEm,
      );
      return tokens.tokenAcesso;
    } catch (erro) {
      throw traduzirErroDoGoogle(erro);
    }
  }

  private exigirEstadoValido(guardado: EstadoDeAutorizacao | undefined, recebido: string) {
    const idade =
      guardado === undefined ? Infinity : this.dep.relogio.agora().getTime() - guardado.criadoEm;
    if (guardado === undefined || idade > VALIDADE_DO_ESTADO_MS) {
      throw estadoInvalido();
    }
    if (!estadosIguais(guardado.valor, recebido)) {
      throw estadoInvalido();
    }
    return guardado.projetoId as ProjetoId;
  }

  private async revogarConexao(conexao: ConexaoGoogle): Promise<void> {
    const cifrado = conexao.tokenAtualizacaoCifrado;
    if (cifrado !== null) {
      // Se o Google recusar a revogação, os tokens locais são apagados mesmo assim.
      const token = this.dep.criptografia.descriptografar(cifrado);
      await this.dep.fonte.revogar(token).catch((erro: unknown) => {
        this.dep.registrador.warn(
          { categoria: 'google', contaId: conexao.contaId, erro: nomeSeguroDoErro(erro) },
          'o Google não confirmou a revogação do token',
        );
      });
    }
    await this.dep.conexoes.revogar(conexao.contaId, conexao.id, this.dep.relogio.agora());
  }
}

export function criarGoogleOauthServico(dep: DependenciasDoOauth): GoogleOauthServico {
  return new GoogleOauthServicoImpl(dep);
}
