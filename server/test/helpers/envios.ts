import type { AppDeTeste } from './build-app.js';
import { montarMultipart } from './arquivos.js';
import { chamar } from './login.js';

export const MAPEAMENTO_PADRAO = { comentario: 2, data: 0, nota: 3, unidade: 4, autor: 1 };
export const CABECALHO = 'Data;Cliente;Comentário;Nota;Loja\n';

export interface Previa {
  envioId: string;
  tipo: string;
  abas: string[];
  aba: string | null;
  cabecalho: string[];
  linhas: string[][];
  totalLinhas: number;
  sugestao: Record<string, number>;
}

export function linhasDeComentario(quantidade: number, prefixo = 'Atendimento'): string {
  return Array.from(
    { length: quantidade },
    (_v, i) =>
      `${String((i % 28) + 1).padStart(2, '0')}/02/2024;Cliente ${String(i)};${prefixo} número ${String(i)} muito bom;${String((i % 5) + 1)};Loja ${String(i % 3)}`,
  ).join('\n');
}

export function enviarArquivo(
  app: AppDeTeste,
  cookie: string,
  projetoId: string,
  nome: string,
  conteudo: Buffer,
) {
  const { corpo, cabecalhos } = montarMultipart(nome, conteudo);
  return chamar(app, {
    metodo: 'POST',
    url: `/api/projetos/${projetoId}/envios`,
    cookie,
    corpoBruto: corpo,
    cabecalhos,
  });
}

export function confirmarEnvio(
  app: AppDeTeste,
  cookie: string,
  projetoId: string,
  envioId: string,
  corpo: unknown,
) {
  return chamar(app, {
    metodo: 'POST',
    url: `/api/projetos/${projetoId}/envios/${envioId}/confirmar`,
    cookie,
    corpo,
  });
}
