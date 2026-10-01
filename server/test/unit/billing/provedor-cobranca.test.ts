import { describe, expect, it } from 'vitest';

import { comoContaId } from '../../../src/shared/ids.js';
import { escolherProvedorDeCobranca } from '../../../src/modules/billing/provedor-cobranca.js';
import { ErroServicoIndisponivel } from '../../../src/shared/errors.js';
import { montarAppDeTeste } from '../../helpers/build-app.js';
import { gerarUuid } from '../../helpers/factories.js';

describe('provedor de cobrança', () => {
  it('com COBRANCA_ATIVADA=true e sem provedor real, o sistema não sobe', async () => {
    expect(() => escolherProvedorDeCobranca(true)).toThrow('COBRANCA_ATIVADA=true');
    await expect(
      montarAppDeTeste({ configuracao: { cobrancaAtivada: true }, prepararBanco: false }),
    ).rejects.toThrow('COBRANCA_ATIVADA=true');
  });

  it('com a cobrança desligada, toda operação é recusada como indisponível', async () => {
    const provedor = escolherProvedorDeCobranca(false);
    const contaId = comoContaId(gerarUuid());

    await expect(provedor.criarAssinatura(contaId, 'pro')).rejects.toBeInstanceOf(
      ErroServicoIndisponivel,
    );
    await expect(provedor.trocarDePlano(contaId, 'pro')).rejects.toBeInstanceOf(
      ErroServicoIndisponivel,
    );
    await expect(provedor.cancelar(contaId)).rejects.toBeInstanceOf(ErroServicoIndisponivel);
  });
});
