import { useState } from 'react';

import type { Comentario } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { Seletor } from '@/components/ui/Seletor';
import { useAvisos } from '@/components/ui/AvisoTemporario';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';
import { mensagemDeErro } from '@/lib/errors';

import { useCorrigirComentario } from '../hooks/use-fila-de-revisao';

const OPCOES_DE_TEMA = Object.entries(textos.rotulos.temas).map(([valor, rotulo]) => ({
  valor,
  rotulo,
}));
const OPCOES_DE_SENTIMENTO = Object.entries(textos.rotulos.sentimentos).map(([valor, rotulo]) => ({
  valor,
  rotulo,
}));

interface ItemDaFilaProps {
  projetoId: string;
  comentario: Comentario;
}

export function ItemDaFila({ projetoId, comentario }: ItemDaFilaProps) {
  const avisar = useAvisos();
  const [tema, setTema] = useState(comentario.tema ?? 'other');
  const [sentimento, setSentimento] = useState(comentario.sentimento ?? 'neutral');
  const correcao = useCorrigirComentario(projetoId, comentario.id, () => {
    avisar(textos.revisao.corrigido);
  });

  return (
    <li className="superficie-plana flex flex-col gap-4 p-4">
      <p className="texto-corpo whitespace-pre-line">{comentario.textoOriginal}</p>
      <p className="texto-auxiliar">
        {interpolar(textos.revisao.sugestaoDoModelo, {
          tema: textos.rotulos.temas[comentario.temaDoModelo ?? ''] ?? '—',
          sentimento: textos.rotulos.sentimentos[comentario.sentimentoDoModelo ?? ''] ?? '—',
        })}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Seletor
          rotulo={textos.revisao.tema}
          value={tema}
          opcoes={OPCOES_DE_TEMA}
          onChange={(e) => {
            setTema(e.target.value);
          }}
        />
        <Seletor
          rotulo={textos.revisao.sentimento}
          value={sentimento}
          opcoes={OPCOES_DE_SENTIMENTO}
          onChange={(e) => {
            setSentimento(e.target.value);
          }}
        />
      </div>
      {correcao.isError && <Alerta tom="critico">{mensagemDeErro(correcao.error)}</Alerta>}
      <div className="flex justify-end">
        <Botao
          carregando={correcao.isPending}
          onClick={() => {
            correcao.mutate({ tema, sentimento });
          }}
        >
          {textos.revisao.confirmar}
        </Botao>
      </div>
    </li>
  );
}
