import type { ConteudoDeEmail } from '../enviador-email.js';

export function montarEmailDeConvite(dados: {
  nomeNegocio: string;
  nomeConvidante: string;
  nomeEmpresa: string;
  link: string;
}): ConteudoDeEmail {
  return {
    assunto: `${dados.nomeConvidante} convidou você para o ${dados.nomeNegocio}`,
    texto: [
      `${dados.nomeConvidante} convidou você para participar da conta de ${dados.nomeEmpresa} no ${dados.nomeNegocio}.`,
      '',
      'Para aceitar o convite, crie sua senha neste link:',
      dados.link,
      '',
      'O link vale por 7 dias e só pode ser usado uma vez.',
      'Se você não esperava este convite, ignore esta mensagem.',
    ].join('\n'),
  };
}
