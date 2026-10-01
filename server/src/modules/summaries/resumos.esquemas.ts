import { z } from 'zod';

import type { ComentarioCitado } from '../comments/comentarios.servico.js';
import type { ResumoGravado } from './resumos.repositorio.js';

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const esquemaParametrosDoProjeto = z.object({ projetoId: z.uuid() }).strict();
export const esquemaParametrosDoAchado = z
  .object({
    projetoId: z.uuid(),
    resumoId: z.uuid(),
    indice: z.coerce.number().int().min(0).max(10),
  })
  .strict();
export const esquemaEntradaDoResumo = z
  .object({
    de: dia.optional(),
    ate: dia.optional(),
    unidade: z.string().min(1).max(200).optional(),
  })
  .strict();

const esquemaResumoResposta = z
  .object({
    id: z.string(),
    tema: z.string(),
    periodo: z.object({ inicio: z.string(), fim: z.string() }).strict(),
    unidade: z.string().nullable(),
    status: z.string(),
    nivelDeAlerta: z.string(),
    titulo: z.string().nullable(),
    achados: z.array(z.object({ texto: z.string(), evidencias: z.array(z.string()) }).strict()),
    numeros: z
      .object({
        volume: z.number(),
        percentualNegativo: z.number(),
        gravidadeMedia: z.number(),
        percentualPrecisaAcao: z.number(),
        variacaoDoVolume: z.number().nullable(),
        variacaoDoPercentualNegativo: z.number().nullable(),
        unidadesPrincipais: z.array(
          z.object({ unidade: z.string(), participacao: z.number() }).strict(),
        ),
      })
      .strict(),
    criadoEm: z.string(),
  })
  .strict();

const esquemaListaResposta = z
  .object({ emAndamento: z.boolean(), itens: z.array(esquemaResumoResposta) })
  .strict();

// O cliente nunca vê modelo, custo nem probabilidades: só o texto verificado e os números.
export function paraResumoDto(resumo: ResumoGravado): z.infer<typeof esquemaResumoResposta> {
  const { agregados } = resumo;
  return {
    id: resumo.id,
    tema: resumo.tema,
    periodo: { inicio: resumo.inicio, fim: resumo.fim },
    unidade: resumo.unidade,
    status: resumo.status,
    nivelDeAlerta: resumo.nivelDeAlerta,
    titulo: resumo.titulo,
    achados: (resumo.achados ?? []).map((a) => ({
      texto: a.texto,
      evidencias: a.evidencias.map((e) => e.id),
    })),
    numeros: {
      volume: agregados.volume,
      percentualNegativo: agregados.percentualNegativo,
      gravidadeMedia: agregados.gravidadeMedia,
      percentualPrecisaAcao: agregados.percentualPrecisaAcao,
      variacaoDoVolume: agregados.variacoes?.volume ?? null,
      variacaoDoPercentualNegativo: agregados.variacoes?.percentualNegativo ?? null,
      unidadesPrincipais: agregados.unidadesPrincipais.map((u) => ({
        unidade: u.unidade,
        participacao: u.participacao,
      })),
    },
    criadoEm: resumo.criadoEm.toISOString(),
  };
}

export function paraListaDto(lista: { emAndamento: boolean; resumos: ResumoGravado[] }) {
  return esquemaListaResposta.parse({
    emAndamento: lista.emAndamento,
    itens: lista.resumos.map(paraResumoDto),
  });
}

export function paraCitadosDto(citados: ComentarioCitado[]) {
  return {
    itens: citados.map((c) => ({
      id: c.id,
      texto: c.texto,
      nota: c.nota,
      unidade: c.unidade,
      comentadoEm: c.comentadoEm?.toISOString() ?? null,
    })),
  };
}
