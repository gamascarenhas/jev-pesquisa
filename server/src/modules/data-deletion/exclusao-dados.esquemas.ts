import { z } from 'zod';

const TAMANHO_MAXIMO_CAMPO = 200;

export const esquemaParametrosApagarProjeto = z.object({ id: z.uuid() }).strict();

export const esquemaApagarProjeto = z
  .object({ nomeProjeto: z.string().max(TAMANHO_MAXIMO_CAMPO) })
  .strict();

export const esquemaEncerrarConta = z
  .object({ senha: z.string().min(1).max(TAMANHO_MAXIMO_CAMPO) })
  .strict();
