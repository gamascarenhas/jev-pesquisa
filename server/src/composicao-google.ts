import type { EntradaDaComposicao } from './composicao.js';
import { criarFonteDeAvaliacoesGoogle } from './integrations/google/fonte-avaliacoes-google.js';
import { criarFonteDeAvaliacoesSimulada } from './integrations/google/fonte-avaliacoes-simulada.js';
import type { FonteDeAvaliacoes } from './integrations/google/fonte-avaliacoes.js';
import { criarManipuladorGoogleSincronizacao } from './jobs/handlers/google-sincronizacao.manipulador.js';
import type { ManipuladorDeTrabalho } from './jobs/trabalhos.tipos.js';
import type { ComentariosServico } from './modules/comments/comentarios.servico.js';
import { criarConexoesGoogleRepositorio } from './modules/google-business/conexoes-google.repositorio.js';
import {
  criarConexoesGoogleSistemaRepositorio,
  type ConexoesGoogleSistemaRepositorio,
} from './modules/google-business/conexoes-google.sistema.repositorio.js';
import { criarFontesGoogleRepositorio } from './modules/google-business/fontes-google.repositorio.js';
import {
  criarGoogleOauthServico,
  type GoogleOauthServico,
} from './modules/google-business/google-oauth.servico.js';
import { criarGoogleSincronizacaoServico } from './modules/google-business/google-sincronizacao.servico.js';
import {
  criarGoogleUnidadesServico,
  type GoogleUnidadesServico,
} from './modules/google-business/google-unidades.servico.js';
import type { ProjetosServico } from './modules/projects/projetos.servico.js';
import type { TrabalhosServico } from './jobs/trabalhos.servico.js';
import { criarCriptografia } from './shared/crypto.js';

export interface Google {
  oauth: GoogleOauthServico;
  unidades: GoogleUnidadesServico;
  sistema: ConexoesGoogleSistemaRepositorio;
  manipulador: ManipuladorDeTrabalho;
}

function criarFonte(entrada: EntradaDaComposicao): FonteDeAvaliacoes {
  const { google, origemApp } = entrada.configuracao;
  const uriRedirecionamento = google.uriRedirecionamento ?? `${origemApp}/api/google/callback`;
  if (entrada.opcoes.fonteDeAvaliacoes !== undefined) {
    return entrada.opcoes.fonteDeAvaliacoes;
  }
  return google.simulado
    ? criarFonteDeAvaliacoesSimulada({ uriRedirecionamento })
    : criarFonteDeAvaliacoesGoogle({
        idCliente: google.idCliente ?? '',
        segredoCliente: google.segredoCliente ?? '',
        uriRedirecionamento,
      });
}

export function montarGoogle(
  entrada: EntradaDaComposicao,
  base: {
    projetos: ProjetosServico;
    trabalhos: TrabalhosServico;
    comentarios: ComentariosServico;
  },
): Google {
  const { banco, configuracao, registrador, relogio } = entrada;
  const fonte = criarFonte(entrada);
  const conexoes = criarConexoesGoogleRepositorio(banco);
  const fontes = criarFontesGoogleRepositorio(banco);
  const oauth = criarGoogleOauthServico({
    fonte,
    conexoes,
    fontes,
    criptografia: criarCriptografia(configuracao.chaveCriptografia),
    projetos: base.projetos,
    trabalhos: base.trabalhos,
    relogio,
    registrador,
  });
  const sincronizacao = criarGoogleSincronizacaoServico({
    fonte,
    oauth,
    conexoes,
    fontes,
    comentarios: base.comentarios,
    relogio,
    registrador,
  });
  return {
    oauth,
    unidades: criarGoogleUnidadesServico({
      fonte,
      simulado: configuracao.google.simulado,
      oauth,
      conexoes,
      fontes,
      projetos: base.projetos,
      trabalhos: base.trabalhos,
    }),
    sistema: criarConexoesGoogleSistemaRepositorio(banco),
    manipulador: criarManipuladorGoogleSincronizacao(sincronizacao),
  };
}

// Um job por projeto conectado; o índice único dos jobs ativos evita sincronizações empilhadas.
export async function sincronizarGoogleAgendado(
  sistema: ConexoesGoogleSistemaRepositorio,
  trabalhos: TrabalhosServico,
): Promise<void> {
  for (const { contaId, projetoId } of await sistema.listarProjetosComConexaoAtiva()) {
    await trabalhos.criar(contaId, { tipo: 'google_sync', projetoId });
  }
}
