import { textosDoSite } from '@site/i18n/site.pt-BR';

export function SecaoFormatos() {
  const { formatos } = textosDoSite;
  return (
    <section className="site-faixa" aria-labelledby="titulo-formatos">
      <div className="site-conteudo site-faixa-conteudo">
        <h2 id="titulo-formatos" className="texto-auxiliar">
          {formatos.titulo}
        </h2>
        <ul className="site-faixa-itens">
          {formatos.itens.map((item) => (
            <li key={item} className="site-faixa-item">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
