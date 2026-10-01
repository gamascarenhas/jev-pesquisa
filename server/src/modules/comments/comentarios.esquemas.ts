import { z } from 'zod';

import { esquemaPaginacao } from '../../shared/pagination.js';
import type { ComentarioListado } from './comentarios.servico.js';
import { esquemaFiltrosDeComentarios } from './filtros-comentarios.js';

export const esquemaParametrosDoProjeto = z.object({ projetoId: z.uuid() }).strict();
export const esquemaParametrosDoComentario = z
  .object({ projetoId: z.uuid(), comentarioId: z.uuid() })
  .strict();
export const esquemaListagem = esquemaFiltrosDeComentarios.extend(esquemaPaginacao.shape).strict();
export const esquemaListagemDaFila = esquemaPaginacao;
export const esquemaCorrecao = z
  .object({ tema: z.string().min(1).max(40), sentimento: z.string().min(1).max(40) })
  .strict();

const esquemaComentarioResposta = z
  .object({
    id: z.string(),
    textoOriginal: z.string().nullable(),
    fonte: z.string(),
    unidade: z.string().nullable(),
    autor: z.string().nullable(),
    comentadoEm: z.string().nullable(),
    nota: z.number().nullable(),
    tema: z.string().nullable(),
    sentimento: z.string().nullable(),
    temaDoModelo: z.string().nullable(),
    sentimentoDoModelo: z.string().nullable(),
    temaConfianca: z.number().nullable(),
    sentimentoConfianca: z.number().nullable(),
    gravidade: z.number().nullable(),
    precisaAcao: z.boolean().nullable(),
    precisaRevisao: z.boolean(),
    foiRevisado: z.boolean(),
    status: z.string(),
  })
  .strict();

export function paraComentarioDto(
  comentario: ComentarioListado,
  precisaDeAcao: (probabilidade: number) => boolean,
): z.infer<typeof esquemaComentarioResposta> {
  return esquemaComentarioResposta.parse({
    id: comentario.id,
    textoOriginal: comentario.textoOriginal,
    fonte: comentario.fonte,
    unidade: comentario.unidade,
    autor: comentario.autor,
    comentadoEm: comentario.comentadoEm?.toISOString() ?? null,
    nota: comentario.nota,
    tema: comentario.tema,
    sentimento: comentario.sentimento,
    temaDoModelo: comentario.temaDoModelo,
    sentimentoDoModelo: comentario.sentimentoDoModelo,
    temaConfianca: comentario.temaConfianca,
    sentimentoConfianca: comentario.sentimentoConfianca,
    gravidade: comentario.gravidade,
    precisaAcao: comentario.precisaAcao === null ? null : precisaDeAcao(comentario.precisaAcao),
    precisaRevisao: comentario.precisaRevisao,
    foiRevisado: comentario.foiRevisado,
    status: comentario.statusClassificacao,
  });
}
