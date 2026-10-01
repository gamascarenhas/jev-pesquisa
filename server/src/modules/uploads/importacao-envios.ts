import { extname } from 'node:path';

import type { Banco } from '../../db/conexoes.js';
import { comTransacao } from '../../db/transacao.js';
import type { ContextoDoTrabalho, Trabalho } from '../../jobs/trabalhos.tipos.js';
import { ErroNaoEncontrado } from '../../shared/errors.js';
import { comoFonteId, type ContaId, type FonteId, type ProjetoId } from '../../shared/ids.js';
import type { ComentariosServico } from '../comments/comentarios.servico.js';
import type { ArmazenamentoDeEnvios } from './armazenamento-envios.js';
import type { Mapeamento, ResumoDaImportacao, TipoDeArquivo } from './envios.tipos.js';
import { esquemaCargaDeImportacao } from './envios.esquemas.js';
import { erroEnvioNaoEncontrado } from './erros-envio.js';
import type { FontesRepositorio } from './fontes.repositorio.js';
import { TAMANHO_LOTE_IMPORTACAO } from './limites-envio.js';
import { abrirLinhas } from './parsing/abrir-linhas.js';
import { transformarLinha, type ResultadoDaLinha } from './parsing/linha-para-comentario.js';

export interface DependenciasDeImportacao {
  banco: Banco;
  armazenamento: ArmazenamentoDeEnvios;
  fontes: FontesRepositorio;
  comentarios: Pick<ComentariosServico, 'importarLote'>;
}

export interface ImportacaoDeEnvios {
  importar(trabalho: Trabalho, contexto: ContextoDoTrabalho): Promise<void>;
}

interface Alvo {
  contaId: ContaId;
  projetoId: ProjetoId;
  fonteId: FonteId;
  envioId: string;
  caminho: string;
  tipo: TipoDeArquivo;
  aba: string | undefined;
  mapeamento: Mapeamento;
}

const RESUMO_INICIAL: Omit<ResumoDaImportacao, 'total'> = {
  processadas: 0,
  importados: 0,
  ignorados: 0,
  duplicados: 0,
  concluida: false,
};

async function contarLinhasDeDados(alvo: Alvo): Promise<number> {
  const linhas = abrirLinhas(alvo.caminho, alvo.tipo, alvo.aba);
  let total = 0;
  while (!(await linhas.next()).done) {
    total += 1;
  }
  return Math.max(total - 1, 0);
}

class ImportacaoDeEnviosImpl implements ImportacaoDeEnvios {
  constructor(private readonly dep: DependenciasDeImportacao) {}

  async importar(trabalho: Trabalho, contexto: ContextoDoTrabalho): Promise<void> {
    const alvo = this.prepararAlvo(trabalho);
    const { armazenamento, fontes } = this.dep;
    const fonte = await fontes.buscarPorId(alvo.contaId, alvo.projetoId, alvo.fonteId);
    if (fonte === undefined) {
      throw erroEnvioNaoEncontrado();
    }
    if (fonte.importacao?.concluida !== true) {
      if (!(await armazenamento.existe(alvo.contaId, alvo.envioId))) {
        throw erroEnvioNaoEncontrado();
      }
      const inicial = fonte.importacao ?? {
        ...RESUMO_INICIAL,
        total: await contarLinhasDeDados(alvo),
      };
      const final = await this.percorrer(alvo, inicial, contexto);
      await fontes.gravarImportacao(alvo.contaId, alvo.fonteId, { ...final, concluida: true });
    }
    await armazenamento.apagar(alvo.contaId, alvo.envioId);
  }

  private prepararAlvo(trabalho: Trabalho): Alvo {
    const carga = esquemaCargaDeImportacao.parse(trabalho.carga);
    if (trabalho.projetoId === undefined) {
      throw new ErroNaoEncontrado('Projeto não encontrado.', 'projeto_nao_encontrado');
    }
    return {
      contaId: trabalho.contaId,
      projetoId: trabalho.projetoId,
      fonteId: comoFonteId(carga.fonteId),
      envioId: carga.envioId,
      caminho: this.dep.armazenamento.caminhoDoEnvio(trabalho.contaId, carga.envioId),
      tipo: extname(carga.envioId) === '.xlsx' ? 'xlsx' : 'csv',
      aba: carga.aba ?? undefined,
      mapeamento: carga.mapeamento,
    };
  }

  private async percorrer(
    alvo: Alvo,
    inicial: ResumoDaImportacao,
    contexto: ContextoDoTrabalho,
  ): Promise<ResumoDaImportacao> {
    let resumo = inicial;
    let lote: ResultadoDaLinha[] = [];
    let numeroDaLinha = 0;
    const descarregar = async (): Promise<void> => {
      if (contexto.sinal.aborted) {
        throw new Error('importacao_interrompida');
      }
      if (lote.length > 0) {
        resumo = await this.gravarLote(alvo, lote, resumo);
        lote = [];
        await contexto.atualizarProgresso(resumo.total, resumo.processadas);
      }
    };
    for await (const celulas of abrirLinhas(alvo.caminho, alvo.tipo, alvo.aba)) {
      numeroDaLinha += 1;
      const jaProcessada = numeroDaLinha - 1 <= inicial.processadas;
      if (numeroDaLinha === 1 || jaProcessada) {
        continue;
      }
      lote.push(transformarLinha(celulas, alvo.mapeamento));
      if (lote.length >= TAMANHO_LOTE_IMPORTACAO) {
        await descarregar();
      }
    }
    await descarregar();
    return resumo;
  }

  // O lote e o ponto de retomada entram na mesma transação: reiniciar nunca duplica nem perde a contagem.
  private async gravarLote(
    alvo: Alvo,
    resultados: ResultadoDaLinha[],
    anterior: ResumoDaImportacao,
  ): Promise<ResumoDaImportacao> {
    const comentarios = resultados.flatMap((r) => (r.ignorada ? [] : [r.comentario]));
    return comTransacao(this.dep.banco, async (cliente) => {
      const { inseridos, duplicados } = await this.dep.comentarios.importarLote(
        alvo.contaId,
        alvo.projetoId,
        alvo.fonteId,
        comentarios,
        cliente,
      );
      const resumo = {
        ...anterior,
        processadas: anterior.processadas + resultados.length,
        importados: anterior.importados + inseridos,
        duplicados: anterior.duplicados + duplicados,
        ignorados: anterior.ignorados + resultados.length - comentarios.length,
      };
      await this.dep.fontes.gravarImportacao(alvo.contaId, alvo.fonteId, resumo, cliente);
      return resumo;
    });
  }
}

export function criarImportacaoDeEnvios(dep: DependenciasDeImportacao): ImportacaoDeEnvios {
  return new ImportacaoDeEnviosImpl(dep);
}
