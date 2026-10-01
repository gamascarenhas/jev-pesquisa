import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { iniciarCsv, montarLinhaDeCsv } from '../src/shared/safe-csv.js';
import { gerarComentariosDeDemonstracao } from './dados-demonstracao.js';

export const QUANTIDADE_NO_EXEMPLO = 100;
export const SEMENTE_DO_EXEMPLO = 20_260_202;
const CABECALHO_DO_EXEMPLO = ['Data', 'Cliente', 'Comentário', 'Nota', 'Loja'];
const CAMINHO_DO_EXEMPLO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../web/public/exemplo-comentarios.csv',
);

const formatadorDeData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
});

// Mesma semente, mesmo arquivo: o conteúdo nunca depende do dia nem da máquina.
export function gerarCsvDeExemplo(): string {
  const comentarios = gerarComentariosDeDemonstracao(QUANTIDADE_NO_EXEMPLO, {
    semente: SEMENTE_DO_EXEMPLO,
    chanceDeDadoPessoal: 0,
    numerar: false,
  });
  const linhas = comentarios.map((comentario) =>
    montarLinhaDeCsv([
      comentario.comentadoEm === null ? null : formatadorDeData.format(comentario.comentadoEm),
      comentario.autor,
      comentario.texto,
      comentario.nota,
      comentario.unidade,
    ]),
  );
  return iniciarCsv(CABECALHO_DO_EXEMPLO) + linhas.join('');
}

async function gerar(): Promise<void> {
  await mkdir(dirname(CAMINHO_DO_EXEMPLO), { recursive: true });
  await writeFile(CAMINHO_DO_EXEMPLO, gerarCsvDeExemplo(), 'utf8');
  process.stdout.write(`Arquivo de exemplo gerado em ${CAMINHO_DO_EXEMPLO}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  gerar().catch((erro: unknown) => {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exit(1);
  });
}
