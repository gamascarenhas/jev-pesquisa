import { describe, expect, it } from 'vitest';

import {
  gerarHashDeSenha,
  simularVerificacaoDeSenha,
  verificarSenha,
} from '../../../src/modules/auth/senha.js';
import { calcularHashDeToken, gerarToken } from '../../../src/modules/auth/tokens.js';

describe('senha', () => {
  it('gera hash argon2id que só confere com a senha original', async () => {
    const hash = await gerarHashDeSenha('senha-de-teste-123');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verificarSenha(hash, 'senha-de-teste-123')).resolves.toBe(true);
    await expect(verificarSenha(hash, 'outra-senha-123')).resolves.toBe(false);
  });

  it('dois hashes da mesma senha são diferentes', async () => {
    const [primeiro, segundo] = await Promise.all([
      gerarHashDeSenha('senha-de-teste-123'),
      gerarHashDeSenha('senha-de-teste-123'),
    ]);

    expect(primeiro).not.toBe(segundo);
  });

  it('hash malformado não confere e não lança', async () => {
    await expect(verificarSenha('isto-nao-e-um-hash', 'qualquer')).resolves.toBe(false);
  });

  it('a verificação simulada roda sem erro e gasta tempo de hash real', async () => {
    const inicio = performance.now();

    await simularVerificacaoDeSenha('qualquer-senha-123');

    expect(performance.now() - inicio).toBeGreaterThan(10);
  });
});

describe('tokens', () => {
  it('gera 32 bytes aleatórios em base64url e guarda só o SHA-256', () => {
    const { token, hashToken } = gerarToken();

    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hashToken).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken).toBe(calcularHashDeToken(token));
    expect(hashToken).not.toContain(token);
  });

  it('não repete tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => gerarToken().token));

    expect(tokens.size).toBe(50);
  });
});
