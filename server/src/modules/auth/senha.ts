import argon2 from 'argon2';

export const TAMANHO_MINIMO_SENHA = 10;
export const TAMANHO_MAXIMO_SENHA = 128;

const OPCOES_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
} as const;

// Hash de um valor aleatório descartado, com os mesmos parâmetros de OPCOES_ARGON2.
const HASH_FALSO =
  '$argon2id$v=19$m=65536,p=4,t=3$RLEItw1meley3RdCGKsBZQ$WzedRE7CH8JmpW9+ZMPhfkQvEPN8fNTUj29g6HC2cJM';

export async function gerarHashDeSenha(senha: string): Promise<string> {
  return argon2.hash(senha, OPCOES_ARGON2);
}

export async function verificarSenha(hash: string, senha: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha);
  } catch {
    return false;
  }
}

// Gasta o mesmo tempo de uma verificação real, para o tempo não revelar se o e-mail existe.
export async function simularVerificacaoDeSenha(senha: string): Promise<void> {
  await verificarSenha(HASH_FALSO, senha);
}
