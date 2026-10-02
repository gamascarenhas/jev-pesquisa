import { useState, type SubmitEvent } from 'react';

import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { textos } from '@/i18n/pt-BR';

interface CampoDePerguntaProps {
  textoInicial: string;
  carregando: boolean;
  aoPerguntar: (texto: string) => void;
}

export function CampoDePergunta({ textoInicial, carregando, aoPerguntar }: CampoDePerguntaProps) {
  const [texto, setTexto] = useState(textoInicial);
  const { perguntar: t } = textos;

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (texto.trim().length >= 3) {
      aoPerguntar(texto.trim());
    }
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={enviar}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <CampoTexto
            rotulo={t.rotulo}
            placeholder={t.exemplo}
            value={texto}
            maxLength={500}
            onChange={(evento) => {
              setTexto(evento.target.value);
            }}
            ajuda={t.limites}
          />
        </div>
        <Botao type="submit" carregando={carregando} disabled={texto.trim().length < 3}>
          {carregando ? t.interpretando : t.perguntar}
        </Botao>
      </div>
    </form>
  );
}
