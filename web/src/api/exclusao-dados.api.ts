import { requisitar } from './http';

export const exclusaoDadosApi = {
  apagarProjeto: (id: string, nomeProjeto: string) =>
    requisitar<undefined>('DELETE', `/projetos/${id}`, { nomeProjeto }),
  encerrarConta: (senha: string) => requisitar<undefined>('DELETE', '/conta', { senha }),
};
