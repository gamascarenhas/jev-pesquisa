import { etiquetaVariantes } from '@/components/ui/variants';
import { textosDoSite } from '@site/i18n/site.pt-BR';

type Comentario = (typeof textosDoSite.maquete.comentarios)[number];

export function MaquetePainel() {
  const { maquete } = textosDoSite;
  return (
    <figure className="site-maquete" aria-label={maquete.rotulo}>
      <div className="site-maquete-janela">
        <div className="site-maquete-barra">
          <span className="texto-rotulo">{maquete.titulo}</span>
          <span className="texto-auxiliar">{maquete.periodo}</span>
        </div>
        <div className="site-maquete-corpo">
          <ul className="flex flex-col gap-3">
            {maquete.comentarios.map((comentario) => (
              <ComentarioDaMaquete key={comentario.texto} comentario={comentario} />
            ))}
          </ul>
          <TemasDaMaquete />
        </div>
      </div>
      <figcaption className="texto-auxiliar">{maquete.aviso}</figcaption>
    </figure>
  );
}

function ComentarioDaMaquete({ comentario }: { comentario: Comentario }) {
  const { maquete } = textosDoSite;
  return (
    <li className="site-maquete-comentario">
      <p className="texto-corpo">{comentario.texto}</p>
      <div className="flex flex-wrap gap-2">
        <span className={etiquetaVariantes({ tom: 'info' })}>{comentario.tema}</span>
        <span className={etiquetaVariantes({ tom: comentario.sentimento.tom })}>
          {comentario.sentimento.rotulo}
        </span>
        <span className={etiquetaVariantes({ tom: comentario.gravidade.tom })}>
          {comentario.gravidade.rotulo}
        </span>
        {comentario.revisar && (
          <span className={etiquetaVariantes({ tom: 'atencao' })}>{maquete.revisar}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="texto-auxiliar">{maquete.confianca}</span>
        <progress
          className="barra-progresso"
          value={comentario.confianca}
          max={100}
          aria-hidden="true"
        />
        <span className="texto-auxiliar site-numero-tabular">{comentario.confianca}%</span>
      </div>
    </li>
  );
}

function TemasDaMaquete() {
  const { maquete } = textosDoSite;
  return (
    <div className="site-maquete-temas">
      <p className="texto-rotulo">{maquete.temasTitulo}</p>
      <ul className="flex flex-col gap-3">
        {maquete.temas.map((tema) => (
          <li key={tema.nome} className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="texto-auxiliar">{tema.nome}</span>
              <span className="texto-auxiliar site-numero-tabular">{tema.volume}%</span>
            </div>
            <progress
              className="barra-progresso"
              value={tema.volume}
              max={100}
              aria-hidden="true"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
