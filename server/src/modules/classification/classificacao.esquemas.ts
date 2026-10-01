import { z } from 'zod';

import type {
  EstimativaDaClassificacao,
  ProgressoDaClassificacao,
  ResultadoDoInicio,
} from './classificacao.servico.js';

export const esquemaParametrosDoProjeto = z.object({ projetoId: z.uuid() }).strict();

const esquemaEstimativaResposta = z
  .object({
    pendentes: z.number(),
    minutosEstimados: z.number(),
    porcentagemEstimada: z.number(),
    porcentagemJaConsumida: z.number(),
    cabe: z.boolean(),
  })
  .strict();

const esquemaProgressoResposta = z
  .object({
    pendentes: z.number(),
    classificados: z.number(),
    falhos: z.number(),
    semTexto: z.number(),
    trabalho: z.object({ id: z.string(), status: z.string() }).strict().nullable(),
  })
  .strict();

const esquemaInicioResposta = z
  .object({ trabalhoId: z.string(), status: z.string(), jaExistia: z.boolean() })
  .strict();

export function paraEstimativaDto(
  estimativa: EstimativaDaClassificacao,
): z.infer<typeof esquemaEstimativaResposta> {
  return esquemaEstimativaResposta.parse(estimativa);
}

export function paraProgressoDto(
  progresso: ProgressoDaClassificacao,
): z.infer<typeof esquemaProgressoResposta> {
  return esquemaProgressoResposta.parse({ ...progresso, trabalho: progresso.trabalho ?? null });
}

export function paraInicioDto(inicio: ResultadoDoInicio): z.infer<typeof esquemaInicioResposta> {
  return esquemaInicioResposta.parse({
    trabalhoId: inicio.trabalho.id,
    status: inicio.trabalho.status,
    jaExistia: inicio.jaExistia,
  });
}
