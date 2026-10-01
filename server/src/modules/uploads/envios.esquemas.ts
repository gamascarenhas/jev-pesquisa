import { z } from 'zod';

import { REGEX_ID_DO_ENVIO } from './armazenamento-envios.js';
import type { Fonte } from './fontes.repositorio.js';
import type { PreviaDoEnvio } from './envios.tipos.js';

const MAXIMO_INDICE_DE_COLUNA = 999;
const TAMANHO_MAXIMO_DO_NOME_DA_ABA = 200;
const TAMANHO_MAXIMO_DO_NOME_ENVIADO = 300;

const indiceDeColuna = z.number().int().min(0).max(MAXIMO_INDICE_DE_COLUNA);
const nomeDeAba = z.string().min(1).max(TAMANHO_MAXIMO_DO_NOME_DA_ABA);

export const esquemaMapeamento = z
  .object({
    comentario: indiceDeColuna,
    data: indiceDeColuna.optional(),
    nota: indiceDeColuna.optional(),
    unidade: indiceDeColuna.optional(),
    autor: indiceDeColuna.optional(),
  })
  .strict();

export const esquemaParametrosDeProjeto = z.object({ projetoId: z.uuid() }).strict();
export const esquemaParametrosDeEnvio = z
  .object({ projetoId: z.uuid(), envioId: z.string().regex(REGEX_ID_DO_ENVIO) })
  .strict();
export const esquemaParametrosDeFonte = z
  .object({ projetoId: z.uuid(), fonteId: z.uuid() })
  .strict();
export const esquemaConsultaDePrevia = z.object({ aba: nomeDeAba.optional() }).strict();
export const esquemaConfirmacao = z
  .object({
    aba: nomeDeAba.optional(),
    nomeArquivo: z.string().max(TAMANHO_MAXIMO_DO_NOME_ENVIADO).optional(),
    mapeamento: esquemaMapeamento,
  })
  .strict();

export const esquemaCargaDeImportacao = z.object({
  fonteId: z.uuid(),
  envioId: z.string().regex(REGEX_ID_DO_ENVIO),
  aba: nomeDeAba.nullable().optional(),
  mapeamento: esquemaMapeamento,
});

const esquemaPreviaResposta = z
  .object({
    envioId: z.string(),
    tipo: z.enum(['csv', 'xlsx']),
    nomeArquivo: z.string(),
    abas: z.array(z.string()),
    aba: z.string().nullable(),
    cabecalho: z.array(z.string()),
    linhas: z.array(z.array(z.string())),
    totalLinhas: z.number(),
    sugestao: esquemaMapeamento.partial(),
  })
  .strict();

const esquemaImportacaoResposta = z
  .object({
    total: z.number(),
    processadas: z.number(),
    importados: z.number(),
    ignorados: z.number(),
    duplicados: z.number(),
    concluida: z.boolean(),
  })
  .strict();

const esquemaFonteResposta = z
  .object({
    id: z.string(),
    nome: z.string(),
    importacao: esquemaImportacaoResposta.nullable(),
    criadoEm: z.string(),
  })
  .strict();

export function paraPreviaDto(previa: PreviaDoEnvio): z.infer<typeof esquemaPreviaResposta> {
  return esquemaPreviaResposta.parse(previa);
}

export function paraFonteDto(fonte: Fonte): z.infer<typeof esquemaFonteResposta> {
  return esquemaFonteResposta.parse({
    id: fonte.id,
    nome: fonte.nome,
    importacao: fonte.importacao ?? null,
    criadoEm: fonte.criadoEm.toISOString(),
  });
}
