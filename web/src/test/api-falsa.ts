import { vi } from 'vitest';

export interface RespostaFalsa {
  status?: number;
  corpo?: unknown;
}

export interface ChamadaFeita {
  metodo: string;
  caminho: string;
  corpo: unknown;
}

type Rotas = Record<string, RespostaFalsa | ((corpo: unknown) => RespostaFalsa)>;

/** Troca o fetch por uma API falsa; as chaves têm o formato "METODO /caminho". */
export function simularApi(rotas: Rotas): ChamadaFeita[] {
  const chamadas: ChamadaFeita[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      const caminho = url.replace(/^\/api/, '');
      const corpo: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      chamadas.push({ metodo, caminho, corpo });
      const definicao = rotas[`${metodo} ${caminho}`] ?? { status: 404, corpo: { erro: {} } };
      const resposta = typeof definicao === 'function' ? definicao(corpo) : definicao;
      const status = resposta.status ?? 200;
      const conteudo = status === 204 ? null : JSON.stringify(resposta.corpo ?? {});
      return Promise.resolve(new Response(conteudo, { status }));
    }),
  );
  return chamadas;
}

export function erroDaApi(status: number, codigo: string): RespostaFalsa {
  return { status, corpo: { erro: { codigo, mensagem: codigo, idRequisicao: 'teste' } } };
}
