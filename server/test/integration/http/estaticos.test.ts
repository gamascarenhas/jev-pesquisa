import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { escaparHtml } from '../../../src/http/plugins/estaticos.plugin.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';

const DIRETORIO_WEB = resolve(import.meta.dirname, '../../../../web');
const ORIGEM_ESTILOS = 'https://fonts.googleapis.com';
const ORIGEM_FONTES = 'https://fonts.gstatic.com';
const ORIGEM_ESTRANHA = 'https://fonte-estranha.example';
const NOME_COM_CARACTERES_ESPECIAIS = 'Cia <A&B> "X" \'Y\'';

let diretorioDoBuild = '';
let aplicacao: AppDeTeste;

function diretiva(politica: string, nome: string): string[] {
  const linha = politica.split(';').find((trecho) => trecho.trim().startsWith(`${nome} `));
  return (linha ?? '').trim().split(/\s+/).slice(1);
}

function permite(politica: string, nomeDaDiretiva: string, origem: string): boolean {
  return diretiva(politica, nomeDaDiretiva).includes(origem);
}

function origensExternasDoCss(css: string): string[] {
  const enderecos = [...css.matchAll(/https?:\/\/[^\s"')]+/g)].map((achado) => achado[0]);
  return [...new Set(enderecos.map((endereco) => new URL(endereco).origin))];
}

beforeAll(async () => {
  diretorioDoBuild = await mkdtemp(join(tmpdir(), 'web-build-'));
  await build({
    root: DIRETORIO_WEB,
    logLevel: 'silent',
    build: { outDir: diretorioDoBuild, emptyOutDir: true },
  });
  aplicacao = await montarAppDeTeste({
    prepararBanco: false,
    diretorioWeb: diretorioDoBuild,
    configuracao: {
      nomeNegocio: NOME_COM_CARACTERES_ESPECIAIS,
      origensEstiloExterno: [ORIGEM_ESTILOS],
      origensFonteExterna: [ORIGEM_FONTES],
    },
  });
}, 60_000);

afterAll(async () => {
  await aplicacao.encerrar();
  await rm(diretorioDoBuild, { recursive: true, force: true });
});

describe('escaparHtml', () => {
  it('escapa os cinco caracteres perigosos', () => {
    expect(escaparHtml(NOME_COM_CARACTERES_ESPECIAIS)).toBe(
      'Cia &lt;A&amp;B&gt; &quot;X&quot; &#39;Y&#39;',
    );
  });
});

describe('index.html servido', () => {
  it('traz o nome do negócio escapado no título, em qualquer rota do front', async () => {
    for (const url of ['/', '/entrar', '/projetos', '/index.html']) {
      const resposta = await aplicacao.app.inject({ method: 'GET', url });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.headers['content-type']).toContain('text/html');
      expect(resposta.body).toContain(
        '<title>Cia &lt;A&amp;B&gt; &quot;X&quot; &#39;Y&#39;</title>',
      );
      expect(resposta.body).not.toContain('%NOME_NEGOCIO%');
      expect(resposta.body).not.toContain('<A&B>');
    }
  });

  it('não devolve a página do front para a API nem para arquivos que não existem', async () => {
    const api = await aplicacao.app.inject({ method: 'GET', url: '/api/nao-existe' });
    const arquivo = await aplicacao.app.inject({ method: 'GET', url: '/assets/nao-existe.js' });
    const post = await aplicacao.app.inject({
      method: 'POST',
      url: '/qualquer',
      headers: { origin: aplicacao.configuracao.origemApp },
    });

    expect(api.statusCode).toBe(404);
    expect(api.json<{ erro: { codigo: string } }>().erro.codigo).toBe('nao_encontrado');
    expect(arquivo.statusCode).toBe(404);
    expect(post.statusCode).toBe(404);
  });

  it('serve os arquivos com hash com cache longo e o HTML sem cache', async () => {
    const arquivos = await readdir(join(diretorioDoBuild, 'assets'));
    const js = arquivos.find((nome) => nome.endsWith('.js')) ?? '';

    const asset = await aplicacao.app.inject({ method: 'GET', url: `/assets/${js}` });
    const html = await aplicacao.app.inject({ method: 'GET', url: '/' });

    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
    expect(html.headers['cache-control']).toBe('no-cache');
  });
});

describe('política de segurança de conteúdo com o build real', () => {
  it('deixa carregar os estilos e as fontes declarados e bloqueia fonte de outro domínio', async () => {
    const pagina = await aplicacao.app.inject({ method: 'GET', url: '/' });
    const politica = String(pagina.headers['content-security-policy']);
    const arquivos = await readdir(join(diretorioDoBuild, 'assets'));
    const nomeDoCss = arquivos.find((nome) => nome.endsWith('.css')) ?? '';
    const css = await readFile(join(diretorioDoBuild, 'assets', nomeDoCss), 'utf8');

    const origensDeEstilo = origensExternasDoCss(css);
    expect(origensDeEstilo).toEqual([ORIGEM_ESTILOS]);
    for (const origem of origensDeEstilo) {
      expect(permite(politica, 'style-src', origem)).toBe(true);
    }
    expect(permite(politica, 'font-src', ORIGEM_FONTES)).toBe(true);
    expect(permite(politica, 'font-src', ORIGEM_ESTRANHA)).toBe(false);
    expect(permite(politica, 'style-src', ORIGEM_ESTRANHA)).toBe(false);
  });

  it('só deixa o index.html apontar para os scripts do próprio domínio e preconectar às origens liberadas', async () => {
    const pagina = await aplicacao.app.inject({ method: 'GET', url: '/' });
    const politica = String(pagina.headers['content-security-policy']);
    const scripts = [...pagina.body.matchAll(/<script[^>]*src="([^"]+)"/g)].map((a) => a[1] ?? '');
    const conexoes = [...pagina.body.matchAll(/rel="preconnect" href="([^"]+)"/g)].map(
      (a) => a[1] ?? '',
    );

    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(script.startsWith('/')).toBe(true);
    }
    for (const origem of conexoes) {
      const liberada =
        permite(politica, 'style-src', origem) || permite(politica, 'font-src', origem);
      expect(liberada).toBe(true);
    }
  });
});
