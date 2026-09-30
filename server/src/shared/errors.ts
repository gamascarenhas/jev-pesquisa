export interface CorpoDeErro {
  erro: {
    codigo: string;
    mensagem: string;
    idRequisicao: string;
  };
}

export class ErroDeDominio extends Error {
  constructor(
    readonly codigo: string,
    readonly statusHttp: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}

export class ErroDeValidacao extends ErroDeDominio {
  constructor(mensagem: string, codigo = 'entrada_invalida') {
    super(codigo, 400, mensagem);
  }
}

export class ErroNaoAutenticado extends ErroDeDominio {
  constructor(mensagem = 'Autenticação necessária.', codigo = 'nao_autenticado') {
    super(codigo, 401, mensagem);
  }
}

export class ErroProibido extends ErroDeDominio {
  constructor(mensagem = 'Ação não permitida.', codigo = 'proibido') {
    super(codigo, 403, mensagem);
  }
}

export class ErroNaoEncontrado extends ErroDeDominio {
  constructor(mensagem = 'Recurso não encontrado.', codigo = 'nao_encontrado') {
    super(codigo, 404, mensagem);
  }
}

export class ErroDeConflito extends ErroDeDominio {
  constructor(mensagem: string, codigo = 'conflito') {
    super(codigo, 409, mensagem);
  }
}

export class ErroServicoIndisponivel extends ErroDeDominio {
  constructor(mensagem = 'Serviço temporariamente indisponível.', codigo = 'servico_indisponivel') {
    super(codigo, 503, mensagem);
  }
}

export function montarCorpoDeErro(
  codigo: string,
  mensagem: string,
  idRequisicao: string,
): CorpoDeErro {
  return { erro: { codigo, mensagem, idRequisicao } };
}
