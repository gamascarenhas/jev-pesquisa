import type { Artigo } from '@site/blog/artigo';
import { formatarDataDoArtigo } from '@site/blog/formatar-data';
import { textosDoSite } from '@site/i18n/site.pt-BR';

export function CartaoDeArtigo({ artigo }: { artigo: Artigo }) {
  const endereco = `/blog/${artigo.slug}/`;
  return (
    <li className="superficie-plana site-cartao">
      <p className="texto-auxiliar">
        <time dateTime={artigo.publicadoEm}>{formatarDataDoArtigo(artigo.publicadoEm)}</time>
      </p>
      <h2 className="texto-titulo-secao">
        <a href={endereco}>{artigo.titulo}</a>
      </h2>
      <p className="site-texto-secundario">{artigo.descricao}</p>
      <a
        href={endereco}
        className="texto-link"
        aria-label={`${textosDoSite.blog.lerArtigo}: ${artigo.titulo}`}
      >
        {textosDoSite.blog.lerArtigo}
      </a>
    </li>
  );
}
