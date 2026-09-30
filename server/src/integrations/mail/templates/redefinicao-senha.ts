import type { ConteudoDeEmail } from '../enviador-email.js';

export function montarEmailDeRedefinicaoDeSenha(dados: {
  nomeNegocio: string;
  nomeUsuario: string;
  link: string;
}): ConteudoDeEmail {
  return {
    assunto: `Redefinição de senha no ${dados.nomeNegocio}`,
    texto: [
      `Olá, ${dados.nomeUsuario}!`,
      '',
      `Recebemos um pedido para redefinir sua senha no ${dados.nomeNegocio}. Para escolher uma nova, abra o link:`,
      dados.link,
      '',
      'O link vale por 1 hora e só pode ser usado uma vez.',
      'Se você não pediu isso, ignore esta mensagem: sua senha continua a mesma.',
    ].join('\n'),
  };
}
