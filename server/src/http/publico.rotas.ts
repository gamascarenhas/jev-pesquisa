import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Configuracao } from '../config/config.js';

const PREFIXOS_DO_APP = [
  '/api',
  '/entrar',
  '/cadastro',
  '/esqueci-senha',
  '/redefinir-senha',
  '/confirmar-email',
  '/confirmar-novo-email',
  '/aceitar-convite',
  '/termos',
  '/privacidade',
  '/projetos',
  '/comecar',
  '/configuracoes',
];
const DIRETORIO_DO_BUILD_SITE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../site/dist',
);
const EXTENSOES_DE_TEXTO = new Set(['.html', '.xml', '.txt']);
const TIPOS_DE_ARQUIVO: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};
const ARQUIVOS_QUE_NAO_SAEM = new Set(['indice-de-paginas.json']);
const CACHE_DAS_PAGINAS = 'public, no-cache';
const CACHE_DOS_ARQUIVOS_COM_HASH = 'public, max-age=31536000, immutable';
const CACHE_DOS_DEMAIS_ARQUIVOS = 'public, max-age=86400';
const METODOS_ACEITOS = ['GET', 'HEAD'];
const STATUS_REDIRECIONAMENTO = 301;

export interface OpcoesDoSitePublico {
  diretorio: string;
  nomeNegocio: string;
  origemApp: string;
  origemSite: string;
  origensEstiloExterno: string[];
  origensFonteExterna: string[];
}

export interface SitePublico {
  /** Responde a requisição do domínio do site; sempre devolve true (nada cai no resto do app). */
  responder: (requisicao: FastifyRequest, resposta: FastifyReply) => Promise<boolean>;
}

interface PaginaEmMemoria {
  corpo: string;
  etag: string;
  tipo: string;
}

const ENTIDADES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere] ?? caractere);
}

function escaparJson(texto: string): string {
  return JSON.stringify(texto).slice(1, -1).replaceAll('<', '\\u003c');
}

function ligacoesDePreconnect(opcoes: OpcoesDoSitePublico): string {
  const estilos = opcoes.origensEstiloExterno.map(
    (o) => `<link rel="preconnect" href="${escaparHtml(o)}"/>`,
  );
  const fontes = opcoes.origensFonteExterna.map(
    (o) => `<link rel="preconnect" href="${escaparHtml(o)}" crossorigin=""/>`,
  );
  return [...estilos, ...fontes].join('');
}

// Os marcadores do build viram os valores desta instalação, com escape do tipo de arquivo.
function substituirMarcadores(conteudo: string, opcoes: OpcoesDoSitePublico): string {
  return conteudo
    .replaceAll('%NOME_NEGOCIO_JSON%', () => escaparJson(opcoes.nomeNegocio))
    .replaceAll('%NOME_NEGOCIO%', () => escaparHtml(opcoes.nomeNegocio))
    .replaceAll('%URL_SITE%', () => escaparHtml(opcoes.origemSite))
    .replaceAll('%URL_APP%', () => escaparHtml(opcoes.origemApp))
    .replaceAll('%PRECONNECT%', () => ligacoesDePreconnect(opcoes));
}

function rotaDaPagina(arquivo: string): string | undefined {
  if (arquivo === 'index.html') {
    return '/';
  }
  if (arquivo.endsWith('/index.html')) {
    return `/${arquivo.slice(0, -'index.html'.length)}`;
  }
  return EXTENSOES_DE_TEXTO.has(extname(arquivo)) && arquivo !== '404.html'
    ? `/${arquivo}`
    : undefined;
}

async function listarArquivos(raiz: string, pasta = ''): Promise<string[]> {
  const entradas = await readdir(join(raiz, pasta), { withFileTypes: true });
  const filhos = await Promise.all(
    entradas.map((entrada) =>
      entrada.isDirectory()
        ? listarArquivos(raiz, `${pasta}${entrada.name}/`)
        : Promise.resolve([`${pasta}${entrada.name}`]),
    ),
  );
  return filhos.flat();
}

async function carregarPaginas(opcoes: OpcoesDoSitePublico) {
  const paginas = new Map<string, PaginaEmMemoria>();
  let naoEncontrada: PaginaEmMemoria | undefined;
  for (const arquivo of await listarArquivos(opcoes.diretorio)) {
    const extensao = extname(arquivo);
    if (!EXTENSOES_DE_TEXTO.has(extensao)) {
      continue;
    }
    const corpo = substituirMarcadores(
      await readFile(join(opcoes.diretorio, arquivo), 'utf8'),
      opcoes,
    );
    const pagina = {
      corpo,
      etag: `"${createHash('sha256').update(corpo).digest('hex').slice(0, 32)}"`,
      tipo: TIPOS_DE_ARQUIVO[extensao] ?? 'text/plain; charset=utf-8',
    };
    const rota = rotaDaPagina(arquivo);
    if (rota !== undefined) {
      paginas.set(rota, pagina);
    } else if (arquivo === '404.html') {
      naoEncontrada = pagina;
    }
  }
  return { paginas, naoEncontrada };
}

function ehRotaDoApp(caminho: string): boolean {
  return PREFIXOS_DO_APP.some(
    (prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`),
  );
}

function enviarPagina(
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  pagina: PaginaEmMemoria,
  status = 200,
) {
  void resposta.header('Cache-Control', CACHE_DAS_PAGINAS).header('ETag', pagina.etag);
  if (status === 200 && requisicao.headers['if-none-match'] === pagina.etag) {
    return resposta.status(304).send();
  }
  return resposta.status(status).type(pagina.tipo).send(pagina.corpo);
}

async function enviarArquivo(
  raiz: string,
  caminho: string,
  resposta: FastifyReply,
): Promise<boolean> {
  const tipo = TIPOS_DE_ARQUIVO[extname(caminho).toLowerCase()];
  const destino = resolve(raiz, `.${caminho}`);
  const nome = caminho.slice(1);
  if (
    tipo === undefined ||
    ARQUIVOS_QUE_NAO_SAEM.has(nome) ||
    !destino.startsWith(`${raiz}${sep}`)
  ) {
    return false;
  }
  const informacoes = await stat(destino).catch(() => undefined);
  if (informacoes?.isFile() !== true) {
    return false;
  }
  const comHash = caminho.startsWith('/assets/');
  void resposta
    .header('Cache-Control', comHash ? CACHE_DOS_ARQUIVOS_COM_HASH : CACHE_DOS_DEMAIS_ARQUIVOS)
    .header('Content-Length', informacoes.size)
    .type(tipo)
    .send(createReadStream(destino));
  return true;
}

// Em produção o build do site é obrigatório; em desenvolvimento e nos testes, sem ele o domínio do site responde 404.
export async function prepararSiteDaConfiguracao(
  configuracao: Readonly<Configuracao>,
  diretorioInformado: string | undefined,
): Promise<SitePublico | undefined> {
  const diretorio = diretorioInformado ?? DIRETORIO_DO_BUILD_SITE;
  if (!existsSync(diretorio)) {
    if (configuracao.estaEmProducao) {
      throw new Error(`Build do site não encontrado em ${diretorio}; rode "npm run build".`);
    }
    return undefined;
  }
  return prepararSitePublico({
    diretorio,
    nomeNegocio: configuracao.nomeNegocio,
    origemApp: configuracao.origemApp,
    origemSite: configuracao.origemSite,
    origensEstiloExterno: configuracao.origensEstiloExterno,
    origensFonteExterna: configuracao.origensFonteExterna,
  });
}

export async function prepararSitePublico(opcoes: OpcoesDoSitePublico): Promise<SitePublico> {
  const raiz = resolve(opcoes.diretorio);
  const { paginas, naoEncontrada } = await carregarPaginas(opcoes);
  const pagina404: PaginaEmMemoria = naoEncontrada ?? {
    corpo: 'Página não encontrada.',
    etag: '"404"',
    tipo: 'text/plain; charset=utf-8',
  };

  return {
    async responder(requisicao, resposta) {
      if (!METODOS_ACEITOS.includes(requisicao.method)) {
        void resposta.header('Allow', METODOS_ACEITOS.join(', ')).status(405).send();
        return true;
      }
      const url = requisicao.url;
      const caminho = url.split('?')[0] ?? '/';
      const pagina = paginas.get(caminho);
      if (pagina !== undefined) {
        enviarPagina(requisicao, resposta, pagina);
      } else if (paginas.has(`${caminho}/`)) {
        void resposta.redirect(`${caminho}/`, STATUS_REDIRECIONAMENTO);
      } else if (ehRotaDoApp(caminho)) {
        void resposta.redirect(`${opcoes.origemApp}${url}`, STATUS_REDIRECIONAMENTO);
      } else if (!(await enviarArquivo(raiz, caminho, resposta))) {
        enviarPagina(requisicao, resposta, pagina404, 404);
      }
      return true;
    },
  };
}
