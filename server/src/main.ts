import {
  criarAplicacao,
  criarDesligamento,
  registrarSinaisDeEncerramento,
  type Aplicacao,
} from './app.js';
import { carregarConfiguracao, ErroDeConfiguracao } from './config/config.js';
import { semearPlanos } from './db/dados-iniciais.js';
import { aplicarMigracoes } from './db/migrar.js';

// Todas as interfaces, para proxy reverso e contêiner.
const ENDERECO_DE_ESCUTA = '0.0.0.0';

async function preparar(aplicacao: Aplicacao): Promise<void> {
  await aplicarMigracoes(aplicacao.banco, aplicacao.registrador);
  await semearPlanos(aplicacao.banco);
}

async function iniciar(): Promise<void> {
  const configuracao = carregarConfiguracao();
  const aplicacao = await criarAplicacao(configuracao);
  try {
    await preparar(aplicacao);
    await aplicacao.app.listen({ port: configuracao.porta, host: ENDERECO_DE_ESCUTA });
    await aplicacao.executorDeTrabalhos.iniciar();
    aplicacao.agendador.iniciar();
  } catch (erro) {
    await aplicacao.banco.end();
    throw erro;
  }
  registrarSinaisDeEncerramento(criarDesligamento(aplicacao), process, (codigo) => {
    process.exit(codigo);
  });
}

iniciar().catch((erro: unknown) => {
  if (erro instanceof ErroDeConfiguracao) {
    process.stderr.write(`${erro.message}\n`);
  } else {
    process.stderr.write(
      `Falha ao iniciar o servidor: ${erro instanceof Error ? erro.message : String(erro)}\n`,
    );
  }
  process.exit(1);
});
