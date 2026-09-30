import { useId, type InputHTMLAttributes, type Ref } from 'react';

import { cn } from '@/lib/cn';

import { campoVariantes } from './variants';

interface CampoTextoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string | undefined;
  ajuda?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

export function CampoTexto({ rotulo, erro, ajuda, className, id, ref, ...resto }: CampoTextoProps) {
  const idGerado = useId();
  const idDoCampo = id ?? idGerado;
  const idDaMensagem = `${idDoCampo}-mensagem`;
  const mensagem = erro ?? ajuda;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idDoCampo} className="texto-rotulo">
        {rotulo}
      </label>
      <input
        id={idDoCampo}
        ref={ref}
        aria-invalid={erro !== undefined}
        aria-describedby={mensagem === undefined ? undefined : idDaMensagem}
        className={cn(
          campoVariantes({ estado: erro === undefined ? 'normal' : 'erro' }),
          className,
        )}
        {...resto}
      />
      {mensagem !== undefined && (
        <p id={idDaMensagem} className={cn('texto-auxiliar', erro !== undefined && 'texto-erro')}>
          {mensagem}
        </p>
      )}
    </div>
  );
}
