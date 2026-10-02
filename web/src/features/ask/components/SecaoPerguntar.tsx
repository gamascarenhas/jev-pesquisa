import { useState } from 'react';

import type { FiltrosDoPainel, PerguntaDetalhada } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { BarraProgresso } from '@/components/ui/BarraProgresso';
import { Botao } from '@/components/ui/Botao';
import { textos } from '@/i18n/pt-BR';
import { formatarNumero, interpolar } from '@/lib/format';

import { useConfirmarPergunta, useInterpretarPergunta, usePergunta } from '../hooks/use-perguntas';
import { CampoDePergunta } from './CampoDePergunta';
import { ConfirmacaoDaPergunta } from './ConfirmacaoDaPergunta';
import { HistoricoDePerguntas } from './HistoricoDePerguntas';
import { ResultadoEmFaixas } from './ResultadoEmFaixas';

interface SecaoPerguntarProps {
  projetoId: string;
  filtros: FiltrosDoPainel;
}

function Andamento({ pergunta }: { pergunta: PerguntaDetalhada }) {
  const { perguntar: t } = textos;
  const { feito, total } = pergunta.progresso;
  return (
    <div className="flex flex-col gap-2">
      <BarraProgresso rotulo={t.rotulo} valor={feito} maximo={Math.max(total, 1)} />
      <p className="texto-auxiliar">
        {pergunta.status === 'paused_limit'
          ? t.pausada
          : interpolar(t.andamento, { feito: formatarNumero(feito), total: formatarNumero(total) })}
      </p>
    </div>
  );
}

function Falhou({ carregando, aoTentar }: { carregando: boolean; aoTentar: () => void }) {
  const { perguntar: t } = textos;
  return (
    <Alerta tom="critico">
      <p>{t.falhou}</p>
      <Botao variante="secundario" tamanho="sm" carregando={carregando} onClick={aoTentar}>
        {t.tentarDeNovo}
      </Botao>
    </Alerta>
  );
}

function NaoRespondivel({ motivo }: { motivo: string | null }) {
  return (
    <Alerta tom="info">
      <strong>{textos.perguntar.naoRespondivelTitulo}</strong>
      <p>{motivo}</p>
    </Alerta>
  );
}

function Estado({
  pergunta,
  projetoId,
  filtros,
  aoEditar,
}: SecaoPerguntarProps & { pergunta: PerguntaDetalhada; aoEditar: () => void }) {
  const confirmar = useConfirmarPergunta(projetoId, pergunta.id);
  const emAndamento = pergunta.status === 'running' || pergunta.status === 'paused_limit';

  if (pergunta.status === 'not_answerable') {
    return <NaoRespondivel motivo={pergunta.motivoNaoRespondivel} />;
  }
  if (pergunta.status === 'awaiting_confirmation') {
    return (
      <ConfirmacaoDaPergunta
        pergunta={pergunta}
        confirmando={confirmar.isPending}
        aoConfirmar={() => {
          confirmar.mutate();
        }}
        aoEditar={aoEditar}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {emAndamento && <Andamento pergunta={pergunta} />}
      {pergunta.status === 'failed' && (
        <Falhou
          carregando={confirmar.isPending}
          aoTentar={() => {
            confirmar.mutate();
          }}
        />
      )}
      {pergunta.progresso.feito > 0 && (
        <ResultadoEmFaixas
          projetoId={projetoId}
          perguntaId={pergunta.id}
          filtros={filtros}
          acompanhar={emAndamento}
        />
      )}
    </div>
  );
}

export function SecaoPerguntar({ projetoId, filtros }: SecaoPerguntarProps) {
  const [perguntaId, setPerguntaId] = useState<string | null>(null);
  const [textoParaEditar, setTextoParaEditar] = useState('');
  const interpretar = useInterpretarPergunta(projetoId);
  const { data: pergunta } = usePergunta(projetoId, perguntaId);

  return (
    <section className="flex flex-col gap-4">
      <CampoDePergunta
        key={textoParaEditar}
        textoInicial={textoParaEditar}
        carregando={interpretar.isPending}
        aoPerguntar={(texto) => {
          interpretar.mutate(
            { texto, filtros },
            {
              onSuccess: (nova) => {
                setPerguntaId(nova.id);
              },
            },
          );
        }}
      />
      {interpretar.isError && (
        <Alerta tom="critico">{interpretar.error.message || textos.perguntar.erro}</Alerta>
      )}
      {pergunta !== undefined && (
        <Estado
          pergunta={pergunta}
          projetoId={projetoId}
          filtros={filtros}
          aoEditar={() => {
            setTextoParaEditar(pergunta.texto);
            setPerguntaId(null);
          }}
        />
      )}
      <HistoricoDePerguntas projetoId={projetoId} aoAbrir={setPerguntaId} />
    </section>
  );
}
