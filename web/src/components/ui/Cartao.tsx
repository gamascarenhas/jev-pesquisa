import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface CartaoProps {
  titulo?: string;
  descricao?: string;
  className?: string;
  children: ReactNode;
}

export function Cartao({ titulo, descricao, className, children }: CartaoProps) {
  return (
    <section className={cn('superficie-plana flex flex-col gap-4 p-6', className)}>
      {titulo !== undefined && (
        <header className="flex flex-col gap-1">
          <h2 className="texto-titulo-secao">{titulo}</h2>
          {descricao !== undefined && <p className="texto-auxiliar">{descricao}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
