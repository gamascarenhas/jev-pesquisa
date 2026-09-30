import { createTransport, type Transporter } from 'nodemailer';

import type { EnviadorDeEmail, MensagemDeEmail } from './enviador-email.js';

const TEMPO_LIMITE_SMTP_MS = 10_000;

export interface OpcoesSmtp {
  servidor: string;
  porta: number;
  usuario: string;
  senha: string;
}

export function criarTransporteSmtp(opcoes: OpcoesSmtp): Transporter {
  return createTransport({
    host: opcoes.servidor,
    port: opcoes.porta,
    secure: opcoes.porta === 465,
    auth: { user: opcoes.usuario, pass: opcoes.senha },
    connectionTimeout: TEMPO_LIMITE_SMTP_MS,
    greetingTimeout: TEMPO_LIMITE_SMTP_MS,
    socketTimeout: TEMPO_LIMITE_SMTP_MS,
  });
}

export function criarEnviadorSmtp(
  transporte: Pick<Transporter, 'sendMail'>,
  remetente: { nome: string; endereco: string },
): EnviadorDeEmail {
  return {
    enviar: async (mensagem: MensagemDeEmail) => {
      await transporte.sendMail({
        from: { name: remetente.nome, address: remetente.endereco },
        to: mensagem.para,
        subject: mensagem.assunto,
        text: mensagem.texto,
      });
    },
  };
}
