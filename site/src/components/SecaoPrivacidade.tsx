import { ArrowDown, Building2, EyeOff, Trash2 } from 'lucide-react';

import { textosDoSite } from '@site/i18n/site.pt-BR';
import { urlDoApp } from '@site/seo/metadados';

import { Vinheta } from './Vinhetas';

const ICONES_DA_PRIVACIDADE = [EyeOff, Trash2, Building2];

export function SecaoPrivacidade() {
  const { privacidade } = textosDoSite;
  return (
    <section className="site-secao site-secao-brilho" aria-labelledby="titulo-privacidade">
      <div className="site-conteudo site-privacidade">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 id="titulo-privacidade" className="site-titulo-secao">
              {privacidade.titulo}
            </h2>
            <p className="site-texto-secundario">{privacidade.subtitulo}</p>
          </div>
          <ExemploDeAnonimizacao />
          <p>
            <a href={urlDoApp('/privacidade')} className="texto-link">
              {privacidade.link}
            </a>
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {privacidade.itens.map((item, indice) => {
            const Icone = ICONES_DA_PRIVACIDADE[indice] ?? EyeOff;
            return (
              <li key={item.titulo} className="site-bloco site-cartao-icone">
                <span className="site-icone-destaque" aria-hidden="true">
                  <Icone size="1.1rem" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="texto-titulo-secao">{item.titulo}</h3>
                  <p className="site-texto-secundario">{item.texto}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ExemploDeAnonimizacao() {
  const { exemplo } = textosDoSite.privacidade;
  return (
    <figure className="flex flex-col gap-2" aria-label={exemplo.rotulo}>
      <Vinheta>
        <div className="site-recorte flex flex-col gap-1">
          <span className="texto-auxiliar">{exemplo.antesRotulo}</span>
          <span className="texto-corpo">{exemplo.antes}</span>
        </div>
        <ArrowDown size="1rem" className="site-icone-acao self-center" />
        <div className="site-recorte site-recorte-ativo flex flex-col gap-1">
          <span className="texto-auxiliar">{exemplo.depoisRotulo}</span>
          <span className="texto-corpo">{exemplo.depois}</span>
        </div>
      </Vinheta>
    </figure>
  );
}
