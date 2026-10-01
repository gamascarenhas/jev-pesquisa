import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { criarDesligamento } from '../../../src/app.js';
import { aguardarAte } from '../../helpers/aguardar.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarContaDeTeste,
  criarProjetoDeTeste,
  criarTrabalhoDeTeste,
  criarUsuarioDeTeste,
  gerarUuid,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

describe('trabalhos', () => {
  let aplicacao: AppDeTeste;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste();
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });
  beforeEach(async () => {
    await aplicacao.banco.query('DELETE FROM trabalhos');
  });

  async function criarContaComProjeto() {
    const contaId = await criarContaDeTeste(aplicacao.banco);
    const usuario = await criarUsuarioDeTeste(aplicacao.banco, contaId);
    const projetoId = await criarProjetoDeTeste(aplicacao.banco, contaId);
    return { contaId, usuario, projetoId };
  }

  describe('índices únicos de job ativo', () => {
    it('o banco recusa um segundo job de classificação ativo no mesmo projeto', async () => {
      const { contaId, projetoId } = await criarContaComProjeto();
      const primeiro = await criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        projetoId,
        tipo: 'classify',
      });

      const segundo = criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        projetoId,
        tipo: 'classify',
        status: 'running',
      });
      await expect(segundo).rejects.toThrow(/trabalhos_classificacao_ativa_unica/);

      await aplicacao.banco.query("UPDATE trabalhos SET status = 'done' WHERE id = $1", [primeiro]);
      await expect(
        criarTrabalhoDeTeste(aplicacao.banco, contaId, { projetoId, tipo: 'classify' }),
      ).resolves.toBeTypeOf('string');
    });

    it('o banco recusa uma segunda sincronização do Google ativa e uma segunda execução da mesma pergunta', async () => {
      const { contaId, projetoId } = await criarContaComProjeto();
      const perguntaId = gerarUuid();
      await criarTrabalhoDeTeste(aplicacao.banco, contaId, { projetoId, tipo: 'google_sync' });
      await criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        projetoId,
        tipo: 'ask',
        carga: { perguntaId },
      });

      const sincronizacao = criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        projetoId,
        tipo: 'google_sync',
        status: 'paused_limit',
      });
      const pergunta = criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        projetoId,
        tipo: 'ask',
        carga: { perguntaId },
      });

      await expect(sincronizacao).rejects.toThrow(/trabalhos_sincronizacao_ativa_unica/);
      await expect(pergunta).rejects.toThrow(/trabalhos_pergunta_ativa_unica/);
    });

    it('criar o job devolve o existente em vez de falhar', async () => {
      const { contaId, projetoId } = await criarContaComProjeto();
      const perguntaId = gerarUuid();
      const { trabalhos } = aplicacao.servicos;

      const primeiro = await trabalhos.criar(contaId, { tipo: 'classify', projetoId });
      const segundo = await trabalhos.criar(contaId, { tipo: 'classify', projetoId });
      const pergunta = await trabalhos.criar(contaId, {
        tipo: 'ask',
        projetoId,
        carga: { perguntaId },
      });
      const repetida = await trabalhos.criar(contaId, {
        tipo: 'ask',
        projetoId,
        carga: { perguntaId },
      });

      expect(primeiro.jaExistia).toBe(false);
      expect(segundo).toMatchObject({ jaExistia: true, trabalho: { id: primeiro.trabalho.id } });
      expect(pergunta.jaExistia).toBe(false);
      expect(repetida).toMatchObject({ jaExistia: true, trabalho: { id: pergunta.trabalho.id } });
      const total = await aplicacao.banco.query('SELECT 1 FROM trabalhos');
      expect(total.rowCount).toBe(2);
    });

    it('criar corridas simultâneas resulta em um único job ativo', async () => {
      const { contaId, projetoId } = await criarContaComProjeto();

      const resultados = await Promise.all(
        Array.from({ length: 8 }, () =>
          aplicacao.servicos.trabalhos.criar(contaId, { tipo: 'classify', projetoId }),
        ),
      );

      expect(new Set(resultados.map((r) => r.trabalho.id)).size).toBe(1);
      expect(resultados.filter((r) => !r.jaExistia)).toHaveLength(1);
    });

    it('exige o projeto ou a pergunta que identifica o job', async () => {
      const { contaId } = await criarContaComProjeto();

      await expect(
        aplicacao.servicos.trabalhos.criar(contaId, { tipo: 'classify' }),
      ).rejects.toThrow(/projeto ou da pergunta/);
      await expect(aplicacao.servicos.trabalhos.criar(contaId, { tipo: 'ask' })).rejects.toThrow(
        /projeto ou da pergunta/,
      );
    });
  });

  describe('isolamento', () => {
    it('o banco recusa um job de uma conta apontando para um projeto de outra conta', async () => {
      const a = await criarContaComProjeto();
      const contaB = await criarContaDeTeste(aplicacao.banco);

      const cruzado = criarTrabalhoDeTeste(aplicacao.banco, contaB, { projetoId: a.projetoId });

      await expect(cruzado).rejects.toThrow(/foreign key/i);
    });

    it('criar o job com projeto de outra conta responde como projeto não encontrado', async () => {
      const a = await criarContaComProjeto();
      const contaB = await criarContaDeTeste(aplicacao.banco);

      const cruzado = aplicacao.servicos.trabalhos.criar(contaB, {
        tipo: 'summarize',
        projetoId: a.projetoId,
      });

      await expect(cruzado).rejects.toMatchObject({ codigo: 'projeto_nao_encontrado' });
    });

    it('a rota de status só devolve jobs da própria conta', async () => {
      const a = await criarContaComProjeto();
      const b = await criarContaComProjeto();
      const jobA = await criarTrabalhoDeTeste(aplicacao.banco, a.contaId, {
        projetoId: a.projetoId,
        tipo: 'classify',
        status: 'running',
      });
      await aplicacao.banco.query(
        'UPDATE trabalhos SET progresso_total = 50, progresso_feito = 20 WHERE id = $1',
        [jobA],
      );
      const cookieA = await entrar(aplicacao, a.usuario.email);
      const cookieB = await entrar(aplicacao, b.usuario.email);

      const propria = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/trabalhos/${jobA}`,
        cookie: cookieA,
      });
      const alheia = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/trabalhos/${jobA}`,
        cookie: cookieB,
      });

      expect(propria.statusCode).toBe(200);
      expect(propria.json()).toEqual({
        id: jobA,
        tipo: 'classify',
        status: 'running',
        projetoId: a.projetoId,
        progresso: { total: 50, feito: 20 },
        criadoEm: expect.any(String) as string,
        iniciadoEm: null,
        finalizadoEm: null,
      });
      expect(alheia.statusCode).toBe(404);
      expect(alheia.json<{ erro: { codigo: string } }>().erro.codigo).toBe(
        'trabalho_nao_encontrado',
      );
    });

    it('a rota exige autenticação e um id válido', async () => {
      const { usuario, contaId } = await criarContaComProjeto();
      const job = await criarTrabalhoDeTeste(aplicacao.banco, contaId);
      const cookie = await entrar(aplicacao, usuario.email);

      const semSessao = await chamar(aplicacao, { metodo: 'GET', url: `/api/trabalhos/${job}` });
      const idInvalido = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/trabalhos/nao-e-uuid',
        cookie,
      });
      const inexistente = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/trabalhos/${gerarUuid()}`,
        cookie,
      });

      expect(semSessao.statusCode).toBe(401);
      expect(idInvalido.statusCode).toBe(400);
      expect(inexistente.statusCode).toBe(404);
    });
  });

  describe('composição no app', () => {
    it('executa jobs pelo mapa de manipuladores recebido e o desligamento para o executor', async () => {
      const executados: string[] = [];
      const comExecutor = await montarAppDeTeste({
        manipuladoresDeTrabalho: {
          summarize: ({ trabalho }) => {
            executados.push(trabalho.id);
            return Promise.resolve();
          },
        },
      });
      const { contaId } = await criarContaComProjeto();
      const id = await criarTrabalhoDeTeste(comExecutor.banco, contaId);

      await comExecutor.executorDeTrabalhos.iniciar();
      await aguardarAte(async () => {
        const linha = await comExecutor.banco.query<{ status: string }>(
          'SELECT status FROM trabalhos WHERE id = $1',
          [id],
        );
        return linha.rows[0]?.status === 'done';
      });
      await criarDesligamento(comExecutor)();

      expect(executados).toEqual([id]);
    });
  });
});
