import { LayoutPublico } from '@site/components/LayoutPublico';
import { textosDoSite } from '@site/i18n/site.pt-BR';
import { metadadosDaPaginaNaoEncontrada } from '@site/seo/metadados';

export function NaoEncontrado({ arquivosCss }: { arquivosCss: string[] }) {
  const { naoEncontrada } = textosDoSite;
  return (
    <LayoutPublico metadados={metadadosDaPaginaNaoEncontrada()} arquivosCss={arquivosCss}>
      <section className="site-secao">
        <div className="site-conteudo flex flex-col items-start gap-4">
          <h1 className="site-hero-titulo">{naoEncontrada.titulo}</h1>
          <p className="site-subtitulo">{naoEncontrada.texto}</p>
          <a href="/" className="texto-link">
            {naoEncontrada.voltar}
          </a>
        </div>
      </section>
    </LayoutPublico>
  );
}
