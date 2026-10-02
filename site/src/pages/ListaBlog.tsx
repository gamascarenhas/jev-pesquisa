import type { Artigo } from '@site/blog/artigo';
import { CartaoDeArtigo } from '@site/components/CartaoDeArtigo';
import { LayoutPublico } from '@site/components/LayoutPublico';
import { textosDoSite } from '@site/i18n/site.pt-BR';
import { metadadosDoBlog } from '@site/seo/metadados';

interface ListaBlogProps {
  artigos: Artigo[];
  arquivosCss: string[];
}

export function ListaBlog({ artigos, arquivosCss }: ListaBlogProps) {
  const { blog } = textosDoSite;
  return (
    <LayoutPublico metadados={metadadosDoBlog()} arquivosCss={arquivosCss}>
      <section className="site-secao" aria-labelledby="titulo-blog">
        <div className="site-conteudo flex flex-col gap-6">
          <h1 id="titulo-blog" className="site-hero-titulo">
            {blog.titulo}
          </h1>
          <p className="site-subtitulo">{blog.descricao}</p>
          {artigos.length === 0 ? (
            <p className="site-texto-secundario">{blog.vazio}</p>
          ) : (
            <ul className="site-grade">
              {artigos.map((artigo) => (
                <CartaoDeArtigo key={artigo.slug} artigo={artigo} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </LayoutPublico>
  );
}
