import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { renderizarPagina } from '../src/entry-server';
import { gerarSite } from './prerender';

const pastas: string[] = [];

function artigo(slug: string, rascunho: boolean): string {
  return `---\ntitulo: Título ${slug}\ndescricao: Descrição\nslug: ${slug}\npublicadoEm: 2026-02-01\nautor: Equipe\nrascunho: ${String(rascunho)}\n---\n## Seção\n\nTexto.\n`;
}

function gerar() {
  const raiz = mkdtempSync(join(tmpdir(), 'prerender-teste-'));
  pastas.push(raiz);
  mkdirSync(join(raiz, 'content'));
  mkdirSync(join(raiz, 'public'));
  writeFileSync(join(raiz, 'content', 'publicado.md'), artigo('publicado', false));
  writeFileSync(join(raiz, 'content', 'rascunho.md'), artigo('rascunho', true));
  const saida = join(raiz, 'dist');
  const indice = gerarSite({
    diretorioDeConteudo: join(raiz, 'content'),
    diretorioPublico: join(raiz, 'public'),
    diretorioDeSaida: saida,
    arquivosCss: ['assets/site-abc.css'],
    renderizar: renderizarPagina,
    hoje: '2026-03-01',
  });
  return { saida, indice };
}

const ler = (saida: string, arquivo: string) => readFileSync(join(saida, arquivo), 'utf8');

afterEach(() => {
  for (const pasta of pastas.splice(0)) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe('gerarSite', () => {
  it('gera as páginas, o sitemap, o feed e o robots, sem o rascunho', () => {
    const { saida, indice } = gerar();

    expect(indice.paginas.map((p) => p.caminho)).toEqual(['/', '/blog/', '/blog/publicado/']);
    expect(existsSync(join(saida, 'blog', 'publicado', 'index.html'))).toBe(true);
    expect(existsSync(join(saida, 'blog', 'rascunho'))).toBe(false);
    expect(ler(saida, 'sitemap.xml')).not.toContain('rascunho');
    expect(ler(saida, 'feed.xml')).not.toContain('rascunho');
    expect(ler(saida, 'robots.txt')).toContain('Sitemap:');
    expect(existsSync(join(saida, '404.html'))).toBe(true);
  });

  it('cada página tem um h1, canonical, o CSS do build e o marcador de domínio', () => {
    const { saida } = gerar();

    for (const arquivo of ['index.html', 'blog/index.html', 'blog/publicado/index.html']) {
      const html = ler(saida, arquivo);
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html).toContain('<link rel="canonical" href="%URL_SITE%');
      expect(html).toContain('/assets/site-abc.css');
      expect(html).toContain('<html lang="pt-BR"');
    }
  });

  it('o artigo traz JSON-LD, a landing traz Organization e nenhuma página carrega script de cliente', () => {
    const { saida } = gerar();
    const artigoHtml = ler(saida, 'blog/publicado/index.html');
    const landing = ler(saida, 'index.html');

    expect(artigoHtml).toContain('"@type":"BlogPosting"');
    expect(artigoHtml).toContain('"@type":"BreadcrumbList"');
    expect(landing).toContain('"@type":"Organization"');
    expect(landing).not.toMatch(/<script(?![^>]*ld\+json)/);
  });

  it('a página 404 não é indexável', () => {
    const { saida } = gerar();

    expect(ler(saida, '404.html')).toContain('noindex');
  });
});
