import type { ComponentProps, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

const ULTIMO_NIVEL_DE_TITULO = 6;

// O h1 da página é o título do artigo: os títulos do texto descem um nível, sem saltos.
function titulo(nivel: number) {
  const Tag = `h${String(Math.min(nivel + 1, ULTIMO_NIVEL_DE_TITULO))}` as 'h2';
  return function Titulo({ children }: { children?: ReactNode }) {
    return <Tag>{children}</Tag>;
  };
}

function Link({ href, children }: ComponentProps<'a'>) {
  const externo = href !== undefined && /^https?:\/\//i.test(href);
  return externo ? (
    <a href={href} rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <a href={href}>{children}</a>
  );
}

// Só a capa do frontmatter tem largura e altura conhecidas; imagem solta no texto não é renderizada.
function SemImagem() {
  return null;
}

/**
 * O react-markdown não interpreta HTML bruto: `<script>` e tags num artigo saem como texto.
 * Nenhum componente aqui usa dangerouslySetInnerHTML.
 */
export function CorpoDoArtigo({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: titulo(1),
        h2: titulo(2),
        h3: titulo(3),
        h4: titulo(4),
        h5: titulo(5),
        h6: titulo(6),
        a: Link,
        img: SemImagem,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
