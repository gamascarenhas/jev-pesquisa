import { requisitar } from './http';
import type {
  EstimativaDaClassificacao,
  InicioDaClassificacao,
  ProgressoDaClassificacao,
} from './types';

const base = (projetoId: string): string => `/projetos/${projetoId}/classificacao`;

export const classificacaoApi = {
  estimar: (projetoId: string) =>
    requisitar<EstimativaDaClassificacao>('GET', `${base(projetoId)}/estimativa`),
  iniciar: (projetoId: string) => requisitar<InicioDaClassificacao>('POST', base(projetoId)),
  progresso: (projetoId: string) =>
    requisitar<ProgressoDaClassificacao>('GET', `${base(projetoId)}/progresso`),
  reprocessarFalhas: (projetoId: string) =>
    requisitar<InicioDaClassificacao>('POST', `${base(projetoId)}/reprocessar-falhas`),
};
