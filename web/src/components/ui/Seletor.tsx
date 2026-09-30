import { useId, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import { campoVariantes } from './variants';

interface OpcaoDoSeletor {
  valor: string;
  rotulo: string;
}

interface SeletorProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
  opcoes: OpcaoDoSeletor[];
}

export function Seletor({ rotulo, opcoes, className, id, ...resto }: SeletorProps) {
  const idGerado = useId();
  const idDoCampo = id ?? idGerado;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idDoCampo} className="texto-rotulo">
        {rotulo}
      </label>
      <select id={idDoCampo} className={cn(campoVariantes(), className)} {...resto}>
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
