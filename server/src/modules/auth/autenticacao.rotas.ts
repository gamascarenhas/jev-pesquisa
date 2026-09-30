import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { iniciarSessao } from '../../http/plugins/sessao.plugin.js';
import {
  LIMITES,
  limitePorEmail,
  limitePorIp,
} from '../../http/plugins/limite-requisicoes.plugin.js';
import type { Relogio } from '../../shared/clock.js';
import {
  esquemaAceitarConvite,
  esquemaCadastro,
  esquemaLogin,
  esquemaRedefinirSenha,
  esquemaSomenteEmail,
  esquemaSomenteToken,
  MENSAGEM_SE_O_EMAIL_EXISTIR,
  paraUsuarioDto,
} from './autenticacao.esquemas.js';
import type { AutenticacaoServico } from './autenticacao.servico.js';
import type { ConvitesServico } from './convites.servico.js';
import type { PerfilServico } from './perfil.servico.js';

export interface DependenciasAutenticacaoRotas {
  servico: AutenticacaoServico;
  convites: ConvitesServico;
  perfil: PerfilServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
  relogio: Relogio;
}

const MENSAGEM_CADASTRO = 'Recebemos o cadastro. Enviamos as instruções para o e-mail informado.';

function registrarCadastroELogin(app: FastifyInstance, dep: DependenciasAutenticacaoRotas): void {
  const limites = LIMITES.cadastro;
  app.post(
    '/auth/cadastro',
    {
      ...limitePorIp(limites.porIp),
      preHandler: [limitePorEmail(app, 'cadastro', limites.porEmail)],
    },
    async (requisicao, resposta) => {
      const entrada = esquemaCadastro.parse(requisicao.body);
      await dep.servico.cadastrar({
        nomeEmpresa: entrada.nomeEmpresa,
        nomeUsuario: entrada.nomeUsuario,
        email: entrada.email,
        senha: entrada.senha,
      });
      return resposta.status(202).send({ mensagem: MENSAGEM_CADASTRO });
    },
  );

  app.post('/auth/login', async (requisicao) => {
    const { email, senha } = esquemaLogin.parse(requisicao.body);
    const usuario = await dep.servico.entrar(email, senha);
    await iniciarSessao(
      requisicao,
      { usuarioId: usuario.id, contaId: usuario.contaId },
      dep.relogio.agora(),
    );
    return paraUsuarioDto(usuario);
  });

  app.post('/auth/logout', async (requisicao, resposta) => {
    await requisicao.session.destroy();
    return resposta.status(204).send();
  });

  app.get('/auth/eu', { preHandler: [dep.exigirAutenticacao] }, async (requisicao) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    return paraUsuarioDto(await dep.servico.obterUsuario(contaId, usuarioId));
  });
}

function registrarFluxosDeEmail(app: FastifyInstance, dep: DependenciasAutenticacaoRotas): void {
  app.post('/auth/confirmar-email', async (requisicao, resposta) => {
    await dep.servico.confirmarEmail(esquemaSomenteToken.parse(requisicao.body).token);
    return resposta.status(204).send();
  });

  const reenvio = LIMITES.reenvioConfirmacao;
  app.post(
    '/auth/reenviar-confirmacao',
    {
      ...limitePorIp(reenvio.porIp),
      preHandler: [limitePorEmail(app, 'reenvio-confirmacao', reenvio.porEmail)],
    },
    async (requisicao, resposta) => {
      await dep.servico.reenviarConfirmacao(esquemaSomenteEmail.parse(requisicao.body).email);
      return resposta.status(202).send({ mensagem: MENSAGEM_SE_O_EMAIL_EXISTIR });
    },
  );

  const redefinicao = LIMITES.redefinicaoSenha;
  app.post(
    '/auth/esqueci-senha',
    {
      ...limitePorIp(redefinicao.porIp),
      preHandler: [limitePorEmail(app, 'redefinicao-senha', redefinicao.porEmail)],
    },
    async (requisicao, resposta) => {
      await dep.servico.solicitarRedefinicao(esquemaSomenteEmail.parse(requisicao.body).email);
      return resposta.status(202).send({ mensagem: MENSAGEM_SE_O_EMAIL_EXISTIR });
    },
  );

  app.post('/auth/redefinir-senha', async (requisicao, resposta) => {
    const { token, novaSenha } = esquemaRedefinirSenha.parse(requisicao.body);
    await dep.servico.redefinirSenha(token, novaSenha);
    return resposta.status(204).send();
  });
}

function registrarConvitesETrocaDeEmail(
  app: FastifyInstance,
  dep: DependenciasAutenticacaoRotas,
): void {
  app.post('/auth/aceitar-convite', async (requisicao, resposta) => {
    const { token, nome, senha } = esquemaAceitarConvite.parse(requisicao.body);
    await dep.convites.aceitar(token, { nome, senha });
    return resposta.status(204).send();
  });

  app.post('/auth/confirmar-troca-email', async (requisicao, resposta) => {
    await dep.perfil.confirmarTrocaDeEmail(esquemaSomenteToken.parse(requisicao.body).token);
    return resposta.status(204).send();
  });
}

export function registrarRotasDeAutenticacao(
  app: FastifyInstance,
  dependencias: DependenciasAutenticacaoRotas,
): void {
  registrarCadastroELogin(app, dependencias);
  registrarFluxosDeEmail(app, dependencias);
  registrarConvitesETrocaDeEmail(app, dependencias);
}
