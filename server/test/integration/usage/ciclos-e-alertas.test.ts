import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarAlertasDeConsumo } from '../../../src/modules/usage/alertas-consumo.servico.js';
import { criarConsumoRepositorio } from '../../../src/modules/usage/consumo.repositorio.js';
import type { ContaId } from '../../../src/shared/ids.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import { somarLivro } from '../../helpers/custo.js';
import {
  criarContaDeTeste,
  criarEnviadorEmMemoria,
  criarLancamentoDeConsumoDeTeste,
  criarPlanoDeTeste,
  criarProjetoDeTeste,
  criarRegistradorCapturado,
  criarTrabalhoDeTeste,
  criarUsuarioDeTeste,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

describe('ciclos e avisos de consumo', () => {
  let aplicacao: AppDeTeste;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste();
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function criarContaComLimite(limite: string): Promise<ContaId> {
    const planoId = await criarPlanoDeTeste(aplicacao.banco, {
      limiteCustoIaUsd: limite,
      ativo: false,
    });
    return criarContaDeTeste(aplicacao.banco, { planoId });
  }

  async function statusDoTrabalho(id: string): Promise<string | undefined> {
    const linha = await aplicacao.banco.query<{ status: string }>(
      'SELECT status FROM trabalhos WHERE id = $1',
      [id],
    );
    return linha.rows[0]?.status;
  }

  describe('avisos de 80% e 100%', () => {
    it('chegam uma única vez por ciclo, só aos owners, e voltam no ciclo seguinte', async () => {
      const contaId = await criarContaComLimite('0.100000');
      const dono1 = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'owner' });
      const dono2 = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'owner' });
      const membro = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'member' });
      const enviador = criarEnviadorEmMemoria();
      let agora = Date.now();
      const alertas = criarAlertasDeConsumo({
        consumo: criarConsumoRepositorio(aplicacao.banco),
        listarDonos: async () => {
          const donos = await aplicacao.banco.query<{ email: string; nome: string }>(
            "SELECT email, nome FROM usuarios WHERE conta_id = $1 AND papel = 'owner'",
            [contaId],
          );
          return donos.rows;
        },
        enviador,
        nomeDoNegocio: 'Escuta',
        relogio: { agora: () => new Date(agora) },
        registrador: criarRegistradorCapturado().registrador,
      });
      const verificarDepoisDe = async (): Promise<void> => {
        agora += 10_000;
        await alertas.verificar(contaId);
      };

      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, contaId, { usd: '0.07000000' });
      await verificarDepoisDe();
      expect(enviador.enviadas).toHaveLength(0);

      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, contaId, { usd: '0.01000000' });
      await verificarDepoisDe();
      await verificarDepoisDe();
      expect(enviador.paraEndereco(dono1.email)).toHaveLength(1);
      expect(enviador.paraEndereco(dono2.email)).toHaveLength(1);
      expect(enviador.paraEndereco(membro.email)).toHaveLength(0);
      expect(enviador.enviadas[0]?.texto).toContain('80%');

      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, contaId, { usd: '0.02000000' });
      await verificarDepoisDe();
      await verificarDepoisDe();
      expect(enviador.paraEndereco(dono1.email)).toHaveLength(2);
      expect(enviador.paraEndereco(dono1.email)[1]?.texto).toContain('atingiu o limite');
      expect(enviador.paraEndereco(membro.email)).toHaveLength(0);

      await aplicacao.servicos.controleDeCusto.forcarViradaDeCiclo(contaId);
      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, contaId, { usd: '0.09000000' });
      await verificarDepoisDe();
      expect(enviador.paraEndereco(dono1.email)).toHaveLength(3);
    });

    it('um consumo que passa direto de 79% para mais de 100% envia os dois avisos', async () => {
      const contaId = await criarContaComLimite('0.100000');
      const dono = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'owner' });
      const enviador = criarEnviadorEmMemoria();
      const alertas = criarAlertasDeConsumo({
        consumo: criarConsumoRepositorio(aplicacao.banco),
        listarDonos: () => Promise.resolve([{ email: dono.email, nome: 'Dono' }]),
        enviador,
        nomeDoNegocio: 'Escuta',
        relogio: { agora: () => new Date() },
        registrador: criarRegistradorCapturado().registrador,
      });

      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, contaId, { usd: '0.11000000' });
      await alertas.verificar(contaId);

      expect(enviador.paraEndereco(dono.email)).toHaveLength(2);
    });
  });

  describe('virada de ciclo', () => {
    it('jobs em paused_limit da conta retomam sozinhos e o consumo do ciclo novo começa zerado', async () => {
      const contaId = await criarContaComLimite('0.050000');
      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, contaId, { usd: '0.05000000' });
      const projetoId = await criarProjetoDeTeste(aplicacao.banco, contaId);
      const pausado = await criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        projetoId,
        status: 'paused_limit',
        tipo: 'classify',
      });
      const outraConta = await criarContaComLimite('0.050000');
      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, outraConta, { usd: '0.05000000' });
      const outroProjeto = await criarProjetoDeTeste(aplicacao.banco, outraConta);
      const outroPausado = await criarTrabalhoDeTeste(aplicacao.banco, outraConta, {
        projetoId: outroProjeto,
        status: 'paused_limit',
        tipo: 'classify',
      });

      const virou = await aplicacao.servicos.controleDeCusto.forcarViradaDeCiclo(contaId);

      expect(virou).toBe(true);
      expect(await statusDoTrabalho(pausado)).toBe('pending');
      expect(await statusDoTrabalho(outroPausado)).toBe('paused_limit');
      const consumo = await aplicacao.servicos.controleDeCusto.consumoDoPlano(contaId);
      expect(consumo.porcentagem).toBe(0);
      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.05000000');
    });

    it('a tarefa agendada vira só os ciclos vencidos', async () => {
      const vencida = await criarContaComLimite('1.000000');
      const emDia = await criarContaComLimite('1.000000');
      await aplicacao.banco.query(
        "UPDATE contas SET ciclo_iniciado_em = now() - interval '1 month', ciclo_termina_em = now() - interval '1 minute' WHERE id = $1",
        [vencida],
      );
      const antes = await aplicacao.banco.query<{ inicio: string }>(
        'SELECT ciclo_iniciado_em::text AS inicio FROM contas WHERE id = $1',
        [emDia],
      );

      const virados = await aplicacao.servicos.controleDeCusto.virarCiclosVencidos();

      const depois = await aplicacao.banco.query<{ renovada: boolean; igual: boolean }>(
        `SELECT (SELECT ciclo_termina_em > now() FROM contas WHERE id = $1) AS renovada,
                (SELECT ciclo_iniciado_em::text = $3 FROM contas WHERE id = $2) AS igual`,
        [vencida, emDia, antes.rows[0]?.inicio],
      );
      expect(virados).toBeGreaterThanOrEqual(1);
      expect(depois.rows[0]).toEqual({ renovada: true, igual: true });
      expect(await aplicacao.servicos.controleDeCusto.virarCiclosVencidos()).toBe(0);
    });

    it('vira o ciclo uma única vez quando duas viradas correm juntas', async () => {
      const contaId = await criarContaComLimite('1.000000');
      await aplicacao.banco.query(
        "UPDATE contas SET ciclo_iniciado_em = now() - interval '1 month', ciclo_termina_em = now() - interval '1 minute' WHERE id = $1",
        [contaId],
      );

      await Promise.all([
        aplicacao.servicos.controleDeCusto.virarCiclosVencidos(),
        aplicacao.servicos.controleDeCusto.virarCiclosVencidos(),
      ]);

      const ciclo = await aplicacao.banco.query<{ total: string }>(
        `SELECT count(*) AS total FROM contas
          WHERE id = $1 AND ciclo_termina_em > now() + interval '27 days'`,
        [contaId],
      );
      expect(ciclo.rows[0]?.total).toBe('1');
    });
  });

  describe('GET /api/consumo', () => {
    it('devolve só porcentagem, limite atingido e renovação, nunca dólar, tokens ou modelo', async () => {
      const contaId = await criarContaComLimite('0.100000');
      const usuario = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'member' });
      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, contaId, { usd: '0.05000000' });
      const cookie = await entrar(aplicacao, usuario.email);

      const resposta = await chamar(aplicacao, { metodo: 'GET', url: '/api/consumo', cookie });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json<Record<string, unknown>>();
      expect(Object.keys(corpo).sort()).toEqual([
        'cicloTerminaEm',
        'limiteAtingido',
        'porcentagem',
      ]);
      expect(corpo.porcentagem).toBe(50);
      expect(corpo.limiteAtingido).toBe(false);
      expect(resposta.body).not.toMatch(/usd|token|modelo|jev|0\.05/i);
    });

    it('exige login', async () => {
      const resposta = await chamar(aplicacao, { metodo: 'GET', url: '/api/consumo' });

      expect(resposta.statusCode).toBe(401);
    });
  });
});
