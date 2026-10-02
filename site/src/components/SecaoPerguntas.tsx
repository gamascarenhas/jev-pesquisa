import { ChevronDown } from 'lucide-react';

import { textosDoSite } from '@site/i18n/site.pt-BR';

// <details> abre e fecha sem JavaScript: a página inteira continua estática.
export function SecaoPerguntas() {
  const { perguntas } = textosDoSite;
  return (
    <section
      id="perguntas"
      className="site-secao site-secao-sutil"
      aria-labelledby="titulo-perguntas"
    >
      <div className="site-conteudo site-perguntas">
        <div className="flex flex-col gap-2">
          <h2 id="titulo-perguntas" className="site-titulo-secao">
            {perguntas.titulo}
          </h2>
          <p className="site-texto-secundario">{perguntas.subtitulo}</p>
        </div>
        <div className="flex flex-col gap-2">
          {perguntas.itens.map((item) => (
            <details key={item.pergunta} className="site-detalhes">
              <summary>
                {item.pergunta}
                <ChevronDown size="1.1rem" className="site-detalhes-seta" aria-hidden="true" />
              </summary>
              <p className="site-texto-secundario">{item.resposta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
