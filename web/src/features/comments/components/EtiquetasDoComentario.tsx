import type { Comentario } from '@/api/types';
import { Etiqueta } from '@/components/ui/Etiqueta';
import type { TomDeEtiqueta } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';

const TOM_DO_SENTIMENTO: Record<string, TomDeEtiqueta> = {
  positive: 'info',
  neutral: 'neutro',
  negative: 'critico',
  mixed: 'atencao',
};

export function EtiquetaDeSentimento({ sentimento }: { sentimento: string | null }) {
  if (sentimento === null) {
    return <span className="texto-auxiliar">{textos.comentarios.semClassificacao}</span>;
  }
  return (
    <Etiqueta tom={TOM_DO_SENTIMENTO[sentimento] ?? 'neutro'}>
      {textos.rotulos.sentimentos[sentimento] ?? sentimento}
    </Etiqueta>
  );
}

export function IndicadoresDoComentario({ comentario }: { comentario: Comentario }) {
  return (
    <div className="pilha-horizontal">
      {comentario.precisaAcao === true && (
        <Etiqueta tom="atencao">{textos.comentarios.precisaAcao}</Etiqueta>
      )}
      {comentario.precisaRevisao && !comentario.foiRevisado && (
        <Etiqueta tom="info">{textos.comentarios.precisaRevisao}</Etiqueta>
      )}
      {comentario.foiRevisado && <Etiqueta tom="sucesso">{textos.comentarios.revisado}</Etiqueta>}
    </div>
  );
}
