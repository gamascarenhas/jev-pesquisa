import { dataDeModificacao, type Artigo } from '@site/blog/artigo';
import { comNomeDoNegocio, textosDoSite } from '@site/i18n/site.pt-BR';

// Marcadores trocados pelo servidor na inicialização: o build não depende de variável de ambiente.
export const MARCADOR_URL_SITE = '%URL_SITE%';
export const MARCADOR_URL_APP = '%URL_APP%';
export const IMAGEM_PADRAO = {
  caminho: '/imagem-compartilhamento.png',
  largura: 1200,
  altura: 630,
};

export interface Metadados {
  titulo: string;
  descricao: string;
  /** Caminho absoluto no site, com a barra final nas páginas que não são a raiz. */
  caminho: string;
  tipo: 'website' | 'article';
  imagem: { caminho: string; largura: number; altura: number; alt: string };
  indexavel: boolean;
  publicadoEm?: string;
  atualizadoEm?: string;
  autor?: string;
}

export function urlDoSite(caminho: string): string {
  return `${MARCADOR_URL_SITE}${caminho}`;
}

export function urlDoApp(caminho: string): string {
  return `${MARCADOR_URL_APP}${caminho}`;
}

const IMAGEM_COMPARTILHAMENTO = {
  ...IMAGEM_PADRAO,
  alt: comNomeDoNegocio(textosDoSite.seo.descricaoDaImagem),
};

export function metadadosDaLanding(): Metadados {
  return {
    titulo: comNomeDoNegocio(textosDoSite.seo.tituloDaLanding),
    descricao: textosDoSite.seo.descricaoDaLanding,
    caminho: '/',
    tipo: 'website',
    imagem: IMAGEM_COMPARTILHAMENTO,
    indexavel: true,
  };
}

export function metadadosDoBlog(): Metadados {
  return {
    titulo: comNomeDoNegocio(textosDoSite.seo.tituloDoBlog),
    descricao: textosDoSite.seo.descricaoDoBlog,
    caminho: '/blog/',
    tipo: 'website',
    imagem: IMAGEM_COMPARTILHAMENTO,
    indexavel: true,
  };
}

export function metadadosDoArtigo(artigo: Artigo): Metadados {
  const capa = artigo.imagem;
  return {
    titulo: `${artigo.titulo} | ${comNomeDoNegocio(textosDoSite.seo.sufixoDoArtigo)}`,
    descricao: artigo.descricao,
    caminho: `/blog/${artigo.slug}/`,
    tipo: 'article',
    imagem:
      capa === undefined
        ? IMAGEM_COMPARTILHAMENTO
        : {
            caminho: `/blog/${capa.arquivo}`,
            largura: capa.largura,
            altura: capa.altura,
            alt: capa.alt,
          },
    indexavel: true,
    publicadoEm: artigo.publicadoEm,
    atualizadoEm: dataDeModificacao(artigo),
    autor: artigo.autor,
  };
}

export function metadadosDaPaginaNaoEncontrada(): Metadados {
  return {
    titulo: `${textosDoSite.naoEncontrada.tituloDaPagina} | ${comNomeDoNegocio(textosDoSite.seo.sufixoDoArtigo)}`,
    descricao: textosDoSite.naoEncontrada.texto,
    caminho: '/404/',
    tipo: 'website',
    imagem: IMAGEM_COMPARTILHAMENTO,
    indexavel: false,
  };
}
