import type { EntradaDaComposicao, Nucleo } from './composicao.js';
import type { Google } from './composicao-google.js';
import type { Perguntar } from './composicao-perguntar.js';
import type { Resumos } from './composicao-resumos.js';
import { criarExecutorTrabalhos, type ExecutorTrabalhos } from './jobs/executor-trabalhos.js';
import { criarManipuladorClassificar } from './jobs/handlers/classificar.manipulador.js';
import { criarManipuladorImportarEnvio } from './jobs/handlers/importar-envio.manipulador.js';
import { criarRecuperacaoTrabalhos } from './jobs/recuperacao-trabalhos.js';

export function montarExecutor(
  entrada: EntradaDaComposicao,
  nucleo: Nucleo,
  google: Google,
  resumos: Resumos,
  perguntar: Perguntar,
): ExecutorTrabalhos {
  const { registrador, relogio, opcoes } = entrada;
  const { fila, uploads, custo, classificacao } = nucleo;
  const recuperacao = criarRecuperacaoTrabalhos({
    fila,
    ganchos: [
      { nome: 'limpeza-envios', executar: uploads.limpeza },
      {
        nome: 'liberar-reservas-antigas',
        executar: () => custo.liberarReservasAntigas().then(() => undefined),
      },
      {
        nome: 'reavaliar-jobs-pausados',
        executar: () => custo.reavaliarJobsPausados().then(() => undefined),
      },
      ...(opcoes.ganchosDeRecuperacao ?? []),
    ],
    relogio,
    registrador,
  });
  return criarExecutorTrabalhos({
    fila,
    recuperacao,
    manipuladores: {
      import_upload: criarManipuladorImportarEnvio(uploads.importacao),
      classify: criarManipuladorClassificar(classificacao),
      google_sync: google.manipulador,
      summarize: resumos.manipulador,
      ask: perguntar.manipulador,
      ...opcoes.manipuladoresDeTrabalho,
    },
    relogio,
    registrador,
    ...opcoes.ajustesDoExecutor,
  });
}
