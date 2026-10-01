import { requisitar } from './http';
import type { ContaDoGoogle, InicioDaSincronizacao, Lista, StatusDoGoogle } from './types';

const base = (projetoId: string): string => `/projetos/${projetoId}/google`;

export const googleApi = {
  status: (projetoId: string) => requisitar<StatusDoGoogle>('GET', base(projetoId)),
  conectar: (projetoId: string) =>
    requisitar<{ url: string }>('POST', `${base(projetoId)}/conectar`),
  unidades: (projetoId: string) =>
    requisitar<Lista<ContaDoGoogle>>('GET', `${base(projetoId)}/unidades`),
  escolherUnidades: (projetoId: string, unidades: string[]) =>
    requisitar<InicioDaSincronizacao>('PUT', `${base(projetoId)}/unidades`, { unidades }),
  sincronizar: (projetoId: string) =>
    requisitar<InicioDaSincronizacao>('POST', `${base(projetoId)}/sincronizar`),
  desconectar: (projetoId: string) => requisitar<undefined>('DELETE', base(projetoId)),
};
