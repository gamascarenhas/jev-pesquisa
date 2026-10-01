import { requisitar } from './http';
import type { ComentarioCitado, InicioDaSincronizacao, Lista, ListaDeResumos } from './types';

const base = (projetoId: string): string => `/projetos/${projetoId}/resumos`;

export const resumosApi = {
  listar: (projetoId: string) => requisitar<ListaDeResumos>('GET', base(projetoId)),
  gerar: (projetoId: string) => requisitar<InicioDaSincronizacao>('POST', base(projetoId), {}),
  comentariosDoAchado: (projetoId: string, resumoId: string, indice: number) =>
    requisitar<Lista<ComentarioCitado>>(
      'GET',
      `${base(projetoId)}/${resumoId}/achados/${String(indice)}/comentarios`,
    ),
};
