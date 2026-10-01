import { montarConsulta } from '@/lib/consulta';

import { requisitar } from './http';
import type { DadosDoPainel, FiltrosDoPainel, OpcoesDoPainel } from './types';

export function consultaDosFiltros(filtros: FiltrosDoPainel): string {
  return montarConsulta({ ...filtros });
}

export const painelApi = {
  consultar: (projetoId: string, filtros: FiltrosDoPainel) =>
    requisitar<DadosDoPainel>('GET', `/projetos/${projetoId}/painel${consultaDosFiltros(filtros)}`),
  opcoes: (projetoId: string) =>
    requisitar<OpcoesDoPainel>('GET', `/projetos/${projetoId}/painel/opcoes`),
  // O navegador baixa o arquivo direto pela rota, com os mesmos filtros da tela.
  enderecoDaExportacao: (projetoId: string, filtros: FiltrosDoPainel) =>
    `/api/projetos/${projetoId}/exportacao${consultaDosFiltros(filtros)}`,
};
