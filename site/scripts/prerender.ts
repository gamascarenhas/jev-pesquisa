import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { dataDeModificacao } from '../src/blog/artigo';
import { carregarArtigos } from '../src/blog/carregar-artigos';
import type { PaginaParaRenderizar } from '../src/entry-server';
import { gerarFeed } from '../src/seo/feed';
import { gerarRobots } from '../src/seo/robots';
import { gerarSitemap, type PaginaDoIndice } from '../src/seo/sitemap';

const RAIZ_DO_SITE = resolve(import.meta.dirname, '..');

export interface OpcoesDoPrerender {
  diretorioDeConteudo: string;
  diretorioPublico: string;
  diretorioDeSaida: string;
  arquivosCss: string[];
  renderizar: (pagina: PaginaParaRenderizar, arquivosCss: string[]) => string;
  /** AAAA-MM-DD do build; vira o lastmod da landing e da lista quando não há artigo. */
  hoje: string;
}

export interface IndiceDePaginas {
  geradoEm: string;
  paginas: (PaginaDoIndice & { tipo: 'landing' | 'lista' | 'artigo'; arquivo: string })[];
  artigos: { slug: string; titulo: string; caminho: string }[];
}

function gravar(saida: string, arquivo: string, conteudo: string): void {
  const destino = join(saida, arquivo);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, conteudo, 'utf8');
}

/** Gera em `diretorioDeSaida` o HTML de cada página pública, o sitemap, o feed, o robots e o índice. */
export function gerarSite(opcoes: OpcoesDoPrerender): IndiceDePaginas {
  const { diretorioDeSaida: saida, arquivosCss, renderizar } = opcoes;
  const artigos = carregarArtigos(opcoes.diretorioDeConteudo, opcoes.diretorioPublico);
  const ultimaDoBlog = artigos[0] === undefined ? opcoes.hoje : dataDeModificacao(artigos[0]);
  const paginas: IndiceDePaginas['paginas'] = [
    { caminho: '/', tipo: 'landing', ultimaModificacao: opcoes.hoje, arquivo: 'index.html' },
    {
      caminho: '/blog/',
      tipo: 'lista',
      ultimaModificacao: ultimaDoBlog,
      arquivo: 'blog/index.html',
    },
    ...artigos.map((artigo) => ({
      caminho: `/blog/${artigo.slug}/`,
      tipo: 'artigo' as const,
      ultimaModificacao: dataDeModificacao(artigo),
      arquivo: `blog/${artigo.slug}/index.html`,
    })),
  ];
  gravar(saida, 'index.html', renderizar({ tipo: 'landing' }, arquivosCss));
  gravar(saida, 'blog/index.html', renderizar({ tipo: 'lista', artigos }, arquivosCss));
  for (const artigo of artigos) {
    gravar(
      saida,
      `blog/${artigo.slug}/index.html`,
      renderizar({ tipo: 'artigo', artigo }, arquivosCss),
    );
  }
  gravar(saida, '404.html', renderizar({ tipo: 'nao-encontrado' }, arquivosCss));
  gravar(saida, 'sitemap.xml', gerarSitemap(paginas));
  gravar(saida, 'feed.xml', gerarFeed(artigos, opcoes.hoje));
  gravar(saida, 'robots.txt', gerarRobots());
  const indice: IndiceDePaginas = {
    geradoEm: opcoes.hoje,
    paginas,
    artigos: artigos.map((a) => ({ slug: a.slug, titulo: a.titulo, caminho: `/blog/${a.slug}/` })),
  };
  gravar(saida, 'indice-de-paginas.json', `${JSON.stringify(indice, null, 2)}\n`);
  return indice;
}

function lerCssDoManifesto(diretorioDeSaida: string): string[] {
  const manifesto = JSON.parse(
    readFileSync(join(diretorioDeSaida, '.vite', 'manifest.json'), 'utf8'),
  ) as Record<string, { file: string; css?: string[] }>;
  const arquivos = Object.values(manifesto).flatMap((entrada) => [
    ...(entrada.file.endsWith('.css') ? [entrada.file] : []),
    ...(entrada.css ?? []),
  ]);
  if (arquivos.length === 0) {
    throw new Error('O build do cliente não gerou nenhum arquivo de CSS.');
  }
  return [...new Set(arquivos)];
}

async function executar(): Promise<void> {
  const saida = join(RAIZ_DO_SITE, 'dist');
  const modulo = (await import(
    pathToFileURL(join(RAIZ_DO_SITE, 'dist-ssr', 'entry-server.js')).href
  )) as {
    renderizarPagina: OpcoesDoPrerender['renderizar'];
  };
  const indice = gerarSite({
    diretorioDeConteudo: join(RAIZ_DO_SITE, 'content', 'blog'),
    diretorioPublico: join(RAIZ_DO_SITE, 'public'),
    diretorioDeSaida: saida,
    arquivosCss: lerCssDoManifesto(saida),
    renderizar: modulo.renderizarPagina,
    hoje: new Date().toISOString().slice(0, 10),
  });
  rmSync(join(saida, '.vite'), { recursive: true, force: true });
  process.stdout.write(`Site gerado: ${String(indice.paginas.length)} páginas públicas.\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executar().catch((erro: unknown) => {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exit(1);
  });
}
