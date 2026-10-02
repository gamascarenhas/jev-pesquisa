import { botaoVariantes } from '@/components/ui/variants';
import { textosDoSite } from '@site/i18n/site.pt-BR';
import { urlDoApp } from '@site/seo/metadados';

import { MarcaDeConferido } from './Vinhetas';

export function SecaoChamadaFinal() {
  const { chamadaFinal } = textosDoSite;
  return (
    <section className="site-secao" aria-labelledby="titulo-chamada-final">
      <div className="site-conteudo">
        <div className="site-bloco site-chamada-final">
          <h2 id="titulo-chamada-final" className="site-titulo-secao">
            {chamadaFinal.titulo}
          </h2>
          <a href={urlDoApp('/cadastro')} className={botaoVariantes({ variante: 'primario' })}>
            {chamadaFinal.chamada}
          </a>
          <ul className="site-garantias">
            {chamadaFinal.garantias.map((garantia) => (
              <li key={garantia} className="flex items-center gap-2">
                <MarcaDeConferido />
                <span className="texto-corpo texto-secundario">{garantia}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
