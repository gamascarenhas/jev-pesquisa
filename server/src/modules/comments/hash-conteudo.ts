import { createHash } from 'node:crypto';

const SEPARADOR_DE_CAMPOS = '\u0000';

export interface CamposDoHash {
  texto: string;
  comentadoEm: Date | null;
  unidade: string | null;
  autor: string | null;
}

export function normalizarTextoParaHash(texto: string): string {
  return texto.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function calcularHashDeUpload(campos: CamposDoHash): string {
  return createHash('sha256')
    .update(
      [
        normalizarTextoParaHash(campos.texto),
        campos.comentadoEm?.toISOString() ?? '',
        normalizarTextoParaHash(campos.unidade ?? ''),
        normalizarTextoParaHash(campos.autor ?? ''),
      ].join(SEPARADOR_DE_CAMPOS),
    )
    .digest('hex');
}

export function calcularHashDoGoogle(idExterno: string): string {
  return createHash('sha256').update(`google:${idExterno}`).digest('hex');
}
