import { ErroDaApi } from '@/api/http';
import { textos } from '@/i18n/pt-BR';

export function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof ErroDaApi)) {
    return textos.comum.erroPadrao;
  }
  if (erro.codigo === 'rede') {
    return textos.comum.erroRede;
  }
  return textos.erros[erro.codigo] ?? textos.comum.erroPadrao;
}

export function codigoDoErro(erro: unknown): string | undefined {
  return erro instanceof ErroDaApi ? erro.codigo : undefined;
}
