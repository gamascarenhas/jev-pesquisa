import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';

const NOME = 'Cia <A&B>';
let diretorio = '';
let aplicacao: AppDeTeste;
let hostSite = '';
let hostApp = '';

const pagina = (corpo: string) => `<!doctype html><title>%NOME_NEGOCIO%</title>${corpo}`;

beforeAll(async () => {
  diretorio = await mkdtemp(join(tmpdir(), 'site-teste-'));
  await mkdir(join(diretorio, 'blog'));
  await mkdir(join(diretorio, 'assets'));
  await writeFile(join(diretorio, 'index.html'), pagina('<a href="%URL_APP%/cadastro">x</a>'));
  await writeFile(join(diretorio, 'blog', 'index.html'), pagina('blog'));
  await writeFile(join(diretorio, '404.html'), pagina('nada aqui'));
  await writeFile(join(diretorio, 'robots.txt'), 'Sitemap: %URL_SITE%/sitemap.xml\n');
  await writeFile(join(diretorio, 'assets', 'a-1.css'), 'body{}');
  await writeFile(join(diretorio, 'indice-de-paginas.json'), '{}');
  aplicacao = await montarAppDeTeste({
    prepararBanco: false,
    diretorioSite: diretorio,
    configuracao: { nomeNegocio: NOME },
  });
  hostSite = new URL(aplicacao.configuracao.origemSite).host;
  hostApp = new URL(aplicacao.configuracao.origemApp).host;
});

afterAll(async () => {
  await aplicacao.encerrar();
  await rm(diretorio, { recursive: true, force: true });
});

const noSite = (url: string, metodo: 'GET' | 'HEAD' | 'POST' = 'GET', cabecalhos = {}) =>
  aplicacao.app.inject({ method: metodo, url, headers: { host: hostSite, ...cabecalhos } });

describe('domínio do site', () => {
  it('serve a página com os marcadores trocados e escapados, sem cookie', async () => {
    const resposta = await noSite('/');

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('Cia &lt;A&amp;B&gt;');
    expect(resposta.body).toContain(`${aplicacao.configuracao.origemApp}/cadastro`);
    expect(resposta.body).not.toContain('%');
    expect(resposta.headers['set-cookie']).toBeUndefined();
    expect(resposta.headers['x-robots-tag']).toBeUndefined();
    expect(resposta.headers['content-security-policy']).toBeDefined();
  });

  it('responde 304 com o ETag e atende HEAD', async () => {
    const primeira = await noSite('/blog/');
    const etag = String(primeira.headers.etag);

    expect((await noSite('/blog/', 'GET', { 'if-none-match': etag })).statusCode).toBe(304);
    expect((await noSite('/blog/', 'HEAD')).statusCode).toBe(200);
  });

  it('redireciona a barra final ausente e as rotas do app, preservando a consulta', async () => {
    const barra = await noSite('/blog');
    const app = await noSite('/entrar?proximo=%2Fprojetos');

    expect(barra.statusCode).toBe(301);
    expect(barra.headers.location).toBe('/blog/');
    expect(app.statusCode).toBe(301);
    expect(app.headers.location).toBe(
      `${aplicacao.configuracao.origemApp}/entrar?proximo=%2Fprojetos`,
    );
  });

  it('serve robots.txt e arquivos com hash, e esconde o índice interno', async () => {
    const robots = await noSite('/robots.txt');
    const css = await noSite('/assets/a-1.css');

    expect(robots.body).toContain(`${aplicacao.configuracao.origemSite}/sitemap.xml`);
    expect(css.headers['cache-control']).toContain('immutable');
    expect((await noSite('/indice-de-paginas.json')).statusCode).toBe(404);
  });

  it('responde 404 com a página própria, 405 para métodos de escrita e bloqueia caminhos fora da pasta', async () => {
    const naoAchou = await noSite('/nao-existe');

    expect(naoAchou.statusCode).toBe(404);
    expect(naoAchou.body).toContain('nada aqui');
    expect((await noSite('/api/projetos')).statusCode).toBe(301);
    expect((await noSite('/', 'POST')).statusCode).toBe(405);
    expect((await noSite('/..%2f..%2fpackage.json')).statusCode).toBe(404);
  });
});

describe('domínio do app e hosts desconhecidos', () => {
  it('o app segue o fluxo normal, com noindex e robots liberado', async () => {
    const robots = await aplicacao.app.inject({ url: '/robots.txt', headers: { host: hostApp } });
    const saude = await aplicacao.app.inject({ url: '/api/saude', headers: { host: hostApp } });

    expect(robots.body).toContain('Disallow:\n');
    expect(robots.body).not.toContain('Disallow: /');
    expect(saude.headers['x-robots-tag']).toBe('noindex');
  });

  it('host desconhecido leva 404, menos a verificação de saúde', async () => {
    const estranho = { host: 'qualquer.exemplo' };

    expect((await aplicacao.app.inject({ url: '/', headers: estranho })).statusCode).toBe(404);
    expect((await aplicacao.app.inject({ url: '/api/saude', headers: estranho })).statusCode).toBe(
      200,
    );
  });

  it('X-Forwarded-Host não muda o domínio', async () => {
    const resposta = await aplicacao.app.inject({
      url: '/',
      headers: { host: hostApp, 'x-forwarded-host': hostSite },
    });

    expect(resposta.body).not.toContain('nada aqui');
    expect(resposta.body).not.toContain('<title>');
  });
});
