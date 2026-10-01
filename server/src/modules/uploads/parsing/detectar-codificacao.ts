export type Codificacao = 'utf-8' | 'windows-1252';

const DECODIFICADOR_UTF8_ESTRITO = new TextDecoder('utf-8', { fatal: true });
const DECODIFICADOR_WINDOWS_1252 = new TextDecoder('windows-1252');

// UTF-8 inválido quase sempre é Windows-1252 de planilha exportada pelo Excel em português.
export function decodificarTexto(conteudo: Buffer): { texto: string; codificacao: Codificacao } {
  try {
    return { texto: DECODIFICADOR_UTF8_ESTRITO.decode(conteudo), codificacao: 'utf-8' };
  } catch {
    return { texto: DECODIFICADOR_WINDOWS_1252.decode(conteudo), codificacao: 'windows-1252' };
  }
}
