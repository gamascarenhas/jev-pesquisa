import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_DO_IV = 12;
const VERSAO = 'v1';
const SEPARADOR = ':';

export interface Criptografia {
  criptografar(texto: string): string;
  descriptografar(cifrado: string): string;
}

// Formato "v1:iv:etiqueta:cifrado" em base64; o IV é novo a cada chamada.
export function criarCriptografia(chave: Buffer): Criptografia {
  return {
    criptografar(texto) {
      const iv = randomBytes(TAMANHO_DO_IV);
      const cifra = createCipheriv(ALGORITMO, chave, iv);
      const cifrado = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
      return [VERSAO, iv, cifra.getAuthTag(), cifrado]
        .map((parte) => (typeof parte === 'string' ? parte : parte.toString('base64')))
        .join(SEPARADOR);
    },

    descriptografar(cifrado) {
      const [versao, iv, etiqueta, conteudo] = cifrado.split(SEPARADOR);
      if (versao !== VERSAO || !iv || !etiqueta || !conteudo) {
        throw new Error('Texto criptografado em formato inválido.');
      }
      const decifra = createDecipheriv(ALGORITMO, chave, Buffer.from(iv, 'base64'));
      decifra.setAuthTag(Buffer.from(etiqueta, 'base64'));
      return Buffer.concat([
        decifra.update(Buffer.from(conteudo, 'base64')),
        decifra.final(),
      ]).toString('utf8');
    },
  };
}
