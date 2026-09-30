import { requisitar } from './http';
import type { Pagina, Projeto } from './types';

export const TAMANHO_PAGINA_PROJETOS = 20;

export const projetosApi = {
  listar: (pagina: number) =>
    requisitar<Pagina<Projeto>>(
      'GET',
      `/projetos?pagina=${String(pagina)}&tamanhoPagina=${String(TAMANHO_PAGINA_PROJETOS)}`,
    ),
  criar: (nome: string) => requisitar<Projeto>('POST', '/projetos', { nome }),
  renomear: (id: string, nome: string) => requisitar<Projeto>('PATCH', `/projetos/${id}`, { nome }),
};
