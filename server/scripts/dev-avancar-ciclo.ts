import { carregarConfiguracao } from '../src/config/config.js';
import { criarBanco } from '../src/db/conexoes.js';
import { criarEnviadorLog } from '../src/integrations/mail/enviador-log.js';
import { criarFilaTrabalhos } from '../src/jobs/fila-trabalhos.js';
import { criarControleDeCustoDoSistema } from '../src/modules/usage/controle-custo-sistema.js';
import { comoContaId } from '../src/shared/ids.js';
import { relogioDoSistema } from '../src/shared/clock.js';
import { criarRegistrador } from '../src/shared/logger.js';
import { exigirDesenvolvimento } from './somente-desenvolvimento.js';

const EMAIL_PADRAO = 'demo@exemplo.com.br';

// Uso: npm run dev:avancar-ciclo [-- email-de-um-usuario-da-conta]
async function avancar(): Promise<void> {
  const configuracao = carregarConfiguracao();
  exigirDesenvolvimento(configuracao);
  const email = (process.argv[2] ?? EMAIL_PADRAO).toLowerCase();
  const banco = criarBanco(configuracao.urlBanco);
  try {
    const conta = await banco.query<{ conta_id: string }>(
      'SELECT conta_id FROM usuarios WHERE lower(email) = $1',
      [email],
    );
    const contaId = conta.rows[0]?.conta_id;
    if (contaId === undefined) {
      throw new Error(`Nenhum usuário com o e-mail ${email}.`);
    }
    const fila = criarFilaTrabalhos(banco);
    const registrador = criarRegistrador({ nivel: 'warn', legivel: true });
    const custo = criarControleDeCustoDoSistema({
      banco,
      configuracao,
      registrador,
      relogio: relogioDoSistema,
      retomarJob: (trabalhoId, agora) => fila.retomarPausado(trabalhoId, agora),
      enviador: criarEnviadorLog(registrador),
      listarDonos: () => Promise.resolve([]),
    });
    const virou = await custo.forcarViradaDeCiclo(comoContaId(contaId));
    process.stdout.write(
      virou
        ? 'Ciclo virado: consumo zerado e jobs pausados devolvidos à fila.\n'
        : 'O ciclo da conta não pôde ser virado.\n',
    );
  } finally {
    await banco.end();
  }
}

avancar().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exit(1);
});
