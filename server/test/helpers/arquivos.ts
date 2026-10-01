import ExcelJS from 'exceljs';

export function codificarCsvWindows1252(texto: string): Buffer {
  return Buffer.from(texto, 'latin1');
}

export function montarMultipart(
  nomeDoArquivo: string,
  conteudo: Buffer,
): { corpo: Buffer; cabecalhos: Record<string, string> } {
  const limite = '----limite-de-teste';
  const abertura = Buffer.from(
    `--${limite}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nomeDoArquivo}"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n',
  );
  const fechamento = Buffer.from(`\r\n--${limite}--\r\n`);
  return {
    corpo: Buffer.concat([abertura, conteudo, fechamento]),
    cabecalhos: { 'content-type': `multipart/form-data; boundary=${limite}` },
  };
}

export interface AbaDeTeste {
  nome: string;
  linhas: (string | number | Date | null)[][];
}

export async function criarXlsx(abas: AbaDeTeste[]): Promise<Buffer> {
  const planilha = new ExcelJS.Workbook();
  for (const aba of abas) {
    const folha = planilha.addWorksheet(aba.nome);
    for (const linha of aba.linhas) {
      folha.addRow(linha);
    }
  }
  return Buffer.from(await planilha.xlsx.writeBuffer());
}

// ZIP só com o diretório central, o bastante para a validação por conteúdo sem extrair nada.
export function criarZipComTamanhos(entradas: { nome: string; descompactado: number }[]): Buffer {
  const diretorio = Buffer.concat(
    entradas.map(({ nome, descompactado }) => {
      const nomeEmBytes = Buffer.from(nome);
      const entrada = Buffer.alloc(46);
      entrada.writeUInt32LE(0x02014b50, 0);
      entrada.writeUInt32LE(descompactado, 24);
      entrada.writeUInt16LE(nomeEmBytes.length, 28);
      return Buffer.concat([entrada, nomeEmBytes]);
    }),
  );
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(4, 16);
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), diretorio, fim]);
}
