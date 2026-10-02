import { z } from 'zod';

import { TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO } from '../../shared/pagination.js';
import { esquemaFiltrosDeComentarios } from '../comments/comentarios.servico.js';
import type { PerguntaComConfirmacao, ResultadoDaPergunta } from './perguntar.servico.js';
import { TAMANHO_MAXIMO_DA_PERGUNTA, type PerguntaGravada } from './perguntar.tipos.js';

export const esquemaParametrosDoProjeto = z.object({ projetoId: z.uuid() }).strict();
export const esquemaParametrosDaPergunta = z
  .object({ projetoId: z.uuid(), perguntaId: z.uuid() })
  .strict();

export const esquemaNovaPergunta = z
  .object({
    texto: z.string().trim().min(3).max(TAMANHO_MAXIMO_DA_PERGUNTA),
    filtros: esquemaFiltrosDeComentarios.default({}),
  })
  .strict();

const faixa = z.enum(['yes', 'uncertain', 'no']).default('yes');

export const esquemaConsultaDoResultado = esquemaFiltrosDeComentarios.extend({
  faixa,
  pagina: z.coerce.number().int().min(1).default(1),
  tamanhoPagina: z.coerce
    .number()
    .int()
    .min(1)
    .max(TAMANHO_PAGINA_MAXIMO)
    .default(TAMANHO_PAGINA_PADRAO),
});

export const esquemaConsultaDaExportacao = esquemaFiltrosDeComentarios.extend({ faixa });

export function paraPerguntaDto(pergunta: PerguntaGravada) {
  return {
    id: pergunta.id,
    texto: pergunta.textoOriginal,
    status: pergunta.status,
    respondivel: pergunta.respondivel,
    interpretacao: pergunta.interpretacao,
    motivoNaoRespondivel: pergunta.motivoNaoRespondivel,
    filtros: pergunta.filtros,
    criadoEm: pergunta.criadoEm.toISOString(),
  };
}

export function paraPerguntaComConfirmacaoDto(dados: PerguntaComConfirmacao) {
  return {
    ...paraPerguntaDto(dados.pergunta),
    progresso: dados.progresso,
    confirmacao: dados.confirmacao,
  };
}

export function paraResultadoDto(
  resultado: ResultadoDaPergunta,
  pagina: { pagina: number; tamanhoPagina: number },
) {
  return {
    contagens: resultado.contagens,
    total: resultado.total,
    ...pagina,
    itens: resultado.itens.map((c) => ({
      id: c.id,
      texto: c.textoOriginal,
      fonte: c.fonte,
      unidade: c.unidade,
      autor: c.autor,
      comentadoEm: c.comentadoEm?.toISOString() ?? null,
      nota: c.nota,
      tema: c.tema,
      sentimento: c.sentimento,
      probabilidade: c.probabilidade,
    })),
  };
}
