import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import { botaoVariantes, type VariantesDoBotao } from './variants';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantesDoBotao {
  carregando?: boolean;
}

export function Botao({
  variante,
  tamanho,
  carregando = false,
  disabled,
  className,
  type = 'button',
  children,
  ...resto
}: BotaoProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || carregando}
      aria-busy={carregando}
      className={cn(botaoVariantes({ variante, tamanho }), className)}
      {...resto}
    >
      {children}
    </button>
  );
}
