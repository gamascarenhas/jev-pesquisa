import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Relogio } from '../../../src/shared/clock.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import { criarEnviadorEmMemoria, type EnviadorEmMemoria } from '../../helpers/factories.js';
import { chamar } from '../../helpers/login.js';

const AGORA = new Date('2026-03-10T12:00:00.000Z');
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function cadastroValido(email: string): Record<string, unknown> {
  return {
    nomeEmpresa: 'Padaria Central',
    nomeUsuario: 'Maria',
    email,
    senha: 'senha-longa-123',
    aceiteTermos: true,
  };
}

describe('cadastro e confirmação de e-mail', () => {
  let aplicacao: AppDeTeste;
  let enviador: EnviadorEmMemoria;
  let agora: Date;
  let ipsUsados = 0;
  const relogio: Relogio = { agora: () => new Date(agora) };

  beforeAll(async () => {
    enviador = criarEnviadorEmMemoria();
    agora = new Date(AGORA);
    aplicacao = await montarAppDeTeste({ enviadorDeEmail: enviador, relogio });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  // Um IP por cadastro: o limite por IP é coberto em limites.test.ts.
  async function cadastrar(email: string, corpo = cadastroValido(email)) {
    ipsUsados += 1;
    return chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/cadastro',
      corpo,
      ip: `10.0.0.${String(ipsUsados)}`,
    });
  }

  it('cadastra conta, owner, plano padrão e grava o aceite dos termos com a versão', async () => {
    const resposta = await cadastrar('novo@exemplo.com.br');

    expect(resposta.statusCode).toBe(202);
    const usuario = await aplicacao.banco.query<{
      papel: string;
      termos_aceitos_em: Date;
      versao_termos: string;
      email_confirmado_em: Date | null;
      plano_id: string;
    }>(
      `SELECT u.papel, u.termos_aceitos_em, u.versao_termos, u.email_confirmado_em, c.plano_id
         FROM usuarios u JOIN contas c ON c.id = u.conta_id WHERE u.email = $1`,
      ['novo@exemplo.com.br'],
    );
    expect(usuario.rows[0]).toMatchObject({
      papel: 'owner',
      versao_termos: aplicacao.configuracao.versaoTermos,
      email_confirmado_em: null,
      plano_id: aplicacao.configuracao.planoPadraoId,
    });
    expect(usuario.rows[0]?.termos_aceitos_em).toEqual(AGORA);
  });

  it('recusa cadastro sem aceite dos termos e não cria nada', async () => {
    const corpo = { ...cadastroValido('sem-aceite@exemplo.com.br'), aceiteTermos: false };
    const semCampo = { ...corpo } as Record<string, unknown>;
    delete semCampo.aceiteTermos;

    const recusado = await cadastrar('sem-aceite@exemplo.com.br', corpo);
    const ausente = await cadastrar('sem-aceite@exemplo.com.br', semCampo);

    expect(recusado.statusCode).toBe(400);
    expect(ausente.statusCode).toBe(400);
    const existe = await aplicacao.banco.query('SELECT 1 FROM usuarios WHERE email = $1', [
      'sem-aceite@exemplo.com.br',
    ]);
    expect(existe.rowCount).toBe(0);
  });

  it('recusa senha com menos de 10 caracteres', async () => {
    const resposta = await cadastrar('curta@exemplo.com.br', {
      ...cadastroValido('curta@exemplo.com.br'),
      senha: '123456789',
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('cadastro com e-mail existente responde igual e avisa o endereço, sem criar outra conta', async () => {
    await cadastrar('existente@exemplo.com.br');
    const contasAntes = await aplicacao.banco.query('SELECT 1 FROM contas');

    const segunda = await cadastrar('existente@exemplo.com.br');
    const primeira = await cadastrar('outro-novo@exemplo.com.br');

    expect(segunda.statusCode).toBe(primeira.statusCode);
    expect(segunda.json()).toEqual(primeira.json());
    const contasDepois = await aplicacao.banco.query('SELECT 1 FROM contas');
    expect(contasDepois.rowCount).toBe((contasAntes.rowCount ?? 0) + 1);
    const mensagens = enviador.paraEndereco('existente@exemplo.com.br');
    expect(mensagens).toHaveLength(2);
    expect(mensagens[1]?.assunto).toContain('Já existe uma conta');
    expect(mensagens[1]?.texto).not.toContain('token=');
  });

  it('o e-mail usa NOME_NEGOCIO no assunto e no corpo', async () => {
    await cadastrar('nome-negocio@exemplo.com.br');

    const mensagem = enviador.paraEndereco('nome-negocio@exemplo.com.br')[0];

    expect(mensagem?.assunto).toContain(aplicacao.configuracao.nomeNegocio);
    expect(mensagem?.texto).toContain(aplicacao.configuracao.nomeNegocio);
  });

  it('o link confirma o e-mail e só funciona uma vez', async () => {
    await cadastrar('confirma@exemplo.com.br');
    const token = enviador.tokenDaUltimaMensagem('confirma@exemplo.com.br');

    const primeira = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/confirmar-email',
      corpo: { token },
    });
    const segunda = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/confirmar-email',
      corpo: { token },
    });

    expect(primeira.statusCode).toBe(204);
    expect(segunda.statusCode).toBe(400);
    expect(segunda.json<{ erro: { codigo: string } }>().erro.codigo).toBe('link_invalido');
    const linha = await aplicacao.banco.query<{ email_confirmado_em: Date }>(
      'SELECT email_confirmado_em FROM usuarios WHERE email = $1',
      ['confirma@exemplo.com.br'],
    );
    expect(linha.rows[0]?.email_confirmado_em).toEqual(AGORA);
  });

  it('o link de confirmação expira depois de 24 horas', async () => {
    await cadastrar('expira@exemplo.com.br');
    const token = enviador.tokenDaUltimaMensagem('expira@exemplo.com.br');

    agora = new Date(AGORA.getTime() + UM_DIA_MS + 1000);
    const resposta = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/confirmar-email',
      corpo: { token },
    });
    agora = new Date(AGORA);

    expect(resposta.statusCode).toBe(400);
  });

  it('token desconhecido e token de outro tipo dão o mesmo erro', async () => {
    await cadastrar('tipo-errado@exemplo.com.br');
    const tokenDeConfirmacao = enviador.tokenDaUltimaMensagem('tipo-errado@exemplo.com.br');

    const desconhecido = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/redefinir-senha',
      corpo: { token: 'desconhecido', novaSenha: 'outra-senha-123' },
    });
    const tipoErrado = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/redefinir-senha',
      corpo: { token: tokenDeConfirmacao, novaSenha: 'outra-senha-123' },
    });

    expect(tipoErrado.statusCode).toBe(desconhecido.statusCode);
    expect(tipoErrado.json()).toMatchObject({
      erro: { codigo: desconhecido.json<{ erro: { codigo: string } }>().erro.codigo },
    });
  });

  it('reenvio de confirmação responde igual para e-mail existente e inexistente', async () => {
    await cadastrar('reenvio@exemplo.com.br');
    const antes = enviador.paraEndereco('reenvio@exemplo.com.br').length;

    const existente = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/reenviar-confirmacao',
      corpo: { email: 'reenvio@exemplo.com.br' },
    });
    const inexistente = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/reenviar-confirmacao',
      corpo: { email: 'ninguem@exemplo.com.br' },
    });

    expect(existente.statusCode).toBe(202);
    expect(inexistente.statusCode).toBe(202);
    expect(existente.json()).toEqual(inexistente.json());
    expect(enviador.paraEndereco('reenvio@exemplo.com.br')).toHaveLength(antes + 1);
    expect(enviador.paraEndereco('ninguem@exemplo.com.br')).toHaveLength(0);
  });

  it('o reenvio invalida o link anterior', async () => {
    await cadastrar('reenvio-antigo@exemplo.com.br');
    const antigo = enviador.tokenDaUltimaMensagem('reenvio-antigo@exemplo.com.br');
    await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/reenviar-confirmacao',
      corpo: { email: 'reenvio-antigo@exemplo.com.br' },
    });
    const novo = enviador.tokenDaUltimaMensagem('reenvio-antigo@exemplo.com.br');

    const comAntigo = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/confirmar-email',
      corpo: { token: antigo },
    });
    const comNovo = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/confirmar-email',
      corpo: { token: novo },
    });

    expect(comAntigo.statusCode).toBe(400);
    expect(comNovo.statusCode).toBe(204);
  });
});
