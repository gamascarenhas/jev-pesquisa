import { useId, type InputHTMLAttributes } from 'react';

interface CaixaDeSelecaoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  rotulo: string;
}

export function CaixaDeSelecao({ rotulo, id, ...resto }: CaixaDeSelecaoProps) {
  const idGerado = useId();
  const idDoCampo = id ?? idGerado;
  return (
    <div className="flex items-center gap-2">
      <input id={idDoCampo} type="checkbox" className="h-4 w-4" {...resto} />
      <label htmlFor={idDoCampo} className="texto-rotulo">
        {rotulo}
      </label>
    </div>
  );
}
