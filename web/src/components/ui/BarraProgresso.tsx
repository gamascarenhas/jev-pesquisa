interface BarraProgressoProps {
  rotulo: string;
  valor: number;
  maximo: number;
}

// Sem total conhecido, a barra fica indeterminada.
export function BarraProgresso({ rotulo, valor, maximo }: BarraProgressoProps) {
  return (
    <progress
      className="barra-progresso"
      aria-label={rotulo}
      max={maximo > 0 ? maximo : undefined}
      value={maximo > 0 ? valor : undefined}
    />
  );
}
