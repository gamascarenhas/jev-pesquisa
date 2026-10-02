import { createHash } from 'node:crypto';

// Mesma pergunta, escrita com caixa ou espaços diferentes, tem o mesmo hash.
export function normalizarPergunta(texto: string): string {
  return texto.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function calcularHashDaPergunta(texto: string): string {
  return createHash('sha256').update(normalizarPergunta(texto)).digest('hex');
}
