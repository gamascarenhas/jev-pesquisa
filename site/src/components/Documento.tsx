import type { ReactNode } from 'react';

import { textosDoSite } from '@site/i18n/site.pt-BR';
import { urlDoSite, type Metadados } from '@site/seo/metadados';

export const MARCADOR_PRECONNECT = 'marcador:preconnect';
export const MARCADOR_DADOS_ESTRUTURADOS = 'marcador:dados-estruturados';

interface DocumentoProps {
  metadados: Metadados;
  arquivosCss: string[];
  children: ReactNode;
}

// O <head> completo, em HTML estático; o prerender troca os dois marcadores por texto puro.
export function Documento({ metadados, arquivosCss, children }: DocumentoProps) {
  const endereco = urlDoSite(metadados.caminho);
  const imagem = urlDoSite(metadados.imagem.caminho);
  return (
    <html lang={textosDoSite.idioma} className="tema-escuro">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{metadados.titulo}</title>
        <meta name="description" content={metadados.descricao} />
        {!metadados.indexavel && <meta name="robots" content="noindex" />}
        <link rel="canonical" href={endereco} />
        <meta property="og:type" content={metadados.tipo} />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="%NOME_NEGOCIO%" />
        <meta property="og:title" content={metadados.titulo} />
        <meta property="og:description" content={metadados.descricao} />
        <meta property="og:url" content={endereco} />
        <meta property="og:image" content={imagem} />
        <meta property="og:image:width" content={String(metadados.imagem.largura)} />
        <meta property="og:image:height" content={String(metadados.imagem.altura)} />
        <meta property="og:image:alt" content={metadados.imagem.alt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metadados.titulo} />
        <meta name="twitter:description" content={metadados.descricao} />
        <meta name="twitter:image" content={imagem} />
        {metadados.publicadoEm !== undefined && (
          <meta property="article:published_time" content={metadados.publicadoEm} />
        )}
        {metadados.atualizadoEm !== undefined && (
          <meta property="article:modified_time" content={metadados.atualizadoEm} />
        )}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name={MARCADOR_PRECONNECT} content="" />
        {arquivosCss.map((arquivo) => (
          <link key={arquivo} rel="stylesheet" href={`/${arquivo}`} />
        ))}
        <meta name={MARCADOR_DADOS_ESTRUTURADOS} content="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
