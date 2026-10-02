import { dataDeModificacao, type Artigo } from '@site/blog/artigo';
import { comNomeDoNegocio, textosDoSite } from '@site/i18n/site.pt-BR';

import { urlDoSite } from './metadados';
import { escaparXml } from './sitemap';

const HORA_DO_DIA = 'T12:00:00Z';

function entrada(artigo: Artigo): string {
  const endereco = escaparXml(urlDoSite(`/blog/${artigo.slug}/`));
  return [
    '  <entry>',
    `    <title>${escaparXml(artigo.titulo)}</title>`,
    `    <link href="${endereco}" />`,
    `    <id>${endereco}</id>`,
    `    <published>${artigo.publicadoEm}${HORA_DO_DIA}</published>`,
    `    <updated>${dataDeModificacao(artigo)}${HORA_DO_DIA}</updated>`,
    `    <author><name>${escaparXml(artigo.autor)}</name></author>`,
    `    <summary>${escaparXml(artigo.descricao)}</summary>`,
    '  </entry>',
  ].join('\n');
}

// Atom com os artigos publicados; rascunho nunca chega até aqui.
export function gerarFeed(artigos: Artigo[], atualizadoEm: string): string {
  const primeiro = artigos[0];
  const ultima = primeiro === undefined ? atualizadoEm : dataDeModificacao(primeiro);
  const titulo = `${textosDoSite.blog.tituloDaPagina} | ${comNomeDoNegocio('{nomeNegocio}')}`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pt-BR">',
    `  <title>${escaparXml(titulo)}</title>`,
    `  <link href="${escaparXml(urlDoSite('/blog/'))}" />`,
    `  <link rel="self" href="${escaparXml(urlDoSite('/feed.xml'))}" />`,
    `  <id>${escaparXml(urlDoSite('/blog/'))}</id>`,
    `  <updated>${ultima}${HORA_DO_DIA}</updated>`,
    ...artigos.map(entrada),
    '</feed>',
    '',
  ].join('\n');
}
