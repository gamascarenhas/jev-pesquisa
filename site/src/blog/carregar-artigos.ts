import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

import { esquemaDoFrontmatter, type Artigo } from './artigo';

const SEPARADOR_DO_FRONTMATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export class ErroDeArtigo extends Error {
  constructor(arquivo: string, motivo: string) {
    super(`${arquivo}: ${motivo}`);
    this.name = 'ErroDeArtigo';
  }
}

export function lerArtigo(arquivo: string, conteudo: string): Artigo {
  const partes = SEPARADOR_DO_FRONTMATTER.exec(conteudo);
  if (partes === null) {
    throw new ErroDeArtigo(arquivo, 'o arquivo precisa começar com um frontmatter entre "---".');
  }
  let bruto: unknown;
  try {
    bruto = parse(partes[1] ?? '');
  } catch {
    throw new ErroDeArtigo(arquivo, 'o frontmatter não é um YAML válido.');
  }
  const analisado = esquemaDoFrontmatter.safeParse(bruto);
  if (!analisado.success) {
    const problemas = analisado.error.issues
      .map((p) => `${p.path.join('.') || 'frontmatter'}: ${p.message}`)
      .join('; ');
    throw new ErroDeArtigo(arquivo, `frontmatter inválido (${problemas}).`);
  }
  const { imagem, atualizadoEm, ...resto } = analisado.data;
  return { ...resto, imagem, atualizadoEm, corpo: partes[2] ?? '', arquivo };
}

function exigirSemRepeticao(artigos: Artigo[]): void {
  const vistos = new Map<string, string>();
  for (const artigo of artigos) {
    const anterior = vistos.get(artigo.slug);
    if (anterior !== undefined) {
      throw new ErroDeArtigo(artigo.arquivo, `o slug "${artigo.slug}" já é usado em ${anterior}.`);
    }
    vistos.set(artigo.slug, artigo.arquivo);
  }
}

function exigirImagens(artigos: Artigo[], diretorioPublico: string): void {
  for (const artigo of artigos) {
    const arquivo = artigo.imagem?.arquivo;
    if (arquivo !== undefined && !existsSync(join(diretorioPublico, 'blog', arquivo))) {
      throw new ErroDeArtigo(artigo.arquivo, `a imagem public/blog/${arquivo} não existe.`);
    }
  }
}

/** Valida todos os arquivos (rascunhos inclusive) e devolve só os publicados, do mais novo ao mais antigo. */
export function carregarArtigos(diretorio: string, diretorioPublico: string): Artigo[] {
  const todos = readdirSync(diretorio)
    .filter((nome) => nome.endsWith('.md'))
    .sort()
    .map((nome) => lerArtigo(nome, readFileSync(join(diretorio, nome), 'utf8')));
  exigirSemRepeticao(todos);
  exigirImagens(todos, diretorioPublico);
  return todos
    .filter((artigo) => !artigo.rascunho)
    .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm) || a.slug.localeCompare(b.slug));
}
