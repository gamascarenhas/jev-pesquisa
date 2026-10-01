import { requisitar } from './http';
import type { ConsumoDoPlano } from './types';

export const consumoApi = {
  obter: () => requisitar<ConsumoDoPlano>('GET', '/consumo'),
};
