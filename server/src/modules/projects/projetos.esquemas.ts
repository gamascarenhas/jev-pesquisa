import { z } from 'zod';

import { esquemaPaginacao } from '../../shared/pagination.js';
import type { Projeto } from './projetos.repositorio.js';

export const TAMANHO_MAXIMO_NOME_PROJETO = 120;

export const esquemaParametrosDeProjeto = z.object({ id: z.uuid() }).strict();
export const esquemaListagemDeProjetos = esquemaPaginacao;
export const esquemaCorpoDeProjeto = z
  .object({ nome: z.string().trim().min(1).max(TAMANHO_MAXIMO_NOME_PROJETO) })
  .strict();

const esquemaProjetoResposta = z
  .object({ id: z.string(), nome: z.string(), criadoEm: z.string(), atualizadoEm: z.string() })
  .strict();

export function paraProjetoDto(projeto: Projeto): z.infer<typeof esquemaProjetoResposta> {
  return esquemaProjetoResposta.parse({
    id: projeto.id,
    nome: projeto.nome,
    criadoEm: projeto.criadoEm.toISOString(),
    atualizadoEm: projeto.atualizadoEm.toISOString(),
  });
}
