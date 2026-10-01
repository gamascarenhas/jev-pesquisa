import { requisitar } from './http';
import type { Trabalho } from './types';

export const trabalhosApi = {
  obter: (id: string) => requisitar<Trabalho>('GET', `/trabalhos/${id}`),
};
