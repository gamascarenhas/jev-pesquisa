import type { ReactNode } from 'react';

interface EstadoVazioProps {
  titulo: string;
  texto: string;
  acao?: ReactNode;
}

export function EstadoVazio({ titulo, texto, acao }: EstadoVazioProps) {
  return (
    <div className="superficie-plana flex flex-col items-center gap-3 px-6 py-12 text-center">
      <h2 className="texto-titulo-secao">{titulo}</h2>
      <p className="texto-corpo texto-secundario">{texto}</p>
      {acao}
    </div>
  );
}
