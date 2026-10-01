import type { Configuracao } from './config/config.js';
import { criarEnviadorLog } from './integrations/mail/enviador-log.js';
import type { EnviadorDeEmail } from './integrations/mail/enviador-email.js';
import { criarEnviadorSmtp, criarTransporteSmtp } from './integrations/mail/enviador-smtp.js';
import type { Registrador } from './shared/logger.js';
import { criarClassificadorJev } from './integrations/jev/classificador-jev.js';
import type { ClassificadorDeComentarios } from './integrations/jev/classificador-comentarios.js';
import { criarClassificadorSimulado } from './integrations/jev/classificador-simulado.js';
interface EntradaParaClassificador {
  configuracao: Readonly<Configuracao>;
  opcoes: { classificadorDeComentarios?: ClassificadorDeComentarios };
}

export function criarClassificador(entrada: EntradaParaClassificador): ClassificadorDeComentarios {
  const { jev } = entrada.configuracao;
  return (
    entrada.opcoes.classificadorDeComentarios ??
    (jev.simulado
      ? criarClassificadorSimulado()
      : criarClassificadorJev({ chaveApi: jev.chaveApi ?? '', modelo: jev.modelo }))
  );
}

export function criarEnviador(
  configuracao: Readonly<Configuracao>,
  registrador: Registrador,
): EnviadorDeEmail {
  const { email, nomeNegocio } = configuracao;
  if (email.provedor === 'log') {
    return criarEnviadorLog(registrador);
  }
  // O esquema garante os cinco campos quando PROVEDOR_EMAIL=smtp.
  const transporte = criarTransporteSmtp({
    servidor: email.servidor ?? '',
    porta: email.porta ?? 0,
    usuario: email.usuario ?? '',
    senha: email.senha ?? '',
  });
  return criarEnviadorSmtp(transporte, { nome: nomeNegocio, endereco: email.remetente ?? '' });
}
