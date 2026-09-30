export interface MensagemDeEmail {
  para: string;
  assunto: string;
  texto: string;
}

export interface EnviadorDeEmail {
  enviar(mensagem: MensagemDeEmail): Promise<void>;
}

export type ConteudoDeEmail = Omit<MensagemDeEmail, 'para'>;
