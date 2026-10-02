import { botaoVariantes } from '@/components/ui/variants';
import { comNomeDoNegocio, textosDoSite } from '@site/i18n/site.pt-BR';
import { urlDoApp } from '@site/seo/metadados';

import { MaquetePainel } from './MaquetePainel';

export function SecaoApresentacao() {
  const { apresentacao } = textosDoSite;
  return (
    <section className="site-secao site-apresentacao" aria-labelledby="titulo-apresentacao">
      <div className="site-conteudo site-apresentacao-grade">
        <div className="flex flex-col gap-6">
          <h1 id="titulo-apresentacao" className="site-hero-titulo">
            {apresentacao.titulo}
          </h1>
          <p className="site-subtitulo">{comNomeDoNegocio(apresentacao.subtitulo)}</p>
          <div className="pilha-horizontal">
            <a href={urlDoApp('/cadastro')} className={botaoVariantes({ variante: 'primario' })}>
              {apresentacao.chamada}
            </a>
            <a href={urlDoApp('/entrar')} className={botaoVariantes({ variante: 'fantasma' })}>
              {apresentacao.entrar}
            </a>
          </div>
          <p className="texto-auxiliar">{apresentacao.nota}</p>
        </div>
        <MaquetePainel />
      </div>
    </section>
  );
}
