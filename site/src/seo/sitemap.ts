import { urlDoSite } from './metadados';

export interface PaginaDoIndice {
  caminho: string;
  /** AAAA-MM-DD: data de atualização do artigo ou do build da landing e da lista. */
  ultimaModificacao: string;
}

const ENTIDADES_XML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escaparXml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ENTIDADES_XML[caractere] ?? caractere);
}

// Só páginas públicas indexáveis; nunca rota do app nem /api.
export function gerarSitemap(paginas: PaginaDoIndice[]): string {
  const itens = paginas
    .map(
      (pagina) =>
        `  <url>\n    <loc>${escaparXml(urlDoSite(pagina.caminho))}</loc>\n    <lastmod>${pagina.ultimaModificacao}</lastmod>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${itens}\n</urlset>\n`;
}
