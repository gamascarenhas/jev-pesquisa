import type { ImportacaoDeEnvios } from '../../modules/uploads/importacao-envios.js';
import type { ManipuladorDeTrabalho } from '../trabalhos.tipos.js';

export function criarManipuladorImportarEnvio(
  importacao: ImportacaoDeEnvios,
): ManipuladorDeTrabalho {
  return (contexto) => importacao.importar(contexto.trabalho, contexto);
}
