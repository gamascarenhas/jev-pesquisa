import {
  ErroDoGoogle,
  type AvaliacaoDoGoogle,
  type FonteDeAvaliacoes,
} from '../../integrations/google/fonte-avaliacoes.js';
import { ErroTemporarioDeTrabalho } from '../../jobs/trabalhos.tipos.js';
import type { Relogio } from '../../shared/clock.js';
import { comoFonteId, type ContaId, type ProjetoId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ComentariosServico } from '../comments/comentarios.servico.js';
import type { ConexoesGoogleRepositorio } from './conexoes-google.repositorio.js';
import type { ConexaoGoogle, FonteGoogle } from './conexoes-google.tipos.js';
import { ErroDeIntegracaoGoogle, traduzirErroDoGoogle } from './erros-google.js';
import type { FontesGoogleRepositorio } from './fontes-google.repositorio.js';
import type { GoogleOauthServico } from './google-oauth.servico.js';

const MARCAS_DE_TRADUCAO = /\(Translated by Google\)|\(Original\)|\(Traduzido pelo Google\)/;

export interface ResumoDaSincronizacao {
  inseridos: number;
  atualizados: number;
  semTexto: number;
  traduzidas: number;
  completa: boolean;
}

export interface ProgressoDaSincronizacao {
  sinal: AbortSignal;
  atualizarProgresso: (total: number, feito: number) => Promise<void>;
}

export interface GoogleSincronizacaoServico {
  sincronizar(
    contaId: ContaId,
    projetoId: ProjetoId,
    progresso: ProgressoDaSincronizacao,
  ): Promise<void>;
}

export interface DependenciasDaSincronizacao {
  fonte: FonteDeAvaliacoes;
  oauth: Pick<GoogleOauthServico, 'obterTokenDeAcesso' | 'renovarToken'>;
  conexoes: ConexoesGoogleRepositorio;
  fontes: FontesGoogleRepositorio;
  comentarios: Pick<ComentariosServico, 'sincronizarExternos'>;
  relogio: Relogio;
  registrador: Registrador;
}

interface AlvoDaSincronizacao {
  contaId: ContaId;
  projetoId: ProjetoId;
  sinal: AbortSignal;
}

class GoogleSincronizacaoServicoImpl implements GoogleSincronizacaoServico {
  constructor(private readonly dep: DependenciasDaSincronizacao) {}

  async sincronizar(
    contaId: ContaId,
    projetoId: ProjetoId,
    progresso: ProgressoDaSincronizacao,
  ): Promise<void> {
    const conexao = await this.dep.conexoes.buscarAtiva(contaId, projetoId);
    const fontes = await this.dep.fontes.listar(contaId, projetoId);
    if (conexao === undefined || fontes.length === 0) {
      return;
    }
    const alvo = { contaId, projetoId, sinal: progresso.sinal };
    const inicio = this.dep.relogio.agora();
    try {
      const token = { atual: await this.dep.oauth.obterTokenDeAcesso(conexao) };
      for (const [indice, fonte] of fontes.entries()) {
        const resumo = await this.sincronizarFonte(conexao, token, fonte, alvo);
        await this.dep.fontes.registrarSucesso(contaId, fonte.id, inicio, resumo);
        await progresso.atualizarProgresso(fontes.length, indice + 1);
      }
    } catch (causa) {
      throw await this.tratarFalha(alvo, causa);
    }
  }

  // Falha de integração fica registrada nas fontes para a tela explicar; 429 volta à fila com atraso.
  private async tratarFalha(alvo: AlvoDaSincronizacao, causa: unknown): Promise<unknown> {
    const erro = traduzirErroDoGoogle(causa);
    if (!(erro instanceof ErroDeIntegracaoGoogle)) {
      return erro;
    }
    await this.dep.fontes.registrarFalha(alvo.contaId, alvo.projetoId, erro.codigo, erro.message);
    return erro.tipo === 'limite' ? new ErroTemporarioDeTrabalho(erro.codigo) : erro;
  }

  // Uma página rejeitada por token vencido é repetida uma vez com o token renovado.
  private async lerPagina(
    conexao: ConexaoGoogle,
    token: { atual: string },
    unidade: string,
    pagina: string | null,
  ) {
    try {
      return await this.dep.fonte.listarAvaliacoes(token.atual, unidade, pagina);
    } catch (erro) {
      if (!(erro instanceof ErroDoGoogle) || erro.tipo !== 'nao_autorizado') {
        throw erro;
      }
      token.atual = await this.dep.oauth.renovarToken(conexao);
      return this.dep.fonte.listarAvaliacoes(token.atual, unidade, pagina);
    }
  }

  // Do mais recente para o mais antigo: para na primeira avaliação anterior à última sincronização.
  private async sincronizarFonte(
    conexao: ConexaoGoogle,
    token: { atual: string },
    fonte: FonteGoogle,
    alvo: AlvoDaSincronizacao,
  ): Promise<ResumoDaSincronizacao> {
    const ultima = fonte.ultimaSincronizacaoEm;
    const resumo: ResumoDaSincronizacao = {
      inseridos: 0,
      atualizados: 0,
      semTexto: 0,
      traduzidas: 0,
      completa: ultima === null,
    };
    let pagina: string | null = null;
    do {
      if (alvo.sinal.aborted) {
        throw new Error('sincronizacao_interrompida');
      }
      const lida = await this.lerPagina(conexao, token, fonte.nomeUnidade, pagina);
      const novas = lida.avaliacoes.filter((a) => ultima === null || a.atualizadaEm >= ultima);
      const gravado = await this.gravar(alvo, fonte, novas);
      resumo.inseridos += gravado.inseridos;
      resumo.atualizados += gravado.atualizados;
      resumo.semTexto += gravado.semTexto;
      resumo.traduzidas += novas.filter((a) => MARCAS_DE_TRADUCAO.test(a.comentario ?? '')).length;
      pagina = novas.length < lida.avaliacoes.length ? null : lida.proximaPagina;
    } while (pagina !== null);
    if (resumo.traduzidas > 0) {
      this.dep.registrador.info(
        { categoria: 'google', contaId: alvo.contaId, traduzidas: resumo.traduzidas },
        'avaliações com trecho traduzido pelo Google gravadas como vieram',
      );
    }
    return resumo;
  }

  private gravar(alvo: AlvoDaSincronizacao, fonte: FonteGoogle, avaliacoes: AvaliacaoDoGoogle[]) {
    return this.dep.comentarios.sincronizarExternos(
      alvo.contaId,
      alvo.projetoId,
      comoFonteId(fonte.id),
      avaliacoes.map((avaliacao) => ({
        idExterno: avaliacao.id,
        texto: avaliacao.comentario,
        nota: avaliacao.nota,
        unidade: fonte.titulo,
        autor: avaliacao.autor,
        comentadoEm: avaliacao.criadaEm,
        atualizadoEm: avaliacao.atualizadaEm,
      })),
    );
  }
}

export function criarGoogleSincronizacaoServico(
  dep: DependenciasDaSincronizacao,
): GoogleSincronizacaoServico {
  return new GoogleSincronizacaoServicoImpl(dep);
}
