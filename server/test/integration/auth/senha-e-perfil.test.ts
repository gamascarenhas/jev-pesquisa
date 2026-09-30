import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Relogio } from '../../../src/shared/clock.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarContaComDonoDeTeste,
  criarEnviadorEmMemoria,
  criarRegistradorCapturado,
  SENHA_DE_TESTE,
  type EnviadorEmMemoria,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

const INICIO = new Date('2026-06-01T10:00:00.000Z');
const UMA_HORA_MS = 60 * 60 * 1000;
const UM_DIA_MS = 24 * UMA_HORA_MS;
const NOVA_SENHA = 'nova-senha-segura-456';

describe('redefinição de senha e perfil', () => {
  let aplicacao: AppDeTeste;
  let enviador: EnviadorEmMemoria;
  let agora: Date;
  const relogio: Relogio = { agora: () => new Date(agora) };
  const captura = criarRegistradorCapturado();

  beforeAll(async () => {
    enviador = criarEnviadorEmMemoria();
    agora = new Date(INICIO);
    aplicacao = await montarAppDeTeste({
      enviadorDeEmail: enviador,
      relogio,
      registrador: captura.registrador,
    });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  function pedirRedefinicao(email: string) {
    return chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/esqueci-senha',
      corpo: { email },
    });
  }

  function redefinir(token: string, novaSenha = NOVA_SENHA) {
    return chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/redefinir-senha',
      corpo: { token, novaSenha },
    });
  }

  function existeSessao(usuarioId: string) {
    return aplicacao.banco
      .query('SELECT 1 FROM sessoes WHERE usuario_id = $1', [usuarioId])
      .then((r) => r.rowCount ?? 0);
  }

  describe('redefinir a senha', () => {
    it('responde igual para e-mail existente e inexistente e só envia ao existente', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);

      const existente = await pedirRedefinicao(usuario.email);
      const inexistente = await pedirRedefinicao('ninguem-reset@exemplo.com.br');

      expect(existente.statusCode).toBe(202);
      expect(inexistente.statusCode).toBe(202);
      expect(existente.json()).toEqual(inexistente.json());
      expect(enviador.paraEndereco(usuario.email)).toHaveLength(1);
      expect(enviador.paraEndereco('ninguem-reset@exemplo.com.br')).toHaveLength(0);
    });

    it('troca a senha, encerra todas as sessões do usuário e vale uma única vez', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      await entrar(aplicacao, usuario.email);
      await entrar(aplicacao, usuario.email);
      await pedirRedefinicao(usuario.email);
      const token = enviador.tokenDaUltimaMensagem(usuario.email);

      const primeira = await redefinir(token);
      const segunda = await redefinir(token, 'outra-senha-segura-789');

      expect(primeira.statusCode).toBe(204);
      expect(segunda.statusCode).toBe(400);
      expect(await existeSessao(usuario.id)).toBe(0);
      const antiga = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/login',
        corpo: { email: usuario.email, senha: SENHA_DE_TESTE },
      });
      const nova = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/login',
        corpo: { email: usuario.email, senha: NOVA_SENHA },
      });
      expect(antiga.statusCode).toBe(401);
      expect(nova.statusCode).toBe(200);
    });

    it('o link expira em 1 hora', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      await pedirRedefinicao(usuario.email);
      const token = enviador.tokenDaUltimaMensagem(usuario.email);

      agora = new Date(INICIO.getTime() + UMA_HORA_MS + 1000);
      const resposta = await redefinir(token);
      agora = new Date(INICIO);

      expect(resposta.statusCode).toBe(400);
    });

    it('recusa a nova senha com menos de 10 caracteres sem gastar o link', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      await pedirRedefinicao(usuario.email);
      const token = enviador.tokenDaUltimaMensagem(usuario.email);

      const curta = await redefinir(token, '123456789');
      const valida = await redefinir(token);

      expect(curta.statusCode).toBe(400);
      expect(valida.statusCode).toBe(204);
    });

    it('a redefinição zera o bloqueio por tentativas', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      await aplicacao.banco.query(
        `UPDATE usuarios SET bloqueado_ate = $2, tentativas_login_falhas = 3 WHERE id = $1`,
        [usuario.id, new Date(INICIO.getTime() + UM_DIA_MS)],
      );
      await pedirRedefinicao(usuario.email);
      await redefinir(enviador.tokenDaUltimaMensagem(usuario.email));

      const login = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/login',
        corpo: { email: usuario.email, senha: NOVA_SENHA },
      });

      expect(login.statusCode).toBe(200);
    });

    it('registra a auditoria da redefinição sem e-mail nem token', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      await pedirRedefinicao(usuario.email);
      const token = enviador.tokenDaUltimaMensagem(usuario.email);
      await redefinir(token);

      const eventos = captura
        .linhas()
        .filter((linha) => linha.acao === 'senha_redefinida' && linha.usuarioId === usuario.id);

      expect(eventos).toHaveLength(1);
      const texto = JSON.stringify(eventos);
      expect(texto).not.toContain(usuario.email);
      expect(texto).not.toContain(token);
    });
  });

  describe('trocar a própria senha', () => {
    it('exige a senha atual e encerra as outras sessões, mantendo a atual', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      const atual = await entrar(aplicacao, usuario.email);
      const outra = await entrar(aplicacao, usuario.email);

      const errada = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/senha',
        cookie: atual,
        corpo: { senhaAtual: 'senha-errada-123', novaSenha: NOVA_SENHA },
      });
      const correta = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/senha',
        cookie: atual,
        corpo: { senhaAtual: usuario.senha, novaSenha: NOVA_SENHA },
      });

      expect(errada.statusCode).toBe(403);
      expect(correta.statusCode).toBe(204);
      const aindaLogada = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/auth/eu',
        cookie: atual,
      });
      const derrubada = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/auth/eu',
        cookie: outra,
      });
      expect(aindaLogada.statusCode).toBe(200);
      expect(derrubada.statusCode).toBe(401);
      await expect(entrar(aplicacao, usuario.email, NOVA_SENHA)).resolves.toBeTypeOf('string');
    });

    it('recusa nova senha curta e exige login', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, usuario.email);

      const curta = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/senha',
        cookie,
        corpo: { senhaAtual: usuario.senha, novaSenha: 'curta' },
      });
      const anonima = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/senha',
        corpo: { senhaAtual: usuario.senha, novaSenha: NOVA_SENHA },
      });

      expect(curta.statusCode).toBe(400);
      expect(anonima.statusCode).toBe(401);
    });
  });

  describe('trocar o próprio e-mail', () => {
    it('só vale depois do clique no link enviado ao novo endereço, e o link é de uso único', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, usuario.email);
      const novoEmail = `novo-${usuario.id}@exemplo.com.br`;

      const pedido = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/email',
        cookie,
        corpo: { novoEmail, senha: usuario.senha },
      });
      const antesDoClique = await chamar(aplicacao, { metodo: 'GET', url: '/api/auth/eu', cookie });
      const token = enviador.tokenDaUltimaMensagem(novoEmail);
      const clique = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/confirmar-troca-email',
        corpo: { token },
      });
      const segundoClique = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/confirmar-troca-email',
        corpo: { token },
      });
      const depoisDoClique = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/auth/eu',
        cookie,
      });

      expect(pedido.statusCode).toBe(202);
      expect(antesDoClique.json()).toMatchObject({ email: usuario.email });
      expect(clique.statusCode).toBe(204);
      expect(segundoClique.statusCode).toBe(400);
      expect(depoisDoClique.json()).toMatchObject({ email: novoEmail, emailConfirmado: true });
      expect(enviador.paraEndereco(usuario.email).at(-1)?.assunto ?? '').not.toContain(
        'novo e-mail',
      );
    });

    it('exige a senha e responde igual quando o novo e-mail já pertence a alguém', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      const outro = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, usuario.email);

      const semSenha = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/email',
        cookie,
        corpo: { novoEmail: 'qualquer@exemplo.com.br', senha: 'errada-errada-123' },
      });
      const livre = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/email',
        cookie,
        corpo: { novoEmail: `livre-${usuario.id}@exemplo.com.br`, senha: usuario.senha },
      });
      const ocupado = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/email',
        cookie,
        corpo: { novoEmail: outro.email, senha: usuario.senha },
      });

      expect(semSenha.statusCode).toBe(403);
      expect(ocupado.statusCode).toBe(livre.statusCode);
      expect(ocupado.json()).toEqual(livre.json());
      const aviso = enviador.paraEndereco(outro.email).at(-1);
      expect(aviso?.texto).not.toContain('token=');
    });

    it('o link de troca expira em 24 horas', async () => {
      const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, usuario.email);
      const novoEmail = `expira-${usuario.id}@exemplo.com.br`;
      await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/email',
        cookie,
        corpo: { novoEmail, senha: usuario.senha },
      });
      const token = enviador.tokenDaUltimaMensagem(novoEmail);

      agora = new Date(INICIO.getTime() + UM_DIA_MS + 1000);
      const resposta = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/confirmar-troca-email',
        corpo: { token },
      });
      agora = new Date(INICIO);

      expect(resposta.statusCode).toBe(400);
    });
  });
});
