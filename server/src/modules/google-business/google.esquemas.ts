import { z } from 'zod';

import type { StatusDoGoogle, ContaComUnidades } from './google-unidades.servico.js';

export const esquemaParametrosDoProjeto = z.object({ projetoId: z.uuid() }).strict();

// O Google acrescenta parâmetros próprios ao redirecionar (scope, authuser, prompt), então esta consulta não é estrita.
export const esquemaConsultaDoCallback = z.object({
  code: z.string().min(1).max(2048).optional(),
  state: z.string().min(1).max(256).optional(),
  error: z.string().max(256).optional(),
});

export const esquemaEscolhaDeUnidades = z
  .object({ unidades: z.array(z.string().min(1).max(256)).min(1).max(100) })
  .strict();

const esquemaStatusResposta = z
  .object({
    conectado: z.boolean(),
    email: z.string().nullable(),
    simulado: z.boolean(),
    sincronizando: z.boolean(),
    unidades: z.array(
      z
        .object({
          nomeUnidade: z.string(),
          titulo: z.string(),
          ultimaSincronizacaoEm: z.string().nullable(),
          falha: z.object({ codigo: z.string(), mensagem: z.string() }).strict().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

const esquemaContasResposta = z
  .object({
    itens: z.array(
      z
        .object({
          id: z.string(),
          nome: z.string(),
          unidades: z.array(
            z
              .object({
                nome: z.string(),
                titulo: z.string(),
                endereco: z.string().nullable(),
                selecionada: z.boolean(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export function paraStatusDto(status: StatusDoGoogle): z.infer<typeof esquemaStatusResposta> {
  return esquemaStatusResposta.parse({
    ...status,
    unidades: status.unidades.map((unidade) => ({
      nomeUnidade: unidade.nomeUnidade,
      titulo: unidade.titulo,
      ultimaSincronizacaoEm: unidade.ultimaSincronizacaoEm?.toISOString() ?? null,
      falha: unidade.falha,
    })),
  });
}

export function paraContasDto(contas: ContaComUnidades[]): z.infer<typeof esquemaContasResposta> {
  return esquemaContasResposta.parse({ itens: contas });
}
