import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as lerArquivoDeAmbiente } from 'dotenv';

import {
  esquemaAmbiente,
  normalizarVariaveis,
  verificarObrigatoriedadesCondicionais,
  type VariaveisAmbiente,
  type VariaveisBrutas,
} from './ambiente.esquema.js';
import { verificarTravasDeProducao } from './travas-producao.js';

export type AmbienteApp = 'development' | 'production';

export interface Configuracao {
  ambiente: AmbienteApp;
  estaEmProducao: boolean;
  urlApp: string;
  origemApp: string;
  nomeNegocio: string;
  versaoTermos: string;
  porta: number;
  confiarProxy: boolean;
  segredoSessao: string;
  chaveCriptografia: Buffer;
  urlBanco: string;
  urlBancoTestes: string | undefined;
  email: {
    provedor: 'log' | 'smtp';
    servidor: string | undefined;
    porta: number | undefined;
    usuario: string | undefined;
    senha: string | undefined;
    remetente: string | undefined;
  };
  jev: {
    simulado: boolean;
    chaveApi: string | undefined;
    modelo: string;
    concorrencia: number;
    precoPorMtok: number;
  };
  llm: {
    provedor: 'anthropic' | 'mock';
    chaveApi: string | undefined;
    modelo: string | undefined;
    precoEntradaPorMtok: number | undefined;
    precoSaidaPorMtok: number | undefined;
    resumoMaxTokens: number;
    limiarSustentacao: number;
  };
  perguntarMaxComentarios: number;
  google: {
    simulado: boolean;
    idCliente: string | undefined;
    segredoCliente: string | undefined;
    uriRedirecionamento: string | undefined;
    intervaloSincronizacaoHoras: number;
  };
  planoPadraoId: string;
  cobrancaAtivada: boolean;
  origensEstiloExterno: string[];
  origensFonteExterna: string[];
}

export class ErroDeConfiguracao extends Error {
  constructor(readonly problemas: string[]) {
    super(montarMensagem(problemas));
    this.name = 'ErroDeConfiguracao';
  }
}

const RAIZ_DO_REPOSITORIO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function montarMensagem(problemas: string[]): string {
  const linhas = problemas.map((problema) => `  - ${problema}`);
  return `Configuração inválida; corrija e reinicie:\n${linhas.join('\n')}`;
}

function montarServicosExternos(
  v: VariaveisAmbiente,
): Pick<Configuracao, 'email' | 'jev' | 'llm' | 'google'> {
  return {
    email: {
      provedor: v.PROVEDOR_EMAIL,
      servidor: v.SMTP_SERVIDOR,
      porta: v.SMTP_PORTA,
      usuario: v.SMTP_USUARIO,
      senha: v.SMTP_SENHA,
      remetente: v.EMAIL_REMETENTE,
    },
    jev: {
      simulado: v.JEV_SIMULADO,
      chaveApi: v.CHAVE_API_TYPESAFE,
      modelo: v.JEV_MODELO,
      concorrencia: v.JEV_CONCORRENCIA,
      precoPorMtok: v.JEV_PRECO_POR_MTOK,
    },
    llm: {
      provedor: v.LLM_PROVEDOR,
      chaveApi: v.LLM_CHAVE_API,
      modelo: v.LLM_MODELO,
      precoEntradaPorMtok: v.LLM_PRECO_ENTRADA_POR_MTOK,
      precoSaidaPorMtok: v.LLM_PRECO_SAIDA_POR_MTOK,
      resumoMaxTokens: v.LLM_RESUMO_MAX_TOKENS,
      limiarSustentacao: v.RESUMO_LIMIAR_SUSTENTACAO,
    },
    google: {
      simulado: v.GOOGLE_EMPRESA_SIMULADO,
      idCliente: v.GOOGLE_ID_CLIENTE,
      segredoCliente: v.GOOGLE_SEGREDO_CLIENTE,
      uriRedirecionamento: v.GOOGLE_URI_REDIRECIONAMENTO,
      intervaloSincronizacaoHoras: v.GOOGLE_INTERVALO_SINCRONIZACAO_HORAS,
    },
  };
}

function montarConfiguracao(ambiente: AmbienteApp, v: VariaveisAmbiente): Configuracao {
  return {
    ambiente,
    estaEmProducao: ambiente === 'production',
    urlApp: v.URL_APP,
    origemApp: new URL(v.URL_APP).origin,
    nomeNegocio: v.NOME_NEGOCIO,
    versaoTermos: v.VERSAO_TERMOS,
    porta: v.PORT,
    confiarProxy: v.CONFIAR_PROXY,
    segredoSessao: v.SEGREDO_SESSAO,
    chaveCriptografia: Buffer.from(v.CHAVE_CRIPTOGRAFIA, 'base64'),
    urlBanco: v.URL_BANCO,
    urlBancoTestes: v.URL_BANCO_TESTES,
    ...montarServicosExternos(v),
    perguntarMaxComentarios: v.PERGUNTAR_MAX_COMENTARIOS,
    planoPadraoId: v.PLANO_PADRAO_ID,
    cobrancaAtivada: v.COBRANCA_ATIVADA,
    origensEstiloExterno: v.ORIGENS_ESTILO_EXTERNO,
    origensFonteExterna: v.ORIGENS_FONTE_EXTERNA,
  };
}

function descreverProblemasDoEsquema(variaveis: Record<string, string>): {
  dados: VariaveisAmbiente | undefined;
  problemas: string[];
} {
  const resultado = esquemaAmbiente.safeParse(variaveis);
  if (resultado.success) {
    return { dados: resultado.data, problemas: [] };
  }
  const problemas = resultado.error.issues.map(
    (problema) => `${String(problema.path[0] ?? 'configuração')}: ${problema.message}`,
  );
  return { dados: undefined, problemas };
}

/** Valida as variáveis e devolve a configuração imutável; lança listando todos os problemas. */
export function validarConfiguracao(
  ambiente: AmbienteApp,
  variaveisBrutas: VariaveisBrutas,
): Readonly<Configuracao> {
  const variaveis = normalizarVariaveis(variaveisBrutas);
  const { dados, problemas } = descreverProblemasDoEsquema(variaveis);
  problemas.push(...verificarObrigatoriedadesCondicionais(variaveis));
  if (ambiente === 'production') {
    problemas.push(...verificarTravasDeProducao(variaveis));
  }
  if (dados === undefined || problemas.length > 0) {
    throw new ErroDeConfiguracao(problemas);
  }
  return Object.freeze(montarConfiguracao(ambiente, dados));
}

function lerAmbienteApp(valor: string | undefined): AmbienteApp {
  if (valor === 'development' || valor === 'production') {
    return valor;
  }
  throw new ErroDeConfiguracao([
    'AMBIENTE_APP: defina development ou production; os scripts do package.json já fazem isso',
  ]);
}

/** Único lugar que lê `process.env`; variáveis do processo prevalecem sobre o arquivo. */
export function carregarConfiguracao(): Readonly<Configuracao> {
  const ambiente = lerAmbienteApp(process.env.AMBIENTE_APP);
  const caminho = resolve(RAIZ_DO_REPOSITORIO, `.env.${ambiente}`);
  const existeArquivo = existsSync(caminho);
  const doArquivo = existeArquivo ? lerArquivoDeAmbiente(readFileSync(caminho)) : {};
  try {
    return validarConfiguracao(ambiente, { ...doArquivo, ...process.env });
  } catch (erro) {
    if (erro instanceof ErroDeConfiguracao && !existeArquivo) {
      throw new ErroDeConfiguracao([
        `Arquivo .env.${ambiente} não encontrado; copie .env.${ambiente}.example para .env.${ambiente}`,
        ...erro.problemas,
      ]);
    }
    throw erro;
  }
}
