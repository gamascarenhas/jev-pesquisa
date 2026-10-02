import { dataDeModificacao, type Artigo } from '@site/blog/artigo';
import { formatarDataDoArtigo } from '@site/blog/formatar-data';
import { CorpoDoArtigo } from '@site/blog/renderizar-markdown';
import { LayoutPublico } from '@site/components/LayoutPublico';
import { textosDoSite } from '@site/i18n/site.pt-BR';
import { metadadosDoArtigo } from '@site/seo/metadados';

interface ArtigoBlogProps {
  artigo: Artigo;
  arquivosCss: string[];
}

function Datas({ artigo }: { artigo: Artigo }) {
  const { blog } = textosDoSite;
  const atualizado = dataDeModificacao(artigo);
  return (
    <p className="texto-auxiliar">
      {blog.porAutor} {artigo.autor} · {blog.publicadoEm}{' '}
      <time dateTime={artigo.publicadoEm}>{formatarDataDoArtigo(artigo.publicadoEm)}</time>
      {artigo.atualizadoEm !== undefined && (
        <>
          {' · '}
          {blog.atualizadoEm} <time dateTime={atualizado}>{formatarDataDoArtigo(atualizado)}</time>
        </>
      )}
    </p>
  );
}

export function ArtigoBlog({ artigo, arquivosCss }: ArtigoBlogProps) {
  const { blog } = textosDoSite;
  return (
    <LayoutPublico metadados={metadadosDoArtigo(artigo)} arquivosCss={arquivosCss}>
      <article className="site-secao">
        <div className="site-leitura flex flex-col gap-4">
          <nav aria-label={blog.trilha} className="site-trilha">
            <a href="/">{blog.inicio}</a>
            <span aria-hidden="true">/</span>
            <a href="/blog/">{blog.titulo}</a>
          </nav>
          <h1 className="site-hero-titulo">{artigo.titulo}</h1>
          <Datas artigo={artigo} />
          {artigo.imagem !== undefined && (
            <img
              src={`/blog/${artigo.imagem.arquivo}`}
              alt={artigo.imagem.alt}
              width={artigo.imagem.largura}
              height={artigo.imagem.altura}
              className="site-capa"
              fetchPriority="high"
            />
          )}
          <div className="site-artigo">
            <CorpoDoArtigo markdown={artigo.corpo} />
          </div>
          <p>
            <a href="/blog/" className="texto-link">
              {blog.voltar}
            </a>
          </p>
        </div>
      </article>
    </LayoutPublico>
  );
}
