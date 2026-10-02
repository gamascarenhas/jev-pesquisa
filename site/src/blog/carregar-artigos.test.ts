import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { carregarArtigos, ErroDeArtigo, lerArtigo } from './carregar-artigos';

const pastas: string[] = [];

function frontmatter(extra: Record<string, string> = {}): string {
  const campos = {
    titulo: 'Título',
    descricao: 'Descrição',
    slug: 'meu-artigo',
    publicadoEm: '2026-02-01',
    autor: 'Equipe',
    rascunho: 'false',
    ...extra,
  };
  const linhas = Object.entries(campos).map(([chave, valor]) => `${chave}: ${valor}`);
  return `---\n${linhas.join('\n')}\n---\nCorpo.\n`;
}

function criarPastas(arquivos: Record<string, string>) {
  const raiz = mkdtempSync(join(tmpdir(), 'blog-teste-'));
  pastas.push(raiz);
  const conteudo = join(raiz, 'content');
  const publico = join(raiz, 'public');
  mkdirSync(conteudo);
  mkdirSync(join(publico, 'blog'), { recursive: true });
  for (const [nome, texto] of Object.entries(arquivos)) {
    writeFileSync(join(conteudo, nome), texto);
  }
  return { conteudo, publico };
}

afterEach(() => {
  for (const pasta of pastas.splice(0)) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe('lerArtigo', () => {
  it('lê o frontmatter e o corpo', () => {
    const artigo = lerArtigo('a.md', frontmatter());

    expect(artigo).toMatchObject({ slug: 'meu-artigo', rascunho: false, corpo: 'Corpo.\n' });
    expect(artigo.imagem).toBeUndefined();
  });

  it.each([
    ['sem frontmatter', 'só texto', 'frontmatter entre'],
    ['campo desconhecido', frontmatter({ extra: 'x' }), 'extra'],
    ['slug com maiúscula', frontmatter({ slug: 'Meu Artigo' }), 'slug'],
    ['data inválida', frontmatter({ publicadoEm: '01/02/2026' }), 'publicadoEm'],
    ['sem rascunho', frontmatter().replace('rascunho: false\n', ''), 'rascunho'],
  ])('recusa %s citando o arquivo', (_nome, conteudo, trecho) => {
    expect(() => lerArtigo('ruim.md', conteudo)).toThrow(ErroDeArtigo);
    expect(() => lerArtigo('ruim.md', conteudo)).toThrow(/^ruim\.md: /);
    expect(() => lerArtigo('ruim.md', conteudo)).toThrow(trecho);
  });
});

describe('carregarArtigos', () => {
  it('devolve só os publicados, do mais novo ao mais antigo', () => {
    const { conteudo, publico } = criarPastas({
      'a.md': frontmatter({ slug: 'velho', publicadoEm: '2026-01-01' }),
      'b.md': frontmatter({ slug: 'novo', publicadoEm: '2026-03-01' }),
      'c.md': frontmatter({ slug: 'rascunho', rascunho: 'true' }),
      'notas.txt': 'ignorado',
    });

    expect(carregarArtigos(conteudo, publico).map((a) => a.slug)).toEqual(['novo', 'velho']);
  });

  it('valida também os rascunhos', () => {
    const { conteudo, publico } = criarPastas({ 'a.md': frontmatter({ rascunho: 'ops' }) });

    expect(() => carregarArtigos(conteudo, publico)).toThrow(/a\.md/);
  });

  it('recusa slug repetido apontando os dois arquivos', () => {
    const { conteudo, publico } = criarPastas({ 'a.md': frontmatter(), 'b.md': frontmatter() });

    expect(() => carregarArtigos(conteudo, publico)).toThrow(/b\.md.*a\.md/);
  });

  it('recusa imagem de capa que não existe', () => {
    const imagem = '\nimagem: { arquivo: capa.png, alt: x, largura: 1, altura: 1 }';
    const { conteudo, publico } = criarPastas({
      'a.md': frontmatter().replace('rascunho: false', `rascunho: false${imagem}`),
    });

    expect(() => carregarArtigos(conteudo, publico)).toThrow(/public\/blog\/capa\.png/);
    writeFileSync(join(publico, 'blog', 'capa.png'), 'x');
    expect(carregarArtigos(conteudo, publico)).toHaveLength(1);
  });
});
