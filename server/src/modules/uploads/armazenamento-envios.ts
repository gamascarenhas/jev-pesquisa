import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { ContaId } from '../../shared/ids.js';
import type { TipoDeArquivo } from './envios.tipos.js';
import { erroEnvioNaoEncontrado } from './erros-envio.js';

export const REGEX_ID_DO_ENVIO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(csv|xlsx)$/;
const REGEX_ID_DA_CONTA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface EnvioArmazenado {
  contaId: string;
  envioId: string;
  caminho: string;
  modificadoEm: Date;
}

export interface ArmazenamentoDeEnvios {
  reservar(contaId: ContaId, tipo: TipoDeArquivo): Promise<{ envioId: string; caminho: string }>;
  caminhoDoEnvio(contaId: ContaId, envioId: string): string;
  existe(contaId: ContaId, envioId: string): Promise<boolean>;
  apagar(contaId: ContaId, envioId: string): Promise<void>;
  apagarPastaDaConta(contaId: ContaId): Promise<void>;
  listarTodos(): Promise<EnvioArmazenado[]>;
}

// O arquivo vive em <base>/<contaId>/<nome gerado>: a pasta da conta é a prova de posse.
export function criarArmazenamentoDeEnvios(base: string): ArmazenamentoDeEnvios {
  const pastaDaConta = (contaId: string): string => join(base, contaId);

  function caminhoDoEnvio(contaId: ContaId, envioId: string): string {
    if (!REGEX_ID_DO_ENVIO.test(envioId) || !REGEX_ID_DA_CONTA.test(contaId)) {
      throw erroEnvioNaoEncontrado();
    }
    return join(pastaDaConta(contaId), envioId);
  }

  return {
    async reservar(contaId, tipo) {
      const envioId = `${randomUUID()}.${tipo}`;
      await mkdir(pastaDaConta(contaId), { recursive: true });
      return { envioId, caminho: caminhoDoEnvio(contaId, envioId) };
    },

    caminhoDoEnvio,

    async existe(contaId, envioId) {
      try {
        return (await stat(caminhoDoEnvio(contaId, envioId))).isFile();
      } catch {
        return false;
      }
    },

    async apagar(contaId, envioId) {
      await rm(caminhoDoEnvio(contaId, envioId), { force: true });
    },

    async apagarPastaDaConta(contaId) {
      await rm(pastaDaConta(contaId), { recursive: true, force: true });
    },

    async listarTodos() {
      const pastas = await readdir(base).catch(() => [] as string[]);
      const envios: EnvioArmazenado[] = [];
      for (const contaId of pastas.filter((nome) => REGEX_ID_DA_CONTA.test(nome))) {
        for (const envioId of await readdir(pastaDaConta(contaId))) {
          const caminho = join(pastaDaConta(contaId), envioId);
          const { mtime } = await stat(caminho);
          envios.push({ contaId, envioId, caminho, modificadoEm: mtime });
        }
      }
      return envios;
    },
  };
}
