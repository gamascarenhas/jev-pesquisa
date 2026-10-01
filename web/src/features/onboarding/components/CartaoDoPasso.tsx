import type { ReactNode } from 'react';

import { Etiqueta } from '@/components/ui/Etiqueta';
import { textos } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';

export type SituacaoDoPasso = 'feito' | 'atual' | 'pendente';

interface CartaoDoPassoProps {
  numero: number;
  titulo: string;
  texto: string;
  situacao: SituacaoDoPasso;
  children?: ReactNode;
}

export function CartaoDoPasso({ numero, titulo, texto, situacao, children }: CartaoDoPassoProps) {
  return (
    <li
      aria-current={situacao === 'atual' ? 'step' : undefined}
      className={cn(
        'superficie-plana flex flex-col gap-3 p-4',
        situacao === 'atual' && 'borda-passo-atual',
      )}
    >
      <div className="pilha-horizontal justify-between">
        <span className="texto-rotulo">
          {String(numero)}. {titulo}
        </span>
        {situacao === 'feito' && <Etiqueta tom="sucesso">{textos.onboarding.feito}</Etiqueta>}
      </div>
      <p className="texto-auxiliar">{texto}</p>
      {situacao === 'atual' && children}
    </li>
  );
}
