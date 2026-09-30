import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useArmadilhaDeFoco } from '@/hooks/use-armadilha-de-foco';

interface ModalProps {
  titulo: string;
  descricao?: string;
  aoFechar: () => void;
  children: ReactNode;
}

export function Modal({ titulo, descricao, aoFechar, children }: ModalProps) {
  const idTitulo = useId();
  const idDescricao = useId();
  const refDialogo = useRef<HTMLDivElement>(null);
  useArmadilhaDeFoco(refDialogo, aoFechar);

  return createPortal(
    <div className="sobreposicao camada-modal fixed inset-0 flex items-center justify-center p-4">
      <div
        ref={refDialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descricao === undefined ? undefined : idDescricao}
        tabIndex={-1}
        className="superficie-elevada movimento-entrada flex max-h-full w-full max-w-modal flex-col gap-4 overflow-y-auto p-6"
      >
        <h2 id={idTitulo} className="texto-titulo-secao">
          {titulo}
        </h2>
        {descricao !== undefined && (
          <p id={idDescricao} className="texto-corpo texto-secundario">
            {descricao}
          </p>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
