import { urlDoSite } from './metadados';

// O site não bloqueia nada e aponta para o sitemap.
export function gerarRobots(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${urlDoSite('/sitemap.xml')}\n`;
}
