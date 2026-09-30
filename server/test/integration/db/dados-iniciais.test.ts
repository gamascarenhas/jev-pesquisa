import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PLANOS_INICIAIS, semearPlanos } from '../../../src/db/dados-iniciais.js';
import { criarPlanoDeTeste } from '../../helpers/factories.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';

interface LinhaPlano {
  id: string;
  nome: string;
  preco_mensal_centavos: number;
  limite_custo_ia_usd: string;
}

let aplicacao: AppDeTeste;

async function lerPlanosIniciais(): Promise<LinhaPlano[]> {
  const ids = PLANOS_INICIAIS.map((plano) => plano.id);
  const resultado = await aplicacao.banco.query<LinhaPlano>(
    `SELECT id, nome, preco_mensal_centavos, limite_custo_ia_usd
       FROM planos WHERE id = ANY($1) ORDER BY ordem`,
    [ids],
  );
  return resultado.rows;
}

beforeAll(async () => {
  aplicacao = await montarAppDeTeste();
});

afterAll(async () => {
  await aplicacao.encerrar();
});

describe('semearPlanos', () => {
  it('cria os três planos iniciais: trial, basic e pro', async () => {
    const planos = await lerPlanosIniciais();

    expect(planos.map((plano) => plano.id)).toEqual(['trial', 'basic', 'pro']);
  });

  it('rodar duas vezes mantém três planos', async () => {
    await semearPlanos(aplicacao.banco);
    await semearPlanos(aplicacao.banco);

    expect(await lerPlanosIniciais()).toHaveLength(3);
  });

  it('atualiza nome, preço e limite quando o seed mudou, sem tocar em outros planos', async () => {
    const outro = await criarPlanoDeTeste(aplicacao.banco, { nome: 'Plano do teste' });
    await aplicacao.banco.query(
      `UPDATE planos SET nome = 'Antigo', preco_mensal_centavos = 1, limite_custo_ia_usd = 0.5
        WHERE id = 'basic'`,
    );

    await semearPlanos(aplicacao.banco);

    const basico = (await lerPlanosIniciais()).find((plano) => plano.id === 'basic');
    const esperado = PLANOS_INICIAIS.find((plano) => plano.id === 'basic');
    expect(basico).toMatchObject({
      nome: esperado?.nome,
      preco_mensal_centavos: esperado?.precoMensalCentavos,
    });
    expect(Number(basico?.limite_custo_ia_usd)).toBe(Number(esperado?.limiteCustoIaUsd));
    const preservado = await aplicacao.banco.query('SELECT nome FROM planos WHERE id = $1', [
      outro,
    ]);
    expect(preservado.rows[0]).toEqual({ nome: 'Plano do teste' });
  });
});
