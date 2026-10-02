import { renderToStaticMarkup } from 'react-dom/server';

import type { Artigo } from '@site/blog/artigo';
import { ArtigoBlog } from '@site/pages/ArtigoBlog';
import { Landing } from '@site/pages/Landing';
import { ListaBlog } from '@site/pages/ListaBlog';
import { NaoEncontrado } from '@site/pages/NaoEncontrado';
import {
  dadosDaOrganizacao,
  dadosDaTrilha,
  dadosDoArtigo,
  dadosDoWebSite,
  serializarDadoEstruturado,
  type DadoEstruturado,
} from '@site/seo/dados-estruturados';

import { MARCADOR_DADOS_ESTRUTURADOS, MARCADOR_PRECONNECT } from './components/Documento';

export type PaginaParaRenderizar =
  | { tipo: 'landing' }
  | { tipo: 'lista'; artigos: Artigo[] }
  | { tipo: 'artigo'; artigo: Artigo }
  | { tipo: 'nao-encontrado' };

export const TEXTO_DO_PRECONNECT = '%PRECONNECT%';

function elementoDa(pagina: PaginaParaRenderizar, arquivosCss: string[]) {
  switch (pagina.tipo) {
    case 'landing':
      return <Landing arquivosCss={arquivosCss} />;
    case 'lista':
      return <ListaBlog artigos={pagina.artigos} arquivosCss={arquivosCss} />;
    case 'artigo':
      return <ArtigoBlog artigo={pagina.artigo} arquivosCss={arquivosCss} />;
    case 'nao-encontrado':
      return <NaoEncontrado arquivosCss={arquivosCss} />;
  }
}

export function dadosEstruturadosDa(pagina: PaginaParaRenderizar): DadoEstruturado[] {
  if (pagina.tipo === 'landing') {
    return [dadosDaOrganizacao(), dadosDoWebSite()];
  }
  return pagina.tipo === 'artigo'
    ? [dadosDoArtigo(pagina.artigo), dadosDaTrilha(pagina.artigo)]
    : [];
}

function marcador(nome: string): RegExp {
  return new RegExp(`<meta name="${nome}"[^>]*>`);
}

// JSON-LD e preconnect entram como texto puro: nenhum componente usa dangerouslySetInnerHTML.
export function renderizarPagina(pagina: PaginaParaRenderizar, arquivosCss: string[]): string {
  const html = `<!doctype html>${renderToStaticMarkup(elementoDa(pagina, arquivosCss))}`;
  const blocos = dadosEstruturadosDa(pagina)
    .map((dado) => `<script type="application/ld+json">${serializarDadoEstruturado(dado)}</script>`)
    .join('');
  return html
    .replace('<meta charSet="utf-8"/>', '<meta charset="utf-8"/>')
    .replace(marcador(MARCADOR_PRECONNECT), TEXTO_DO_PRECONNECT)
    .replace(marcador(MARCADOR_DADOS_ESTRUTURADOS), () => blocos);
}
