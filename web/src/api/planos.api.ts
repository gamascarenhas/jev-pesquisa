import { requisitar } from './http';
import type { Lista, Plano } from './types';

export const planosApi = {
  listar: () => requisitar<Lista<Plano>>('GET', '/planos'),
};
