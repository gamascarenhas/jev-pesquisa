import { z } from 'zod';

import { esquemaDePaginaBruta, paraAvaliacao } from './avaliacao-google.js';
import {
  ESCOPOS_DO_GOOGLE,
  ErroDoGoogle,
  TAMANHO_DA_PAGINA_DE_AVALIACOES,
  type ContaDoGoogle,
  type FonteDeAvaliacoes,
  type PaginaDeAvaliacoes,
  type TokensDaConexao,
  type TokensDoGoogle,
  type UnidadeDoGoogle,
} from './fonte-avaliacoes.js';

const URL_DE_AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_DO_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_DE_REVOGACAO = 'https://oauth2.googleapis.com/revoke';
const URL_DE_CONTAS = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const URL_DE_UNIDADES = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const URL_DE_AVALIACOES = 'https://mybusiness.googleapis.com/v4';
const CAMPOS_DA_UNIDADE = 'name,title,storefrontAddress';
const TAMANHO_DA_PAGINA_DE_UNIDADES = 100;
const TEMPO_LIMITE_MS = 15_000;
const MS_POR_SEGUNDO = 1000;

const STATUS_NAO_AUTORIZADO = 401;
const STATUS_SEM_ACESSO = 403;
const STATUS_LIMITE = 429;
const STATUS_PEDIDO_RECUSADO = 400;

const esquemaDeTokens = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  scope: z.string(),
  id_token: z.string().optional(),
});
const esquemaDeContas = z.object({
  accounts: z.array(z.object({ name: z.string(), accountName: z.string().optional() })).optional(),
  nextPageToken: z.string().optional(),
});
const esquemaDeUnidades = z.object({
  locations: z
    .array(
      z.object({
        name: z.string(),
        title: z.string().optional(),
        storefrontAddress: z
          .object({
            addressLines: z.array(z.string()).optional(),
            locality: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  nextPageToken: z.string().optional(),
});
const esquemaDoPayloadDoIdToken = z.object({ email: z.string() });

export interface OpcoesDaFonteReal {
  idCliente: string;
  segredoCliente: string;
  uriRedirecionamento: string;
}

function erroPorStatus(status: number): ErroDoGoogle {
  if (status === STATUS_NAO_AUTORIZADO) {
    return new ErroDoGoogle('nao_autorizado', status);
  }
  if (status === STATUS_SEM_ACESSO) {
    return new ErroDoGoogle('sem_acesso', status);
  }
  if (status === STATUS_LIMITE) {
    return new ErroDoGoogle('limite', status);
  }
  return new ErroDoGoogle('indisponivel', status);
}

async function chamar(url: string, init: RequestInit): Promise<unknown> {
  let resposta: Response;
  try {
    resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
  } catch {
    throw new ErroDoGoogle('indisponivel');
  }
  if (resposta.ok) {
    const corpo: unknown = resposta.status === 204 ? undefined : await resposta.json();
    return corpo;
  }
  // No endpoint do token, 400 quer dizer concessão revogada, expirada ou código inválido.
  if (url === URL_DO_TOKEN && resposta.status === STATUS_PEDIDO_RECUSADO) {
    throw new ErroDoGoogle('concessao_invalida', resposta.status);
  }
  throw erroPorStatus(resposta.status);
}

function postarFormulario(url: string, campos: Record<string, string>): Promise<unknown> {
  return chamar(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(campos).toString(),
  });
}

function comToken(tokenAcesso: string): RequestInit {
  return { headers: { authorization: `Bearer ${tokenAcesso}` } };
}

function lerEmailDoIdToken(idToken: string | undefined): string {
  const carga = idToken?.split('.')[1];
  if (carga === undefined) {
    throw new ErroDoGoogle('indisponivel');
  }
  // O token vem direto do endpoint do Google por TLS, então a assinatura não precisa ser conferida.
  const conteudo: unknown = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8'));
  return esquemaDoPayloadDoIdToken.parse(conteudo).email;
}

function paraTokens(tokens: z.infer<typeof esquemaDeTokens>): TokensDoGoogle {
  return {
    tokenAcesso: tokens.access_token,
    expiraEm: new Date(Date.now() + tokens.expires_in * MS_POR_SEGUNDO),
    escopos: tokens.scope.split(' '),
  };
}

function descreverEndereco(
  endereco: { addressLines?: string[] | undefined; locality?: string | undefined } | undefined,
): string | null {
  const partes = [...(endereco?.addressLines ?? []), endereco?.locality ?? ''].filter(
    (parte) => parte !== '',
  );
  return partes.length === 0 ? null : partes.join(', ');
}

// Nomes de campos e endereços conferidos em developers.google.com/my-business na fase 10.
export class FonteDeAvaliacoesGoogle implements FonteDeAvaliacoes {
  constructor(private readonly opcoes: OpcoesDaFonteReal) {}

  private get credenciais(): Record<string, string> {
    return { client_id: this.opcoes.idCliente, client_secret: this.opcoes.segredoCliente };
  }

  urlDeAutorizacao(state: string): string {
    const parametros = new URLSearchParams({
      client_id: this.opcoes.idCliente,
      redirect_uri: this.opcoes.uriRedirecionamento,
      response_type: 'code',
      scope: ESCOPOS_DO_GOOGLE.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${URL_DE_AUTORIZACAO}?${parametros.toString()}`;
  }

  async trocarCodigo(codigo: string): Promise<TokensDaConexao> {
    const tokens = esquemaDeTokens.parse(
      await postarFormulario(URL_DO_TOKEN, {
        ...this.credenciais,
        code: codigo,
        redirect_uri: this.opcoes.uriRedirecionamento,
        grant_type: 'authorization_code',
      }),
    );
    if (tokens.refresh_token === undefined) {
      throw new ErroDoGoogle('concessao_invalida');
    }
    return {
      ...paraTokens(tokens),
      tokenAtualizacao: tokens.refresh_token,
      email: lerEmailDoIdToken(tokens.id_token),
    };
  }

  async renovarToken(tokenAtualizacao: string): Promise<TokensDoGoogle> {
    return paraTokens(
      esquemaDeTokens.parse(
        await postarFormulario(URL_DO_TOKEN, {
          ...this.credenciais,
          refresh_token: tokenAtualizacao,
          grant_type: 'refresh_token',
        }),
      ),
    );
  }

  async revogar(token: string): Promise<void> {
    await postarFormulario(URL_DE_REVOGACAO, { token });
  }

  async listarContas(tokenAcesso: string): Promise<ContaDoGoogle[]> {
    const contas: ContaDoGoogle[] = [];
    let pagina: string | undefined;
    do {
      const consulta = new URLSearchParams(pagina === undefined ? {} : { pageToken: pagina });
      const resposta = esquemaDeContas.parse(
        await chamar(`${URL_DE_CONTAS}?${consulta.toString()}`, comToken(tokenAcesso)),
      );
      for (const conta of resposta.accounts ?? []) {
        contas.push({ id: conta.name, nome: conta.accountName ?? conta.name });
      }
      pagina = resposta.nextPageToken;
    } while (pagina !== undefined);
    return contas;
  }

  async listarUnidades(tokenAcesso: string, contaId: string): Promise<UnidadeDoGoogle[]> {
    const unidades: UnidadeDoGoogle[] = [];
    let pagina: string | undefined;
    do {
      const consulta = new URLSearchParams({
        readMask: CAMPOS_DA_UNIDADE,
        pageSize: String(TAMANHO_DA_PAGINA_DE_UNIDADES),
        ...(pagina === undefined ? {} : { pageToken: pagina }),
      });
      const url = `${URL_DE_UNIDADES}/${contaId}/locations?${consulta.toString()}`;
      const resposta = esquemaDeUnidades.parse(await chamar(url, comToken(tokenAcesso)));
      for (const unidade of resposta.locations ?? []) {
        // O v1 devolve `locations/{id}`; a API de avaliações pede `accounts/{conta}/locations/{id}`.
        unidades.push({
          nome: `${contaId}/${unidade.name}`,
          titulo: unidade.title ?? unidade.name,
          endereco: descreverEndereco(unidade.storefrontAddress),
        });
      }
      pagina = resposta.nextPageToken;
    } while (pagina !== undefined);
    return unidades;
  }

  async listarAvaliacoes(
    tokenAcesso: string,
    unidade: string,
    paginaToken: string | null,
  ): Promise<PaginaDeAvaliacoes> {
    const consulta = new URLSearchParams({
      pageSize: String(TAMANHO_DA_PAGINA_DE_AVALIACOES),
      orderBy: 'updateTime desc',
      ...(paginaToken === null ? {} : { pageToken: paginaToken }),
    });
    const url = `${URL_DE_AVALIACOES}/${unidade}/reviews?${consulta.toString()}`;
    const resposta = esquemaDePaginaBruta.parse(await chamar(url, comToken(tokenAcesso)));
    return {
      avaliacoes: (resposta.reviews ?? []).map(paraAvaliacao),
      proximaPagina: resposta.nextPageToken ?? null,
    };
  }
}

export function criarFonteDeAvaliacoesGoogle(opcoes: OpcoesDaFonteReal): FonteDeAvaliacoes {
  return new FonteDeAvaliacoesGoogle(opcoes);
}
