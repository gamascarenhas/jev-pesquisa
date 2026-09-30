import { requisitar } from './http';
import type { ConfiguracaoPublica, Conta, Convite, Lista, Mensagem, Papel, Usuario } from './types';

export interface DadosDeCadastro {
  nomeEmpresa: string;
  nomeUsuario: string;
  email: string;
  senha: string;
  aceiteTermos: true;
}

export interface DadosDeConvite {
  token: string;
  nome: string;
  senha: string;
  aceiteTermos: true;
}

export const autenticacaoApi = {
  configuracaoPublica: () => requisitar<ConfiguracaoPublica>('GET', '/configuracao-publica'),
  cadastrar: (dados: DadosDeCadastro) => requisitar<Mensagem>('POST', '/auth/cadastro', dados),
  entrar: (email: string, senha: string) =>
    requisitar<Usuario>('POST', '/auth/login', { email, senha }),
  sair: () => requisitar<undefined>('POST', '/auth/logout'),
  obterEu: () => requisitar<Usuario>('GET', '/auth/eu'),
  confirmarEmail: (token: string) =>
    requisitar<undefined>('POST', '/auth/confirmar-email', { token }),
  reenviarConfirmacao: (email: string) =>
    requisitar<Mensagem>('POST', '/auth/reenviar-confirmacao', { email }),
  esqueciSenha: (email: string) => requisitar<Mensagem>('POST', '/auth/esqueci-senha', { email }),
  redefinirSenha: (token: string, novaSenha: string) =>
    requisitar<undefined>('POST', '/auth/redefinir-senha', { token, novaSenha }),
  aceitarConvite: (dados: DadosDeConvite) =>
    requisitar<undefined>('POST', '/auth/aceitar-convite', dados),
  confirmarTrocaDeEmail: (token: string) =>
    requisitar<undefined>('POST', '/auth/confirmar-troca-email', { token }),

  trocarSenha: (senhaAtual: string, novaSenha: string) =>
    requisitar<undefined>('POST', '/perfil/senha', { senhaAtual, novaSenha }),
  trocarEmail: (novoEmail: string, senha: string) =>
    requisitar<Mensagem>('POST', '/perfil/email', { novoEmail, senha }),

  obterConta: () => requisitar<Conta>('GET', '/conta'),
  listarUsuarios: () => requisitar<Lista<Usuario>>('GET', '/usuarios'),
  removerUsuario: (id: string) => requisitar<undefined>('DELETE', `/usuarios/${id}`),
  listarConvites: () => requisitar<Lista<Convite>>('GET', '/convites'),
  convidar: (email: string, papel: Papel) =>
    requisitar<Mensagem>('POST', '/convites', { email, papel }),
  revogarConvite: (id: string) => requisitar<undefined>('DELETE', `/convites/${id}`),
};
