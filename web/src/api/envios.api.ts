import { enviarFormulario, requisitar } from './http';
import type {
  ConfirmacaoDoEnvio,
  FonteImportada,
  MapeamentoDeColunas,
  PreviaDoEnvio,
} from './types';

interface CorpoDeConfirmacao {
  aba?: string;
  nomeArquivo: string;
  mapeamento: MapeamentoDeColunas;
}

function caminhoDaPrevia(projetoId: string, envioId: string, aba: string | null): string {
  const consulta = aba === null ? '' : `?aba=${encodeURIComponent(aba)}`;
  return `/projetos/${projetoId}/envios/${envioId}/previa${consulta}`;
}

export const enviosApi = {
  enviar: (projetoId: string, arquivo: File) => {
    const formulario = new FormData();
    formulario.append('arquivo', arquivo);
    return enviarFormulario<PreviaDoEnvio>(`/projetos/${projetoId}/envios`, formulario);
  },
  previa: (projetoId: string, envioId: string, aba: string | null) =>
    requisitar<PreviaDoEnvio>('GET', caminhoDaPrevia(projetoId, envioId, aba)),
  confirmar: (projetoId: string, envioId: string, corpo: CorpoDeConfirmacao) =>
    requisitar<ConfirmacaoDoEnvio>(
      'POST',
      `/projetos/${projetoId}/envios/${envioId}/confirmar`,
      corpo,
    ),
  fonte: (projetoId: string, fonteId: string) =>
    requisitar<FonteImportada>('GET', `/projetos/${projetoId}/fontes/${fonteId}`),
};
