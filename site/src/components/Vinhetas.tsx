import { Check, FileSpreadsheet, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';

import { etiquetaVariantes } from '@/components/ui/variants';
import { cn } from '@/lib/cn';
import { textosDoSite } from '@site/i18n/site.pt-BR';

const { vinhetas } = textosDoSite;

// Recortes decorativos da interface, no lugar de ilustrações: mostram o produto, não uma metáfora.
export function Vinheta({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('site-vinheta', className)} aria-hidden="true">
      {children}
    </div>
  );
}

export function MarcaDeConferido() {
  return (
    <span className="site-conferido">
      <Check size="0.8rem" strokeWidth={3} />
    </span>
  );
}

export function VinhetaDesordem() {
  const { desordem } = vinhetas;
  return (
    <Vinheta className="site-vinheta-desordem">
      <div className="site-recorte site-recorte-giro-a">
        {desordem.planilha.map((linha) => (
          <span key={linha} className="site-recorte-celula texto-auxiliar">
            {linha}
          </span>
        ))}
      </div>
      <div className="site-recorte site-recorte-giro-b flex flex-col gap-1">
        <span className="texto-rotulo site-estrelas">{desordem.avaliacao.estrelas}</span>
        <span className="texto-auxiliar">{desordem.avaliacao.texto}</span>
      </div>
      <div className="site-recorte site-recorte-mensagem site-recorte-giro-c">
        <span className="texto-auxiliar">{desordem.mensagem}</span>
      </div>
      <span className={cn(etiquetaVariantes({ tom: 'atencao' }), 'site-vinheta-selo')}>
        {desordem.naoLidos}
      </span>
    </Vinheta>
  );
}

export function VinhetaOrdem() {
  return (
    <Vinheta>
      <ul className="flex flex-col gap-2">
        {vinhetas.ordem.map((item) => (
          <li key={item.texto} className="site-recorte site-recorte-linha">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="texto-auxiliar site-texto-cortado">{item.texto}</span>
              <span className="flex flex-wrap gap-1">
                <span className={etiquetaVariantes({ tom: 'info' })}>{item.tema}</span>
                <span className={etiquetaVariantes({ tom: item.tom })}>{item.sentimento}</span>
              </span>
            </div>
            <MarcaDeConferido />
          </li>
        ))}
      </ul>
    </Vinheta>
  );
}

export function VinhetaImportar() {
  const { importar } = vinhetas;
  return (
    <Vinheta>
      <div className="area-envio site-recorte-envio">
        <FileSpreadsheet size="1.25rem" className="site-icone-acao" />
        <div className="flex min-w-0 flex-col">
          <span className="texto-rotulo site-texto-cortado">{importar.arquivo}</span>
          <span className="texto-auxiliar">{importar.linhas}</span>
        </div>
        <MarcaDeConferido />
      </div>
      <div className="site-recorte site-recorte-linha">
        <span className="flex min-w-0 items-center gap-2">
          <MapPin size="1.1rem" className="site-icone-acao" />
          <span className="flex min-w-0 flex-col">
            <span className="texto-rotulo site-texto-cortado">{importar.google}</span>
            <span className="texto-auxiliar">{importar.unidades}</span>
          </span>
        </span>
        <MarcaDeConferido />
      </div>
    </Vinheta>
  );
}

export function VinhetaClassificar() {
  const { classificar } = vinhetas;
  return (
    <Vinheta>
      <div className="site-recorte flex flex-col gap-2">
        <span className="texto-corpo">{classificar.texto}</span>
        <span className="flex flex-wrap gap-1">
          {classificar.etiquetas.map((etiqueta) => (
            <span key={etiqueta.rotulo} className={etiquetaVariantes({ tom: etiqueta.tom })}>
              {etiqueta.rotulo}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-2">
          <span className="texto-auxiliar">{classificar.confianca}</span>
          <progress className="barra-progresso" value={classificar.valor} max={100} />
          <span className="texto-auxiliar site-numero-tabular">{classificar.valor}%</span>
        </span>
      </div>
    </Vinheta>
  );
}

export function VinhetaPainel() {
  const { painel } = vinhetas;
  return (
    <Vinheta>
      <div className="grid grid-cols-2 gap-2">
        {painel.destaques.map((destaque) => (
          <div key={destaque.rotulo} className="site-recorte flex flex-col">
            <span className="texto-auxiliar">{destaque.rotulo}</span>
            <span className="texto-titulo-pagina site-numero-tabular">{destaque.valor}</span>
          </div>
        ))}
      </div>
      <div className="site-recorte flex flex-col gap-2">
        {painel.temas.map((tema) => (
          <span key={tema.nome} className="flex flex-col gap-1">
            <span className="texto-auxiliar">{tema.nome}</span>
            <progress className="barra-progresso" value={tema.volume} max={100} />
          </span>
        ))}
      </div>
    </Vinheta>
  );
}
