import { EventEmitter } from 'node:events';
import type { AddressInfo } from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';

import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { criarDesligamento, registrarSinaisDeEncerramento } from '../../../src/app.js';
import { criarRegistradorCapturado } from '../../helpers/factories.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';

const DURACAO_DA_REQUISICAO_LENTA_MS = 400;

function registrarRotaLenta(app: FastifyInstance, aoIniciar: () => void): void {
  app.get('/teste/lenta', async () => {
    aoIniciar();
    await esperar(DURACAO_DA_REQUISICAO_LENTA_MS);
    return { concluida: true };
  });
}

async function escutar(aplicacao: AppDeTeste): Promise<string> {
  await aplicacao.app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = aplicacao.app.server.address() as AddressInfo;
  return `http://127.0.0.1:${String(port)}`;
}

describe('encerramento gracioso', () => {
  it('espera a requisição em andamento terminar, fecha o pool e recusa novas conexões', async () => {
    let requisicaoIniciou!: () => void;
    const iniciou = new Promise<void>((resolver) => {
      requisicaoIniciou = resolver;
    });
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      rotasExtras: (app) => {
        registrarRotaLenta(app, requisicaoIniciou);
      },
    });
    const base = await escutar(aplicacao);
    const desligar = criarDesligamento(aplicacao);

    const emAndamento = fetch(`${base}/teste/lenta`);
    await iniciou;
    const desligamento = desligar();
    const resposta = await emAndamento;
    await desligamento;

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ concluida: true });
    await expect(fetch(`${base}/api/configuracao-publica`)).rejects.toThrow();
    await expect(aplicacao.banco.query('SELECT 1')).rejects.toThrow();
  });

  it('chamar o desligamento duas vezes não fecha o pool duas vezes', async () => {
    const aplicacao = await montarAppDeTeste({ prepararBanco: false });
    const desligar = criarDesligamento(aplicacao);

    await Promise.all([desligar(), desligar()]);
    await expect(desligar()).resolves.toBeUndefined();
  });

  it('passado o limite de tempo, encerra mesmo com requisição pendente e avisa no log', async () => {
    const { registrador, linhas } = criarRegistradorCapturado();
    let requisicaoIniciou!: () => void;
    const iniciou = new Promise<void>((resolver) => {
      requisicaoIniciou = resolver;
    });
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      registrador,
      rotasExtras: (app) => {
        registrarRotaLenta(app, requisicaoIniciou);
      },
    });
    const base = await escutar(aplicacao);

    const pendente = fetch(`${base}/teste/lenta`).catch(() => undefined);
    await iniciou;
    await criarDesligamento(aplicacao, 50)();
    await pendente;

    expect(linhas().some((linha) => String(linha.msg).includes('não terminaram a tempo'))).toBe(
      true,
    );
  });
});

describe('sinais de encerramento', () => {
  it('registra SIGTERM e SIGINT e sai com código 0 depois do desligamento', async () => {
    const alvo = new EventEmitter();
    let desligou = 0;
    const codigos: number[] = [];
    registrarSinaisDeEncerramento(
      () => {
        desligou += 1;
        return Promise.resolve();
      },
      { once: (sinal, ouvinte) => alvo.once(sinal, ouvinte) },
      (codigo) => codigos.push(codigo),
    );

    expect(alvo.listenerCount('SIGTERM')).toBe(1);
    expect(alvo.listenerCount('SIGINT')).toBe(1);

    alvo.emit('SIGTERM');
    await esperar(0);

    expect(desligou).toBe(1);
    expect(codigos).toEqual([0]);
  });

  it('sai com código 1 se o desligamento falhar', async () => {
    const alvo = new EventEmitter();
    const codigos: number[] = [];
    registrarSinaisDeEncerramento(
      () => Promise.reject(new Error('falhou')),
      { once: (sinal, ouvinte) => alvo.once(sinal, ouvinte) },
      (codigo) => codigos.push(codigo),
    );

    alvo.emit('SIGINT');
    await esperar(0);

    expect(codigos).toEqual([1]);
  });
});
