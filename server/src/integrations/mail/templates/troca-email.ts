import type { ConteudoDeEmail } from '../enviador-email.js';

export function montarEmailDeTrocaDeEmail(dados: {
  nomeNegocio: string;
  nomeUsuario: string;
  link: string;
}): ConteudoDeEmail {
  return {
    assunto: `Confirme seu novo e-mail no ${dados.nomeNegocio}`,
    texto: [
      `Olá, ${dados.nomeUsuario}!`,
      '',
      `Recebemos um pedido para usar este endereço no ${dados.nomeNegocio}. Para confirmar a troca, abra o link:`,
      dados.link,
      '',
      'O link vale por 24 horas e só pode ser usado uma vez.',
      'Se você não pediu isso, ignore esta mensagem: nada muda até o link ser aberto.',
    ].join('\n'),
  };
}
