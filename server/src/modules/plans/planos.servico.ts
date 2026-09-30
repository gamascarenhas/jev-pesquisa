import type { Plano, PlanosSistemaRepositorio } from './planos.sistema.repositorio.js';

export type { Plano };

export interface PlanosServico {
  listar(): Promise<Plano[]>;
}

export function criarPlanosServico(repositorio: PlanosSistemaRepositorio): PlanosServico {
  return { listar: () => repositorio.listarAtivos() };
}
