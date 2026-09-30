import type { Banco } from './conexoes.js';
import { comTransacao } from './transacao.js';

interface PlanoInicial {
  id: string;
  nome: string;
  precoMensalCentavos: number;
  limiteCustoIaUsd: string;
  ordem: number;
}

// Valores propostos: edite e reinicie. O trial não expira; o limite de custo é o único freio.
export const PLANOS_INICIAIS: readonly PlanoInicial[] = [
  {
    id: 'trial',
    nome: 'Teste gratuito',
    precoMensalCentavos: 0,
    limiteCustoIaUsd: '1.000000',
    ordem: 1,
  },
  {
    id: 'basic',
    nome: 'Básico',
    precoMensalCentavos: 14900,
    limiteCustoIaUsd: '10.000000',
    ordem: 2,
  },
  {
    id: 'pro',
    nome: 'Profissional',
    precoMensalCentavos: 39900,
    limiteCustoIaUsd: '40.000000',
    ordem: 3,
  },
];

export async function semearPlanos(banco: Banco): Promise<void> {
  await comTransacao(banco, async (cliente) => {
    for (const plano of PLANOS_INICIAIS) {
      await cliente.query(
        `INSERT INTO planos (id, nome, preco_mensal_centavos, limite_custo_ia_usd, ordem)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           nome = EXCLUDED.nome,
           preco_mensal_centavos = EXCLUDED.preco_mensal_centavos,
           limite_custo_ia_usd = EXCLUDED.limite_custo_ia_usd`,
        [plano.id, plano.nome, plano.precoMensalCentavos, plano.limiteCustoIaUsd, plano.ordem],
      );
    }
  });
}
