type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const PREFIXO_API = '/api';
const STATUS_SEM_CONTEUDO = 204;

export class ErroDaApi extends Error {
  constructor(
    readonly codigo: string,
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDaApi';
  }
}

interface CorpoDeErro {
  erro?: { codigo?: string; mensagem?: string };
}

async function lerErro(resposta: Response): Promise<ErroDaApi> {
  const corpo = (await resposta.json().catch(() => ({}))) as CorpoDeErro;
  return new ErroDaApi(
    corpo.erro?.codigo ?? 'erro_desconhecido',
    resposta.status,
    corpo.erro?.mensagem ?? '',
  );
}

export async function requisitar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${PREFIXO_API}${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? null : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroDaApi('rede', 0, '');
  }
  if (!resposta.ok) {
    throw await lerErro(resposta);
  }
  if (resposta.status === STATUS_SEM_CONTEUDO) {
    return undefined as T;
  }
  return (await resposta.json()) as T;
}
