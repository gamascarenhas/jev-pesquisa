import type { Registrador } from '../../shared/logger.js';
import type { EnviadorDeEmail, MensagemDeEmail } from './enviador-email.js';

// Só desenvolvimento: o link do e-mail aparece no log. Produção exige SMTP.
export function criarEnviadorLog(registrador: Registrador): EnviadorDeEmail {
  return {
    enviar: (mensagem: MensagemDeEmail) => {
      registrador.info({ categoria: 'email_simulado', ...mensagem }, 'e-mail simulado');
      return Promise.resolve();
    },
  };
}
