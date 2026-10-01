import { z } from 'zod';

import type { Trabalho } from './trabalhos.tipos.js';

export const esquemaParametrosDeTrabalho = z.object({ id: z.uuid() }).strict();

const esquemaTrabalhoResposta = z
  .object({
    id: z.string(),
    tipo: z.string(),
    status: z.string(),
    projetoId: z.string().nullable(),
    progresso: z.object({ total: z.number(), feito: z.number() }).strict(),
    criadoEm: z.string(),
    iniciadoEm: z.string().nullable(),
    finalizadoEm: z.string().nullable(),
  })
  .strict();

export function paraTrabalhoDto(trabalho: Trabalho): z.infer<typeof esquemaTrabalhoResposta> {
  return esquemaTrabalhoResposta.parse({
    id: trabalho.id,
    tipo: trabalho.tipo,
    status: trabalho.status,
    projetoId: trabalho.projetoId ?? null,
    progresso: { total: trabalho.progressoTotal, feito: trabalho.progressoFeito },
    criadoEm: trabalho.criadoEm.toISOString(),
    iniciadoEm: trabalho.iniciadoEm?.toISOString() ?? null,
    finalizadoEm: trabalho.finalizadoEm?.toISOString() ?? null,
  });
}
