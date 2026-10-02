import { z } from 'zod';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const NOME_DE_ARQUIVO_DE_IMAGEM = /^[\w.-]+\.(png|jpe?g|webp|avif|svg)$/i;

const esquemaDaImagem = z
  .object({
    arquivo: z.string().regex(NOME_DE_ARQUIVO_DE_IMAGEM),
    alt: z.string().trim().min(1),
    largura: z.number().int().positive(),
    altura: z.number().int().positive(),
  })
  .strict();

// Frontmatter inválido derruba o build com o nome do arquivo (ver carregar-artigos.ts).
export const esquemaDoFrontmatter = z
  .object({
    titulo: z.string().trim().min(1).max(110),
    descricao: z.string().trim().min(1).max(300),
    slug: z.string().regex(SLUG),
    publicadoEm: z.string().regex(DATA),
    atualizadoEm: z.string().regex(DATA).optional(),
    autor: z.string().trim().min(1),
    imagem: esquemaDaImagem.optional(),
    rascunho: z.boolean(),
  })
  .strict();

export type Frontmatter = z.infer<typeof esquemaDoFrontmatter>;

export interface Artigo extends Omit<Frontmatter, 'imagem' | 'atualizadoEm'> {
  imagem: Frontmatter['imagem'] | undefined;
  atualizadoEm: string | undefined;
  corpo: string;
  arquivo: string;
}

export function dataDeModificacao(artigo: Pick<Artigo, 'publicadoEm' | 'atualizadoEm'>): string {
  return artigo.atualizadoEm ?? artigo.publicadoEm;
}
