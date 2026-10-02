import { Botao } from '@/components/ui/Botao';
import { textos } from '@/i18n/pt-BR';
import { formatarData } from '@/lib/format';

import { useHistoricoDePerguntas } from '../hooks/use-perguntas';

interface HistoricoDePerguntasProps {
  projetoId: string;
  aoAbrir: (perguntaId: string) => void;
}

// Reabrir uma pergunta do histórico mostra o resultado que já existe, sem novo custo.
export function HistoricoDePerguntas({ projetoId, aoAbrir }: HistoricoDePerguntasProps) {
  const { data } = useHistoricoDePerguntas(projetoId);
  const { perguntar: t } = textos;
  if (data === undefined || data.itens.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2" aria-label={t.historico}>
      <h3 className="texto-rotulo">{t.historico}</h3>
      <ul className="flex flex-col gap-1">
        {data.itens.map((pergunta) => (
          <li key={pergunta.id} className="pilha-horizontal justify-between">
            <span className="texto-corpo">
              {pergunta.texto}
              <span className="texto-auxiliar"> · {formatarData(pergunta.criadoEm)}</span>
            </span>
            <Botao
              variante="fantasma"
              tamanho="sm"
              aria-label={`${t.abrir}: ${pergunta.texto}`}
              onClick={() => {
                aoAbrir(pergunta.id);
              }}
            >
              {t.abrir}
            </Botao>
          </li>
        ))}
      </ul>
    </section>
  );
}
