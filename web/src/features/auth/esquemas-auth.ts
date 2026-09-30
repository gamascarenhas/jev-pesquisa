import { z } from 'zod';

import {
  esquemaAceite,
  esquemaEmail,
  esquemaNome,
  esquemaNovaSenha,
  esquemaSenhaInformada,
} from '@/lib/esquemas';

export const esquemaDeLogin = z.object({ email: esquemaEmail, senha: esquemaSenhaInformada });

export const esquemaDeCadastro = z.object({
  nomeEmpresa: esquemaNome,
  nomeUsuario: esquemaNome,
  email: esquemaEmail,
  senha: esquemaNovaSenha,
  aceiteTermos: esquemaAceite,
});

export const esquemaSomenteEmail = z.object({ email: esquemaEmail });

export const esquemaDeRedefinicao = z.object({ novaSenha: esquemaNovaSenha });

export const esquemaDeAceiteDeConvite = z.object({
  nome: esquemaNome,
  senha: esquemaNovaSenha,
  aceiteTermos: esquemaAceite,
});
