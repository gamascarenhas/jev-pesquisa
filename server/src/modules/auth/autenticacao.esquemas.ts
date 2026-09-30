import { z } from 'zod';

import type { TokenAutenticacao, Usuario } from './autenticacao.tipos.js';
import { TAMANHO_MAXIMO_SENHA, TAMANHO_MINIMO_SENHA } from './senha.js';

const TAMANHO_MAXIMO_EMAIL = 254;
const TAMANHO_MAXIMO_NOME = 120;
const TAMANHO_MAXIMO_TOKEN = 128;

export const esquemaEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(TAMANHO_MAXIMO_EMAIL)
  .pipe(z.email());

const esquemaNome = z.string().trim().min(1).max(TAMANHO_MAXIMO_NOME);
export const esquemaNovaSenha = z.string().min(TAMANHO_MINIMO_SENHA).max(TAMANHO_MAXIMO_SENHA);
export const esquemaToken = z.string().min(1).max(TAMANHO_MAXIMO_TOKEN);
const esquemaAceite = z.literal(true, { error: 'É preciso aceitar os termos e a política.' });

export const esquemaCadastro = z
  .object({
    nomeEmpresa: esquemaNome,
    nomeUsuario: esquemaNome,
    email: esquemaEmail,
    senha: esquemaNovaSenha,
    aceiteTermos: esquemaAceite,
  })
  .strict();

export const esquemaLogin = z
  .object({ email: esquemaEmail, senha: z.string().min(1).max(TAMANHO_MAXIMO_SENHA) })
  .strict();

export const esquemaSomenteEmail = z.object({ email: esquemaEmail }).strict();
export const esquemaSomenteToken = z.object({ token: esquemaToken }).strict();

export const esquemaRedefinirSenha = z
  .object({ token: esquemaToken, novaSenha: esquemaNovaSenha })
  .strict();

export const esquemaAceitarConvite = z
  .object({
    token: esquemaToken,
    nome: esquemaNome,
    senha: esquemaNovaSenha,
    aceiteTermos: esquemaAceite,
  })
  .strict();

export const esquemaTrocarSenha = z
  .object({ senhaAtual: z.string().min(1).max(TAMANHO_MAXIMO_SENHA), novaSenha: esquemaNovaSenha })
  .strict();

export const esquemaTrocarEmail = z
  .object({ novoEmail: esquemaEmail, senha: z.string().min(1).max(TAMANHO_MAXIMO_SENHA) })
  .strict();

export const esquemaConvidar = z
  .object({ email: esquemaEmail, papel: z.enum(['owner', 'member']).default('member') })
  .strict();

export const esquemaParametrosComId = z.object({ id: z.uuid() }).strict();

const esquemaUsuarioResposta = z
  .object({
    id: z.string(),
    nome: z.string(),
    email: z.string(),
    papel: z.enum(['owner', 'member']),
    emailConfirmado: z.boolean(),
    criadoEm: z.string(),
  })
  .strict();

export function paraUsuarioDto(usuario: Usuario): z.infer<typeof esquemaUsuarioResposta> {
  return esquemaUsuarioResposta.parse({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    emailConfirmado: usuario.emailConfirmadoEm !== null,
    criadoEm: usuario.criadoEm.toISOString(),
  });
}

export const MENSAGEM_SE_O_EMAIL_EXISTIR = 'Se o e-mail existir, enviamos as instruções para ele.';

const esquemaConviteResposta = z
  .object({
    id: z.string(),
    email: z.string(),
    papel: z.enum(['owner', 'member']),
    criadoEm: z.string(),
    expiraEm: z.string(),
  })
  .strict();

export function paraConviteDto(convite: TokenAutenticacao): z.infer<typeof esquemaConviteResposta> {
  return esquemaConviteResposta.parse({
    id: convite.id,
    email: convite.email,
    papel: convite.papelConvidado,
    criadoEm: convite.criadoEm.toISOString(),
    expiraEm: convite.expiraEm.toISOString(),
  });
}
