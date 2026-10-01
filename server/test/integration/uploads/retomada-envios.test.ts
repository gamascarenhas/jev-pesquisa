import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarComentariosRepositorio } from '../../../src/modules/comments/comentarios.repositorio.js';
import { criarImportadorDeComentarios } from '../../../src/modules/comments/comentarios.servico.js';
import { criarArmazenamentoDeEnvios } from '../../../src/modules/uploads/armazenamento-envios.js';
import { criarFontesRepositorio } from '../../../src/modules/uploads/fontes.repositorio.js';
import { criarImportacaoDeEnvios } from '../../../src/modules/uploads/importacao-envios.js';
import { comoFonteId, comoProjetoId, comoTrabalhoId } from '../../../src/shared/ids.js';
import { aguardarAte } from '../../helpers/aguardar.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  CABECALHO,
  MAPEAMENTO_PADRAO,
  confirmarEnvio,
  enviarArquivo,
  linhasDeComentario,
  type Previa,
} from '../../helpers/envios.js';
import {
  criarContaDeTeste,
  criarProjetoDeTeste,
  criarUsuarioDeTeste,
} from '../../helpers/factories.js';
import { entrar } from '../../helpers/login.js';

// Sem executor em segundo plano: o teste decide quando o job roda.
describe('retomada e andamento da importação', () => {
  let aplicacao: AppDeTeste;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste({ ajustesDoExecutor: { intervaloConsultaMs: 20 } });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function prepararImportacao(linhas: number) {
    const conta = await criarContaDeTeste(aplicacao.banco);
    const usuario = await criarUsuarioDeTeste(aplicacao.banco, conta);
    const projeto = await criarProjetoDeTeste(aplicacao.banco, conta);
    const cookie = await entrar(aplicacao, usuario.email);
    const conteudo = Buffer.from(CABECALHO + linhasDeComentario(linhas));
    const envio = (
      await enviarArquivo(aplicacao, cookie, projeto, 'grande.csv', conteudo)
    ).json<Previa>();
    const resposta = await confirmarEnvio(aplicacao, cookie, projeto, envio.envioId, {
      mapeamento: MAPEAMENTO_PADRAO,
    });
    const { trabalhoId, fonteId } = resposta.json<{ trabalhoId: string; fonteId: string }>();
    const trabalho = await aplicacao.servicos.trabalhos.obter(conta, comoTrabalhoId(trabalhoId));
    return {
      conta,
      cookie,
      projeto: comoProjetoId(projeto),
      envioId: envio.envioId,
      trabalho,
      fonteId: comoFonteId(fonteId),
    };
  }

  function criarImportacao() {
    return criarImportacaoDeEnvios({
      banco: aplicacao.banco,
      armazenamento: criarArmazenamentoDeEnvios(aplicacao.diretorioDeEnvios),
      fontes: criarFontesRepositorio(aplicacao.banco),
      comentarios: criarImportadorDeComentarios(criarComentariosRepositorio(aplicacao.banco)),
    });
  }

  async function totais(projeto: string): Promise<{ total: number; distintos: number }> {
    const resultado = await aplicacao.banco.query<{ total: string; distintos: string }>(
      'SELECT count(*) AS total, count(DISTINCT hash_conteudo) AS distintos FROM comentarios WHERE projeto_id = $1',
      [projeto],
    );
    return {
      total: Number(resultado.rows[0]?.total),
      distintos: Number(resultado.rows[0]?.distintos),
    };
  }

  it('recusa confirmar duas vezes o mesmo envio enquanto a importação está em andamento', async () => {
    const { cookie, projeto, envioId } = await prepararImportacao(3);
    const corpo = { mapeamento: MAPEAMENTO_PADRAO };

    const segunda = await confirmarEnvio(aplicacao, cookie, projeto, envioId, corpo);

    expect(segunda.statusCode).toBe(409);
    expect(segunda.json<{ erro: { codigo: string } }>().erro.codigo).toBe('envio_em_andamento');
  });

  it('uma importação interrompida no meio continua de onde parou, sem duplicar nem perder contagem', async () => {
    const { projeto, trabalho, fonteId, conta } = await prepararImportacao(1_200);
    const controle = new AbortController();
    const progressos: number[] = [];
    const interrompida = criarImportacao().importar(trabalho, {
      trabalho,
      sinal: controle.signal,
      atualizarProgresso: (_total, feito) => {
        progressos.push(feito);
        controle.abort();
        return Promise.resolve();
      },
    });

    await expect(interrompida).rejects.toThrow('importacao_interrompida');
    const fontes = criarFontesRepositorio(aplicacao.banco);
    const parcial = await fontes.buscarPorId(conta, projeto, fonteId);
    expect(progressos).toEqual([500]);
    expect(parcial?.importacao).toMatchObject({
      processadas: 500,
      importados: 500,
      concluida: false,
    });
    expect(await totais(projeto)).toEqual({ total: 500, distintos: 500 });

    await criarImportacao().importar(trabalho, {
      trabalho,
      sinal: new AbortController().signal,
      atualizarProgresso: () => Promise.resolve(),
    });

    const final = await fontes.buscarPorId(conta, projeto, fonteId);
    expect(final?.importacao).toEqual({
      total: 1_200,
      processadas: 1_200,
      importados: 1_200,
      ignorados: 0,
      duplicados: 0,
      concluida: true,
    });
    expect(await totais(projeto)).toEqual({ total: 1_200, distintos: 1_200 });
  });

  it('um job órfão no meio da importação termina sozinho na inicialização do servidor', async () => {
    const { projeto, trabalho } = await prepararImportacao(700);
    await aplicacao.banco.query(
      `UPDATE trabalhos SET status = 'running', bloqueado_por = 'instancia-morta', tentativas = 1,
              sinal_vida_em = now() - interval '10 minutes' WHERE id = $1`,
      [trabalho.id],
    );

    await aplicacao.executorDeTrabalhos.iniciar();
    await aguardarAte(async () => {
      const job = await aplicacao.banco.query<{ status: string }>(
        'SELECT status FROM trabalhos WHERE id = $1',
        [trabalho.id],
      );
      return job.rows[0]?.status === 'done';
    }, 15_000);

    expect(await totais(projeto)).toEqual({ total: 700, distintos: 700 });
  });
});
