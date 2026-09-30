const CODIGO_VIOLACAO_UNICIDADE = '23505';
const CODIGO_VIOLACAO_CHAVE_ESTRANGEIRA = '23503';

function codigoDoErro(erro: unknown): unknown {
  return typeof erro === 'object' && erro !== null && 'code' in erro ? erro.code : undefined;
}

export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return codigoDoErro(erro) === CODIGO_VIOLACAO_UNICIDADE;
}

export function ehViolacaoDeChaveEstrangeira(erro: unknown): boolean {
  return codigoDoErro(erro) === CODIGO_VIOLACAO_CHAVE_ESTRANGEIRA;
}
