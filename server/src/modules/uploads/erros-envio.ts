import { ErroDeDominio, ErroDeValidacao, ErroNaoEncontrado } from '../../shared/errors.js';
import { LIMITE_LINHAS_ENVIO, TAMANHO_MAXIMO_ENVIO_BYTES } from './limites-envio.js';

const MEGABYTE = 1024 * 1024;

export function erroArquivoInvalido(): ErroDeValidacao {
  return new ErroDeValidacao(
    'Arquivo inválido. Envie uma planilha .csv ou .xlsx.',
    'arquivo_invalido',
  );
}

export function erroFormatoXls(): ErroDeValidacao {
  return new ErroDeValidacao(
    'Arquivos .xls não são suportados. Abra o arquivo no Excel e salve como .xlsx.',
    'formato_xls_nao_suportado',
  );
}

export function erroArquivoGrande(): ErroDeDominio {
  const limite = String(TAMANHO_MAXIMO_ENVIO_BYTES / MEGABYTE);
  return new ErroDeDominio(
    'arquivo_muito_grande',
    413,
    `O arquivo passa do limite de ${limite} MB.`,
  );
}

export function erroDescompactadoGrande(): ErroDeValidacao {
  return new ErroDeValidacao(
    'O conteúdo do arquivo é grande demais depois de descompactado.',
    'arquivo_descompactado_grande',
  );
}

export function erroLimiteDeLinhas(): ErroDeValidacao {
  return new ErroDeValidacao(
    `O arquivo passa do limite de ${LIMITE_LINHAS_ENVIO.toLocaleString('pt-BR')} linhas.`,
    'limite_de_linhas',
  );
}

export function erroArquivoVazio(): ErroDeValidacao {
  return new ErroDeValidacao('O arquivo não tem linhas para importar.', 'arquivo_vazio');
}

export function erroAbaNaoEncontrada(): ErroDeValidacao {
  return new ErroDeValidacao('A aba escolhida não existe no arquivo.', 'aba_nao_encontrada');
}

export function erroMapeamentoInvalido(): ErroDeValidacao {
  return new ErroDeValidacao('Cada coluna só pode ter um uso.', 'mapeamento_invalido');
}

export function erroEnvioNaoEncontrado(): ErroNaoEncontrado {
  return new ErroNaoEncontrado('Envio não encontrado.', 'envio_nao_encontrado');
}
