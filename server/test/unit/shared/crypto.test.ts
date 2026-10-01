import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { criarCriptografia } from '../../../src/shared/crypto.js';

describe('criptografia AES-256-GCM', () => {
  const chave = randomBytes(32);

  it('devolve o texto original e nunca repete o cifrado', () => {
    const criptografia = criarCriptografia(chave);

    const a = criptografia.criptografar('token-secreto');
    const b = criptografia.criptografar('token-secreto');

    expect(criptografia.descriptografar(a)).toBe('token-secreto');
    expect(a).not.toBe(b);
    expect(a).not.toContain('token-secreto');
  });

  it('recusa texto adulterado, chave diferente e formato inválido', () => {
    const cifrado = criarCriptografia(chave).criptografar('abc');
    const partes = cifrado.split(':');
    const adulterado = [partes[0], partes[1], partes[2], Buffer.from('xyz').toString('base64')];

    expect(() => criarCriptografia(chave).descriptografar(adulterado.join(':'))).toThrow();
    expect(() => criarCriptografia(randomBytes(32)).descriptografar(cifrado)).toThrow();
    expect(() => criarCriptografia(chave).descriptografar('invalido')).toThrow();
  });
});
