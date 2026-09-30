import type { ConteudoDeEmail } from '../enviador-email.js';

export function montarEmailDeConfirmacao(dados: {
  nomeNegocio: string;
  nomeUsuario: string;
  link: string;
}): ConteudoDeEmail {
  return {
    assunto: `Confirme seu e-mail no ${dados.nomeNegocio}`,
    texto: [
      `Olá, ${dados.nomeUsuario}!`,
      '',
      `Para começar a usar o ${dados.nomeNegocio}, confirme seu e-mail neste link:`,
      dados.link,
      '',
      'O link vale por 24 horas e só pode ser usado uma vez.',
      'Se você não criou esta conta, ignore esta mensagem.',
    ].join('\n'),
  };
}
