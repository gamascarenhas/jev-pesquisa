import type { ConteudoDeEmail } from '../enviador-email.js';

export function montarEmailDeContaJaExistente(dados: {
  nomeNegocio: string;
  linkEntrar: string;
  linkRedefinirSenha: string;
}): ConteudoDeEmail {
  return {
    assunto: `Já existe uma conta com este e-mail no ${dados.nomeNegocio}`,
    texto: [
      `Recebemos uma solicitação que usa este endereço no ${dados.nomeNegocio}, mas ele já pertence a uma conta.`,
      '',
      `Para entrar: ${dados.linkEntrar}`,
      `Se esqueceu a senha: ${dados.linkRedefinirSenha}`,
      '',
      'Se você não fez esta solicitação, ignore esta mensagem.',
    ].join('\n'),
  };
}
