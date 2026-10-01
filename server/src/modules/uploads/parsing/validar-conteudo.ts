import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';

import { erroArquivoInvalido, erroDescompactadoGrande, erroFormatoXls } from '../erros-envio.js';
import type { TipoDeArquivo } from '../envios.tipos.js';
import { LIMITE_DESCOMPACTADO_BYTES } from '../limites-envio.js';

const ASSINATURA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ASSINATURA_OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ASSINATURA_FIM_DO_DIRETORIO = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const ASSINATURA_ENTRADA_DO_DIRETORIO = 0x02014b50;
const TAMANHO_MAXIMO_DO_FIM_DO_DIRETORIO = 22 + 65_535;
const TAMANHO_FIXO_DA_ENTRADA = 46;
const VALOR_ZIP64 = 0xffffffff;
const VALOR_ZIP64_CURTO = 0xffff;
const ARQUIVO_OBRIGATORIO_DO_XLSX = 'xl/workbook.xml';

async function lerCabecalho(caminho: string, tamanho: number): Promise<Buffer> {
  const arquivo = await open(caminho, 'r');
  try {
    const cabecalho = Buffer.alloc(tamanho);
    const { bytesRead } = await arquivo.read(cabecalho, 0, tamanho, 0);
    return cabecalho.subarray(0, bytesRead);
  } finally {
    await arquivo.close();
  }
}

interface ConteudoDoZip {
  nomes: string[];
  descompactadoBytes: number;
}

function localizarDiretorio(cauda: Buffer, tamanhoDoArquivo: number): Buffer | undefined {
  const posicao = cauda.lastIndexOf(ASSINATURA_FIM_DO_DIRETORIO);
  if (posicao < 0 || posicao + 22 > cauda.length) {
    return undefined;
  }
  const entradas = cauda.readUInt16LE(posicao + 10);
  const tamanho = cauda.readUInt32LE(posicao + 12);
  const deslocamento = cauda.readUInt32LE(posicao + 16);
  const emZip64 =
    entradas === VALOR_ZIP64_CURTO || tamanho === VALOR_ZIP64 || deslocamento === VALOR_ZIP64;
  return emZip64 || deslocamento + tamanho > tamanhoDoArquivo
    ? undefined
    : cauda.subarray(posicao, posicao + 22);
}

function lerEntradas(diretorio: Buffer, quantidade: number): ConteudoDoZip {
  const nomes: string[] = [];
  let descompactadoBytes = 0;
  let cursor = 0;
  for (let i = 0; i < quantidade; i += 1) {
    if (cursor + TAMANHO_FIXO_DA_ENTRADA > diretorio.length) {
      throw erroArquivoInvalido();
    }
    if (diretorio.readUInt32LE(cursor) !== ASSINATURA_ENTRADA_DO_DIRETORIO) {
      throw erroArquivoInvalido();
    }
    const tamanhoDescompactado = diretorio.readUInt32LE(cursor + 24);
    const tamanhoDoNome = diretorio.readUInt16LE(cursor + 28);
    const tamanhoDoExtra = diretorio.readUInt16LE(cursor + 30);
    const tamanhoDoComentario = diretorio.readUInt16LE(cursor + 32);
    if (tamanhoDescompactado === VALOR_ZIP64) {
      throw erroDescompactadoGrande();
    }
    descompactadoBytes += tamanhoDescompactado;
    nomes.push(
      diretorio.toString(
        'utf8',
        cursor + TAMANHO_FIXO_DA_ENTRADA,
        cursor + TAMANHO_FIXO_DA_ENTRADA + tamanhoDoNome,
      ),
    );
    cursor += TAMANHO_FIXO_DA_ENTRADA + tamanhoDoNome + tamanhoDoExtra + tamanhoDoComentario;
  }
  return { nomes, descompactadoBytes };
}

async function inspecionarZip(caminho: string, tamanhoDoArquivo: number): Promise<ConteudoDoZip> {
  const arquivo = await open(caminho, 'r');
  try {
    const tamanhoDaCauda = Math.min(tamanhoDoArquivo, TAMANHO_MAXIMO_DO_FIM_DO_DIRETORIO);
    const cauda = Buffer.alloc(tamanhoDaCauda);
    await arquivo.read(cauda, 0, tamanhoDaCauda, tamanhoDoArquivo - tamanhoDaCauda);
    const fim = localizarDiretorio(cauda, tamanhoDoArquivo);
    if (fim === undefined) {
      throw erroArquivoInvalido();
    }
    const quantidade = fim.readUInt16LE(10);
    const tamanho = fim.readUInt32LE(12);
    const diretorio = Buffer.alloc(tamanho);
    await arquivo.read(diretorio, 0, tamanho, fim.readUInt32LE(16));
    return lerEntradas(diretorio, quantidade);
  } finally {
    await arquivo.close();
  }
}

async function validarXlsx(caminho: string, tamanho: number): Promise<void> {
  const { nomes, descompactadoBytes } = await inspecionarZip(caminho, tamanho);
  if (!nomes.includes(ARQUIVO_OBRIGATORIO_DO_XLSX)) {
    throw erroArquivoInvalido();
  }
  if (descompactadoBytes > LIMITE_DESCOMPACTADO_BYTES) {
    throw erroDescompactadoGrande();
  }
}

async function contemByteNulo(caminho: string): Promise<boolean> {
  for await (const trecho of createReadStream(caminho)) {
    if ((trecho as Buffer).includes(0)) {
      return true;
    }
  }
  return false;
}

async function validarCsv(caminho: string): Promise<void> {
  if (await contemByteNulo(caminho)) {
    throw erroArquivoInvalido();
  }
}

// O conteúdo decide, não o tipo declarado: a extensão só escolhe qual formato conferir.
export async function validarConteudoDoEnvio(
  caminho: string,
  extensao: string,
): Promise<TipoDeArquivo> {
  const { size: tamanho } = await stat(caminho);
  const inicio = await lerCabecalho(caminho, ASSINATURA_OLE.length);
  if (extensao === '.xls' || inicio.equals(ASSINATURA_OLE)) {
    throw erroFormatoXls();
  }
  const ehZip = inicio.subarray(0, ASSINATURA_ZIP.length).equals(ASSINATURA_ZIP);
  if (extensao === '.xlsx' && ehZip) {
    await validarXlsx(caminho, tamanho);
    return 'xlsx';
  }
  if (extensao === '.csv' && !ehZip) {
    await validarCsv(caminho);
    return 'csv';
  }
  throw erroArquivoInvalido();
}
