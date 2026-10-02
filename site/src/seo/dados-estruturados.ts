import { dataDeModificacao, type Artigo } from '@site/blog/artigo';
import { textosDoSite } from '@site/i18n/site.pt-BR';

import { urlDoSite } from './metadados';

export const MARCADOR_NOME_NEGOCIO_JSON = '%NOME_NEGOCIO_JSON%';
const CONTEXTO = 'https://schema.org';

export type DadoEstruturado = Record<string, unknown>;

// Só campos que existem de fato: nada de logotipo, redes sociais ou avaliações inventadas.
export function dadosDaOrganizacao(): DadoEstruturado {
  return {
    '@context': CONTEXTO,
    '@type': 'Organization',
    name: MARCADOR_NOME_NEGOCIO_JSON,
    url: urlDoSite('/'),
  };
}

export function dadosDoWebSite(): DadoEstruturado {
  return {
    '@context': CONTEXTO,
    '@type': 'WebSite',
    name: MARCADOR_NOME_NEGOCIO_JSON,
    url: urlDoSite('/'),
    inLanguage: textosDoSite.idioma,
  };
}

export function dadosDoArtigo(artigo: Artigo): DadoEstruturado {
  const endereco = urlDoSite(`/blog/${artigo.slug}/`);
  return {
    '@context': CONTEXTO,
    '@type': 'BlogPosting',
    headline: artigo.titulo,
    description: artigo.descricao,
    inLanguage: textosDoSite.idioma,
    datePublished: artigo.publicadoEm,
    dateModified: dataDeModificacao(artigo),
    author: { '@type': 'Person', name: artigo.autor },
    publisher: { '@type': 'Organization', name: MARCADOR_NOME_NEGOCIO_JSON, url: urlDoSite('/') },
    mainEntityOfPage: endereco,
    url: endereco,
    ...(artigo.imagem === undefined ? {} : { image: urlDoSite(`/blog/${artigo.imagem.arquivo}`) }),
  };
}

export function dadosDaTrilha(artigo: Artigo): DadoEstruturado {
  return {
    '@context': CONTEXTO,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: textosDoSite.blog.inicio, item: urlDoSite('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: textosDoSite.blog.titulo,
        item: urlDoSite('/blog/'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: artigo.titulo,
        item: urlDoSite(`/blog/${artigo.slug}/`),
      },
    ],
  };
}

// `<` vira < para o texto de um artigo nunca fechar o bloco de dados.
export function serializarDadoEstruturado(dado: DadoEstruturado): string {
  return JSON.stringify(dado).replaceAll('<', '\\u003c');
}
