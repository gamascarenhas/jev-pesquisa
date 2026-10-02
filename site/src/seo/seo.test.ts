import { describe, expect, it } from 'vitest';

import type { Artigo } from '../blog/artigo';
import { serializarDadoEstruturado } from './dados-estruturados';
import { gerarFeed } from './feed';
import { gerarRobots } from './robots';
import { gerarSitemap } from './sitemap';

const artigo: Artigo = {
  titulo: 'A & B <tag>',
  descricao: 'Descrição',
  slug: 'a-b',
  publicadoEm: '2026-02-01',
  atualizadoEm: '2026-02-10',
  autor: 'Equipe',
  imagem: undefined,
  rascunho: false,
  corpo: 'x',
  arquivo: 'a.md',
};

describe('sitemap', () => {
  it('lista só as páginas informadas, com lastmod e marcador de domínio', () => {
    const xml = gerarSitemap([
      { caminho: '/', ultimaModificacao: '2026-03-01' },
      { caminho: '/blog/a-b/', ultimaModificacao: '2026-02-10' },
    ]);

    expect(xml).toContain('<loc>%URL_SITE%/</loc>');
    expect(xml).toContain('<loc>%URL_SITE%/blog/a-b/</loc>');
    expect(xml).toContain('<lastmod>2026-02-10</lastmod>');
    expect(xml).not.toMatch(/\/(api|entrar|cadastro|projetos)/);
  });
});

describe('robots', () => {
  it('libera tudo e aponta o sitemap', () => {
    expect(gerarRobots()).toBe('User-agent: *\nAllow: /\n\nSitemap: %URL_SITE%/sitemap.xml\n');
  });
});

describe('feed', () => {
  it('escapa o título e usa a data de atualização', () => {
    const xml = gerarFeed([artigo], '2026-03-01');

    expect(xml).toContain('A &amp; B &lt;tag&gt;');
    expect(xml).not.toContain('<tag>');
    expect(xml).toContain('2026-02-10');
  });

  it('sem artigos usa a data do build', () => {
    expect(gerarFeed([], '2026-03-01')).toContain('<updated>2026-03-01');
  });
});

describe('dados estruturados', () => {
  it('nunca deixa um "<" fechar o bloco de script', () => {
    const texto = serializarDadoEstruturado({ nome: '</script><script>x' });

    expect(texto).not.toContain('<');
    expect(JSON.parse(texto)).toEqual({ nome: '</script><script>x' });
  });
});
