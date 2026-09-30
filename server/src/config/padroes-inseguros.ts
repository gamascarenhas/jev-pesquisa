// Valores do .env.development.example; em produção, usá-los impede a inicialização.
export const SEGREDO_SESSAO_INSEGURO = 'desenvolvimento-inseguro-nao-use-em-producao-0000';

// Base64 de "inseguro-chave-dev-0123456789abc".
export const CHAVE_CRIPTOGRAFIA_INSEGURA = 'aW5zZWd1cm8tY2hhdmUtZGV2LTAxMjM0NTY3ODlhYmM=';

export const PADROES_INSEGUROS: readonly string[] = [
  SEGREDO_SESSAO_INSEGURO,
  CHAVE_CRIPTOGRAFIA_INSEGURA,
];
