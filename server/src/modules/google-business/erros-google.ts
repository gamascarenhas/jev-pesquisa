import { ErroDeDominio } from '../../shared/errors.js';
import { ErroDoGoogle } from '../../integrations/google/fonte-avaliacoes.js';

const STATUS_FALHA_NO_GOOGLE = 502;

const MENSAGENS: Record<ErroDoGoogle['tipo'], { codigo: string; mensagem: string }> = {
  nao_autorizado: {
    codigo: 'google_reconectar',
    mensagem: 'O Google não aceitou mais a conexão. Desconecte e conecte novamente.',
  },
  concessao_invalida: {
    codigo: 'google_reconectar',
    mensagem: 'A autorização do Google expirou ou foi revogada. Desconecte e conecte novamente.',
  },
  sem_acesso: {
    codigo: 'google_sem_acesso',
    mensagem:
      'O Google recusou o acesso à API do Perfil da Empresa (erro 403). Se a cota da API ainda não foi aprovada pelo Google para este aplicativo, o acesso ainda não foi aprovado e a importação só funciona depois da aprovação.',
  },
  limite: {
    codigo: 'google_limite',
    mensagem: 'O Google limitou as consultas (erro 429). Tentaremos de novo automaticamente.',
  },
  indisponivel: {
    codigo: 'google_indisponivel',
    mensagem: 'Não foi possível falar com o Google agora. Tente de novo em alguns minutos.',
  },
};

export class ErroDeIntegracaoGoogle extends ErroDeDominio {
  constructor(readonly tipo: ErroDoGoogle['tipo']) {
    super(MENSAGENS[tipo].codigo, STATUS_FALHA_NO_GOOGLE, MENSAGENS[tipo].mensagem);
  }
}

// Qualquer falha da integração vira um erro de domínio com mensagem clara em português.
export function traduzirErroDoGoogle(erro: unknown): unknown {
  return erro instanceof ErroDoGoogle ? new ErroDeIntegracaoGoogle(erro.tipo) : erro;
}
