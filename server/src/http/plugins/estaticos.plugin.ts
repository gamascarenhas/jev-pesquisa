import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const MARCADOR_NOME_NEGOCIO = '%NOME_NEGOCIO%';
const PREFIXO_DA_API = '/api';
const PREFIXO_DOS_ARQUIVOS_COM_HASH = '/assets/';
const CACHE_DOS_ARQUIVOS_COM_HASH = 'public, max-age=31536000, immutable';
const CACHE_DO_HTML = 'no-cache';
const ARQUIVO_INICIAL = 'index.html';
const SEPARADOR_DO_WINDOWS = String.fromCharCode(92);

export interface OpcoesEstaticos {
  diretorio: string;
  nomeNegocio: string;
}

const ENTIDADES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere] ?? caractere);
}

async function lerPaginaInicial({ diretorio, nomeNegocio }: OpcoesEstaticos): Promise<string> {
  let html: string;
  try {
    html = await readFile(join(diretorio, ARQUIVO_INICIAL), 'utf8');
  } catch {
    throw new Error(`Build do web não encontrado em ${diretorio}; rode "npm run build".`);
  }
  return html.replaceAll(MARCADOR_NOME_NEGOCIO, escaparHtml(nomeNegocio));
}

function ehPaginaDoApp(metodo: string, url: string): boolean {
  const caminho = url.split('?')[0] ?? '';
  const ehDaApi = caminho === PREFIXO_DA_API || caminho.startsWith(`${PREFIXO_DA_API}/`);
  const ehArquivo =
    caminho !== `/${ARQUIVO_INICIAL}` && (caminho.split('/').pop() ?? '').includes('.');
  return metodo === 'GET' && !ehDaApi && !ehArquivo;
}

export type TratadorDeRotaDoFront = (requisicao: FastifyRequest, resposta: FastifyReply) => boolean;

export interface EstaticosPreparados {
  /** Devolve true quando a rota não encontrada é uma página do front e já respondeu com o index.html. */
  tratarRotaDoFront: TratadorDeRotaDoFront;
  registrar: (app: FastifyInstance) => Promise<void>;
}

/** Lê o index.html (com o nome do negócio) e serve o build do web. */
export async function prepararEstaticos(opcoes: OpcoesEstaticos): Promise<EstaticosPreparados> {
  const paginaInicial = await lerPaginaInicial(opcoes);

  return {
    tratarRotaDoFront: (requisicao, resposta) => {
      if (!ehPaginaDoApp(requisicao.method, requisicao.url)) {
        return false;
      }
      void resposta
        .header('Cache-Control', CACHE_DO_HTML)
        .type('text/html; charset=utf-8')
        .send(paginaInicial);
      return true;
    },
    registrar: async (app) => {
      await app.register(fastifyStatic, {
        root: opcoes.diretorio,
        index: false,
        cacheControl: false,
        allowedPath: (caminho) => caminho !== '/' && caminho !== `/${ARQUIVO_INICIAL}`,
        setHeaders: (resposta, caminho) => {
          if (
            caminho.replaceAll(SEPARADOR_DO_WINDOWS, '/').includes(PREFIXO_DOS_ARQUIVOS_COM_HASH)
          ) {
            resposta.header('Cache-Control', CACHE_DOS_ARQUIVOS_COM_HASH);
          }
        },
      });
    },
  };
}
