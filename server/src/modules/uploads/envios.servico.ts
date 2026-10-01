import { createWriteStream } from 'node:fs';
import { basename, extname } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { TrabalhosServico } from '../../jobs/trabalhos.servico.js';
import { ErroDeConflito, ErroNaoEncontrado } from '../../shared/errors.js';
import type { ContaId, FonteId, ProjetoId, TrabalhoId, UsuarioId } from '../../shared/ids.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import type { ArmazenamentoDeEnvios } from './armazenamento-envios.js';
import type { Mapeamento, PreviaDoEnvio, TipoDeArquivo } from './envios.tipos.js';
import {
  erroAbaNaoEncontrada,
  erroArquivoGrande,
  erroArquivoInvalido,
  erroArquivoVazio,
  erroEnvioNaoEncontrado,
  erroMapeamentoInvalido,
} from './erros-envio.js';
import type { Fonte, FontesRepositorio } from './fontes.repositorio.js';
import { LINHAS_DA_PREVIA } from './limites-envio.js';
import { abrirLinhas } from './parsing/abrir-linhas.js';
import { listarAbas } from './parsing/leitor-xlsx.js';
import { celulaParaTexto } from './parsing/linha-para-comentario.js';
import { sugerirMapeamento } from './parsing/sugestoes-colunas.js';
import { validarConteudoDoEnvio } from './parsing/validar-conteudo.js';

export interface ArquivoRecebido {
  nomeOriginal: string;
  conteudo: Readable & { truncated?: boolean };
}

export interface EntradaDeConfirmacao {
  aba?: string | undefined;
  nomeArquivo?: string | undefined;
  mapeamento: Mapeamento;
}

export interface EnviosServico {
  receber(contaId: ContaId, projetoId: ProjetoId, arquivo: ArquivoRecebido): Promise<PreviaDoEnvio>;
  obterPrevia(
    contaId: ContaId,
    projetoId: ProjetoId,
    envioId: string,
    aba?: string,
  ): Promise<PreviaDoEnvio>;
  confirmar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    envioId: string,
    entrada: EntradaDeConfirmacao,
  ): Promise<{ trabalhoId: TrabalhoId; fonte: Fonte }>;
  obterFonte(contaId: ContaId, projetoId: ProjetoId, fonteId: FonteId): Promise<Fonte>;
}

export interface DependenciasDeEnvios {
  armazenamento: ArmazenamentoDeEnvios;
  projetos: ProjetosServico;
  fontes: FontesRepositorio;
  trabalhos: TrabalhosServico;
}

interface AmostraDoArquivo {
  cabecalho: string[];
  linhas: string[][];
  totalLinhas: number;
}

const TAMANHO_MAXIMO_DO_NOME = 120;
const NOME_PADRAO_DO_ARQUIVO = 'envio';
const REGEX_CARACTERES_DE_CONTROLE = /\p{Cc}/gu;

// O nome enviado só serve de rótulo na tela; o arquivo em disco usa o nome gerado pelo servidor.
export function limparNomeDoArquivo(nome: string): string {
  const base = basename(nome.replaceAll('\\', '/'))
    .replace(REGEX_CARACTERES_DE_CONTROLE, '')
    .trim();
  return base === '' ? NOME_PADRAO_DO_ARQUIVO : base.slice(0, TAMANHO_MAXIMO_DO_NOME);
}

function tipoDoEnvio(envioId: string): TipoDeArquivo {
  return extname(envioId) === '.xlsx' ? 'xlsx' : 'csv';
}

function nomesDasColunas(cabecalho: string[], largura: number): string[] {
  return Array.from({ length: largura }, (_vazio, indice) => {
    const nome = cabecalho[indice]?.trim();
    return nome === undefined || nome === '' ? `Coluna ${String(indice + 1)}` : nome;
  });
}

function validarMapeamento(mapeamento: Mapeamento): void {
  const usadas = Object.values(mapeamento).filter((coluna) => coluna !== undefined);
  if (new Set(usadas).size !== usadas.length) {
    throw erroMapeamentoInvalido();
  }
}

async function escolherAba(
  caminho: string,
  tipo: TipoDeArquivo,
  aba: string | undefined,
): Promise<{ abas: string[]; escolhida: string | undefined }> {
  if (tipo === 'csv') {
    return { abas: [], escolhida: undefined };
  }
  const abas = await listarAbas(caminho);
  const escolhida = aba ?? abas[0];
  if (escolhida === undefined || !abas.includes(escolhida)) {
    throw aba === undefined ? erroArquivoInvalido() : erroAbaNaoEncontrada();
  }
  return { abas, escolhida };
}

async function lerAmostra(
  caminho: string,
  tipo: TipoDeArquivo,
  aba: string | undefined,
): Promise<AmostraDoArquivo> {
  let cabecalho: string[] | undefined;
  const amostra: string[][] = [];
  let totalLinhas = 0;
  for await (const celulas of abrirLinhas(caminho, tipo, aba)) {
    const texto = celulas.map(celulaParaTexto);
    if (cabecalho === undefined) {
      cabecalho = texto;
      continue;
    }
    totalLinhas += 1;
    if (amostra.length < LINHAS_DA_PREVIA) {
      amostra.push(texto);
    }
  }
  if (cabecalho === undefined) {
    throw erroArquivoVazio();
  }
  const largura = Math.max(cabecalho.length, ...amostra.map((linha) => linha.length));
  return {
    cabecalho: nomesDasColunas(cabecalho, largura),
    linhas: amostra.map((linha) => Array.from({ length: largura }, (_v, i) => linha[i] ?? '')),
    totalLinhas,
  };
}

class EnviosServicoImpl implements EnviosServico {
  constructor(private readonly dep: DependenciasDeEnvios) {}

  async receber(contaId: ContaId, projetoId: ProjetoId, arquivo: ArquivoRecebido) {
    await this.dep.projetos.obter(contaId, projetoId);
    const extensao = extname(arquivo.nomeOriginal).toLowerCase();
    const { armazenamento } = this.dep;
    const { envioId, caminho } = await armazenamento.reservar(
      contaId,
      extensao === '.xlsx' ? 'xlsx' : 'csv',
    );
    try {
      await pipeline(arquivo.conteudo, createWriteStream(caminho));
      if (arquivo.conteudo.truncated === true) {
        throw erroArquivoGrande();
      }
      await validarConteudoDoEnvio(caminho, extensao);
      const nome = limparNomeDoArquivo(arquivo.nomeOriginal);
      return await this.montarPrevia(envioId, caminho, nome, undefined);
    } catch (erro) {
      await armazenamento.apagar(contaId, envioId);
      throw erro;
    }
  }

  async obterPrevia(contaId: ContaId, projetoId: ProjetoId, envioId: string, aba?: string) {
    await this.dep.projetos.obter(contaId, projetoId);
    const caminho = await this.localizar(contaId, envioId);
    return this.montarPrevia(envioId, caminho, '', aba);
  }

  async confirmar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    envioId: string,
    entrada: EntradaDeConfirmacao,
  ) {
    await this.dep.projetos.obter(contaId, projetoId);
    const caminho = await this.localizar(contaId, envioId);
    validarMapeamento(entrada.mapeamento);
    const { escolhida } = await escolherAba(caminho, tipoDoEnvio(envioId), entrada.aba);
    const ativos = await this.dep.trabalhos.listarAtivosDoTipo(contaId, 'import_upload');
    if (ativos.some((trabalho) => trabalho.carga.envioId === envioId)) {
      throw new ErroDeConflito('Este envio já está sendo importado.', 'envio_em_andamento');
    }
    const fonte = await this.dep.fontes.criarUpload(
      contaId,
      projetoId,
      limparNomeDoArquivo(entrada.nomeArquivo ?? ''),
    );
    try {
      const { trabalho } = await this.dep.trabalhos.criar(contaId, {
        tipo: 'import_upload',
        projetoId,
        criadoPor: usuarioId,
        carga: {
          fonteId: fonte.id,
          envioId,
          aba: escolhida ?? null,
          mapeamento: entrada.mapeamento,
        },
      });
      return { trabalhoId: trabalho.id, fonte };
    } catch (erro) {
      await this.dep.fontes.apagar(contaId, fonte.id);
      throw erro;
    }
  }

  async obterFonte(contaId: ContaId, projetoId: ProjetoId, fonteId: FonteId) {
    const fonte = await this.dep.fontes.buscarPorId(contaId, projetoId, fonteId);
    if (fonte === undefined) {
      throw new ErroNaoEncontrado('Fonte não encontrada.', 'fonte_nao_encontrada');
    }
    return fonte;
  }

  private async localizar(contaId: ContaId, envioId: string): Promise<string> {
    const caminho = this.dep.armazenamento.caminhoDoEnvio(contaId, envioId);
    if (!(await this.dep.armazenamento.existe(contaId, envioId))) {
      throw erroEnvioNaoEncontrado();
    }
    return caminho;
  }

  private async montarPrevia(
    envioId: string,
    caminho: string,
    nomeArquivo: string,
    abaPedida: string | undefined,
  ): Promise<PreviaDoEnvio> {
    const tipo = tipoDoEnvio(envioId);
    const { abas, escolhida } = await escolherAba(caminho, tipo, abaPedida);
    const amostra = await lerAmostra(caminho, tipo, escolhida);
    return {
      envioId,
      tipo,
      nomeArquivo,
      abas,
      aba: escolhida ?? null,
      ...amostra,
      sugestao: sugerirMapeamento(amostra.cabecalho),
    };
  }
}

export function criarEnviosServico(dep: DependenciasDeEnvios): EnviosServico {
  return new EnviosServicoImpl(dep);
}
