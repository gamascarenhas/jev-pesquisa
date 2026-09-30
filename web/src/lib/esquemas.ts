import { z } from 'zod';

import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

export const TAMANHO_MINIMO_SENHA = 10;
export const TAMANHO_MAXIMO_SENHA = 128;
const TAMANHO_MAXIMO_NOME = 120;

const { validacao } = textos;

export const esquemaEmail = z
  .string(validacao.obrigatorio)
  .trim()
  .toLowerCase()
  .min(1, validacao.obrigatorio)
  .pipe(z.email(validacao.emailInvalido));

export const esquemaNome = z
  .string(validacao.obrigatorio)
  .trim()
  .min(1, validacao.obrigatorio)
  .max(TAMANHO_MAXIMO_NOME);

export const esquemaNovaSenha = z
  .string(validacao.obrigatorio)
  .min(
    TAMANHO_MINIMO_SENHA,
    interpolar(validacao.senhaCurta, { minimo: String(TAMANHO_MINIMO_SENHA) }),
  )
  .max(TAMANHO_MAXIMO_SENHA);

export const esquemaSenhaInformada = z
  .string(validacao.obrigatorio)
  .min(1, validacao.obrigatorio)
  .max(TAMANHO_MAXIMO_SENHA);

export const esquemaAceite = z
  .literal('on', validacao.aceiteObrigatorio)
  .transform(() => true as const);
