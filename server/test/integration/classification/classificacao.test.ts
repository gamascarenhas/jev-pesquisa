import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  criarClassificador,
  type ClassificadorDeComentarios,
} from '../../../src/integrations/jev/classificador-comentarios.js';
import { criarClassificadorSimulado } from '../../../src/integrations/jev/classificador-simulado.js';
import { MAX_TENTATIVAS_CLASSIFICACAO } from '../../../src/modules/classification/classificacao.servico.js';
import { ErroDeIaNaoCobrado } from '../../../src/modules/usage/controle-custo.servico.js';
import { comoProjetoId } from '../../../src/shared/ids.js';
import { aguardarAte } from '../../helpers/aguardar.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import { contarLivro, somarLivro } from '../../helpers/custo.js';
import {
  criarComentarioDeTeste,
  criarContaDeTeste,
  criarFonteDeTeste,
  criarPlanoDeTeste,
  criarProjetoDeTeste,
  criarUsuarioDeTeste,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

const TEXTOS = [
  'Atendimento excelente, recomendo a todos',
  'A fila estava enorme e a espera foi longa',
  'O produto veio com defeito e ninguém quis trocar',
  'Preço justo e entrega rápida',
];

interface Espiao {
  classificador: ClassificadorDeComentarios;
  chamadas: { perguntas: string[]; comentario: string }[];
  falharQuando: { texto: string | undefined };
}

function criarEspiao(): Espiao {
  const simulado = criarClassificadorSimulado();
  const chamadas: Espiao['chamadas'] = [];
  const falharQuando: Espiao['falharQuando'] = { texto: undefined };
  const classificador = criarClassificador((state, perguntas, opcoes) => {
    const comentario = (state as { comment?: string }).comment ?? '';
    chamadas.push({ perguntas: Object.keys(perguntas), comentario });
    if (falharQuando.texto !== undefined && comentario.includes(falharQuando.texto)) {
      return Promise.reject(new ErroDeIaNaoCobrado('falha de teste'));
    }
    return simulado.avaliar(state, perguntas, opcoes);
  });
  return { classificador, chamadas, falharQuando };
}

describe('classificação com o Jev', () => {
  let espiao: Espiao;
  let aplicacao: AppDeTeste;

  beforeAll(async () => {
    espiao = criarEspiao();
    aplicacao = await montarAppDeTeste({
      classificadorDeComentarios: espiao.classificador,
      ajustesDoExecutor: { intervaloConsultaMs: 20 },
    });
    await aplicacao.executorDeTrabalhos.iniciar();
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function criarCenario(
    quantidade: number,
    opcoes: { limite?: string; emailConfirmado?: boolean; texto?: (i: number) => string } = {},
  ) {
    const planoId = await criarPlanoDeTeste(aplicacao.banco, {
      limiteCustoIaUsd: opcoes.limite ?? '1.000000',
      ativo: false,
    });
    const contaId = await criarContaDeTeste(aplicacao.banco, { planoId });
    const usuario = await criarUsuarioDeTeste(aplicacao.banco, contaId, {
      emailConfirmado: opcoes.emailConfirmado ?? true,
    });
    const projetoId = await criarProjetoDeTeste(aplicacao.banco, contaId);
    const fonteId = await criarFonteDeTeste(aplicacao.banco, contaId, projetoId);
    for (let i = 0; i < quantidade; i += 1) {
      const texto = opcoes.texto?.(i) ?? `${TEXTOS[i % TEXTOS.length] ?? ''} (${String(i)})`;
      await criarComentarioDeTeste(aplicacao.banco, contaId, projetoId, fonteId, texto);
    }
    return { contaId, usuario, projetoId, cookie: await entrar(aplicacao, usuario.email) };
  }

  async function iniciar(cookie: string, projetoId: string) {
    return chamar(aplicacao, {
      metodo: 'POST',
      url: `/api/projetos/${projetoId}/classificacao`,
      cookie,
    });
  }

  async function statusDosComentarios(projetoId: string): Promise<Record<string, number>> {
    const linhas = await aplicacao.banco.query<{ status_classificacao: string; total: string }>(
      'SELECT status_classificacao, count(*) AS total FROM comentarios WHERE projeto_id = $1 GROUP BY 1',
      [projetoId],
    );
    return Object.fromEntries(linhas.rows.map((l) => [l.status_classificacao, Number(l.total)]));
  }

  async function statusDoJob(projetoId: string): Promise<string | undefined> {
    const linha = await aplicacao.banco.query<{ status: string }>(
      "SELECT status FROM trabalhos WHERE projeto_id = $1 AND tipo = 'classify' ORDER BY criado_em DESC LIMIT 1",
      [projetoId],
    );
    return linha.rows[0]?.status;
  }

  async function esperarJob(projetoId: string, status: string): Promise<void> {
    await aguardarAte(async () => (await statusDoJob(projetoId)) === status, 15_000);
  }

  describe('fluxo completo', () => {
    it('classifica todos os comentários, grava o resultado e faz uma requisição por comentário com todas as perguntas', async () => {
      const { contaId, projetoId, cookie } = await criarCenario(12);
      espiao.chamadas.length = 0;

      const resposta = await iniciar(cookie, projetoId);
      await esperarJob(projetoId, 'done');

      expect(resposta.statusCode).toBe(202);
      expect(await statusDosComentarios(projetoId)).toEqual({ done: 12 });
      expect(espiao.chamadas).toHaveLength(12);
      expect(
        espiao.chamadas.every(
          (c) => c.perguntas.join() === 'topic,sentiment,severity,needs_action',
        ),
      ).toBe(true);
      const gravadas = await aplicacao.banco.query<{ modelo: string; tema: string }>(
        'SELECT modelo, tema FROM classificacoes WHERE conta_id = $1',
        [contaId],
      );
      expect(gravadas.rows).toHaveLength(12);
      expect(gravadas.rows.every((l) => l.modelo === 'jev-simulado')).toBe(true);
      expect(await contarLivro(aplicacao.banco, contaId, 'settled')).toBe(12);
      const livro = await aplicacao.banco.query(
        "SELECT 1 FROM livro_razao_consumo WHERE conta_ref = $1 AND provedor = 'jev' AND operacao = 'classify' AND comentario_ref IS NOT NULL",
        [contaId],
      );
      expect(livro.rowCount).toBe(12);
    });

    it('guarda o resultado normalizado e marca para revisão o que veio com pouca confiança', async () => {
      const { contaId, projetoId, cookie } = await criarCenario(2, {
        texto: (i) =>
          i === 0 ? 'Passei por aí' : 'Vou ao Procon, produto com defeito, não volto mais',
      });

      await iniciar(cookie, projetoId);
      await esperarJob(projetoId, 'done');

      const linhas = await aplicacao.banco.query<{
        tema: string;
        gravidade_pontuacao: string;
        gravidade_normalizada: string;
        precisa_acao: string;
        precisa_revisao: boolean;
      }>(
        `SELECT cl.tema, cl.gravidade_pontuacao::text, cl.gravidade_normalizada::text,
                cl.precisa_acao::text, cl.precisa_revisao
           FROM classificacoes cl JOIN comentarios c ON c.id = cl.comentario_id
          WHERE cl.conta_id = $1 ORDER BY c.criado_em`,
        [contaId],
      );
      expect(linhas.rows[0]).toMatchObject({ tema: 'other', precisa_revisao: true });
      expect(linhas.rows[1]).toMatchObject({
        gravidade_pontuacao: '3.0000',
        gravidade_normalizada: '1.0000',
        precisa_acao: '0.8500',
        precisa_revisao: false,
      });
    });

    it('trunca comentários acima de 4.000 caracteres e registra o truncamento', async () => {
      const { projetoId, cookie } = await criarCenario(1, {
        texto: () => `fila ${'a'.repeat(4_500)}`,
      });
      espiao.chamadas.length = 0;

      await iniciar(cookie, projetoId);
      await esperarJob(projetoId, 'done');

      expect(espiao.chamadas[0]?.comentario).toHaveLength(4_000);
      const truncado = await aplicacao.banco.query<{ foi_truncado: boolean }>(
        'SELECT foi_truncado FROM comentarios WHERE projeto_id = $1',
        [projetoId],
      );
      expect(truncado.rows[0]?.foi_truncado).toBe(true);
    });
  });

  describe('rotas', () => {
    it('estimar devolve só porcentagens do plano e a quantidade pendente', async () => {
      const { projetoId, cookie } = await criarCenario(5, { limite: '0.001000' });

      const resposta = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${projetoId}/classificacao/estimativa`,
        cookie,
      });

      const corpo = resposta.json<Record<string, unknown>>();
      expect(resposta.statusCode).toBe(200);
      expect(Object.keys(corpo).sort()).toEqual([
        'cabe',
        'minutosEstimados',
        'pendentes',
        'porcentagemEstimada',
        'porcentagemJaConsumida',
      ]);
      expect(corpo.pendentes).toBe(5);
      expect(corpo.cabe).toBe(true);
    });

    it('usuário sem e-mail confirmado recebe 403 ao estimar, iniciar e reprocessar, mas pode ver o progresso', async () => {
      const { projetoId, cookie } = await criarCenario(2, { emailConfirmado: false });
      const base = `/api/projetos/${projetoId}/classificacao`;

      const estimar = await chamar(aplicacao, { metodo: 'GET', url: `${base}/estimativa`, cookie });
      const iniciarIa = await iniciar(cookie, projetoId);
      const reprocessar = await chamar(aplicacao, {
        metodo: 'POST',
        url: `${base}/reprocessar-falhas`,
        cookie,
      });
      const progresso = await chamar(aplicacao, {
        metodo: 'GET',
        url: `${base}/progresso`,
        cookie,
      });

      expect(estimar.statusCode).toBe(403);
      expect(iniciarIa.statusCode).toBe(403);
      expect(reprocessar.statusCode).toBe(403);
      expect(estimar.json<{ erro: { codigo: string } }>().erro.codigo).toBe('email_nao_confirmado');
      expect(progresso.statusCode).toBe(200);
      expect(await statusDoJob(projetoId)).toBeUndefined();
    });

    it('exige sessão e não enxerga projeto de outra conta', async () => {
      const a = await criarCenario(1);
      const b = await criarCenario(1);

      const anonimo = await chamar(aplicacao, {
        metodo: 'POST',
        url: `/api/projetos/${a.projetoId}/classificacao`,
      });
      const alheio = await iniciar(b.cookie, a.projetoId);
      const progressoAlheio = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${a.projetoId}/classificacao/progresso`,
        cookie: b.cookie,
      });

      expect(anonimo.statusCode).toBe(401);
      expect(alheio.statusCode).toBe(404);
      expect(progressoAlheio.statusCode).toBe(404);
      expect(await statusDosComentarios(a.projetoId)).toEqual({ pending: 1 });
    });

    it('iniciar duas vezes seguidas não cria dois jobs e devolve o existente', async () => {
      const { projetoId, cookie } = await criarCenario(3);
      const primeira = await iniciar(cookie, projetoId);
      const segunda = await iniciar(cookie, projetoId);

      const jobs = await aplicacao.banco.query(
        "SELECT 1 FROM trabalhos WHERE projeto_id = $1 AND tipo = 'classify'",
        [projetoId],
      );
      expect(jobs.rowCount).toBe(1);
      expect(segunda.json<{ trabalhoId: string }>().trabalhoId).toBe(
        primeira.json<{ trabalhoId: string }>().trabalhoId,
      );
      if (segunda.statusCode === 200) {
        expect(segunda.json<{ jaExistia: boolean }>().jaExistia).toBe(true);
      }
      await esperarJob(projetoId, 'done');
    });

    it('recusa iniciar quando não há nada a classificar', async () => {
      const { projetoId, cookie } = await criarCenario(0);

      const resposta = await iniciar(cookie, projetoId);

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json<{ erro: { codigo: string } }>().erro.codigo).toBe(
        'nada_para_classificar',
      );
    });

    it('o progresso informa a contagem por situação e o job ativo', async () => {
      const { projetoId, cookie } = await criarCenario(4);
      await iniciar(cookie, projetoId);
      await esperarJob(projetoId, 'done');

      const resposta = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${projetoId}/classificacao/progresso`,
        cookie,
      });

      expect(resposta.json()).toEqual({
        pendentes: 0,
        classificados: 4,
        falhos: 0,
        semTexto: 0,
        trabalho: null,
      });
    });
  });

  describe('falhas', () => {
    it('uma falha não para o job: o comentário é tentado 3 vezes, fica failed, e reprocessar o devolve a pending', async () => {
      const { contaId, projetoId, cookie } = await criarCenario(6, {
        texto: (i) =>
          i === 2 ? 'FALHAR este comentário' : `Atendimento ótimo número ${String(i)}`,
      });
      espiao.chamadas.length = 0;
      espiao.falharQuando.texto = 'FALHAR';

      await iniciar(cookie, projetoId);
      await esperarJob(projetoId, 'done');

      expect(MAX_TENTATIVAS_CLASSIFICACAO).toBe(3);
      expect(await statusDosComentarios(projetoId)).toEqual({ done: 5, failed: 1 });
      expect(espiao.chamadas.filter((c) => c.comentario.includes('FALHAR'))).toHaveLength(3);
      const falho = await aplicacao.banco.query<{ tentativas: number; erro: string }>(
        "SELECT tentativas_classificacao AS tentativas, erro_classificacao AS erro FROM comentarios WHERE projeto_id = $1 AND status_classificacao = 'failed'",
        [projetoId],
      );
      expect(falho.rows[0]).toEqual({ tentativas: 3, erro: 'ErroDeIaNaoCobrado' });
      expect(await contarLivro(aplicacao.banco, contaId, 'released')).toBe(3);

      espiao.falharQuando.texto = undefined;
      const reprocesso = await chamar(aplicacao, {
        metodo: 'POST',
        url: `/api/projetos/${projetoId}/classificacao/reprocessar-falhas`,
        cookie,
      });
      const durante = await aplicacao.banco.query<{ erro: string | null }>(
        "SELECT erro_classificacao AS erro FROM comentarios WHERE projeto_id = $1 AND texto_original LIKE 'FALHAR%'",
        [projetoId],
      );
      await aguardarAte(async () => (await statusDosComentarios(projetoId)).done === 6);

      expect(reprocesso.statusCode).toBe(202);
      expect(durante.rows[0]?.erro === 'ErroDeIaNaoCobrado' || durante.rows[0]?.erro === null).toBe(
        true,
      );
      const limpo = await aplicacao.banco.query<{ erro: string | null }>(
        'SELECT erro_classificacao AS erro FROM comentarios WHERE projeto_id = $1 AND erro_classificacao IS NOT NULL',
        [projetoId],
      );
      expect(limpo.rowCount).toBe(0);
    });

    it('com o serviço fora do ar o job tenta de novo mais tarde e não gasta as tentativas dos comentários', async () => {
      const { projetoId, cookie } = await criarCenario(6);
      espiao.falharQuando.texto = '';

      await iniciar(cookie, projetoId);
      await aguardarAte(async () => {
        const linha = await aplicacao.banco.query<{ ultimo_erro: string | null }>(
          "SELECT ultimo_erro FROM trabalhos WHERE projeto_id = $1 AND tipo = 'classify'",
          [projetoId],
        );
        return linha.rows[0]?.ultimo_erro === 'ErroTemporarioDeTrabalho: jev_indisponivel';
      });
      await aplicacao.banco.query(
        "UPDATE trabalhos SET status = 'cancelled' WHERE projeto_id = $1 AND tipo = 'classify'",
        [projetoId],
      );
      espiao.falharQuando.texto = undefined;

      const comentarios = await aplicacao.banco.query<{ tentativas: number }>(
        'SELECT tentativas_classificacao AS tentativas FROM comentarios WHERE projeto_id = $1',
        [projetoId],
      );
      expect(comentarios.rows.every((c) => c.tentativas === 0)).toBe(true);
      expect(await statusDosComentarios(projetoId)).toEqual({ pending: 6 });
    });
  });

  describe('limite de custo', () => {
    it('pausa exatamente no limite, sem ultrapassá-lo, e retoma do ponto certo quando o limite sobe', async () => {
      const { contaId, projetoId, cookie } = await criarCenario(40, { limite: '0.000500' });
      espiao.chamadas.length = 0;

      await iniciar(cookie, projetoId);
      await esperarJob(projetoId, 'paused_limit');

      const status = await statusDosComentarios(projetoId);
      const feitos = status.done ?? 0;
      const consumido = await somarLivro(aplicacao.banco, contaId);
      const unitario = await aplicacao.banco.query<{ custo: string }>(
        'SELECT max(real_usd)::text AS custo FROM livro_razao_consumo WHERE conta_ref = $1',
        [contaId],
      );
      expect(feitos).toBeGreaterThan(0);
      expect(feitos).toBeLessThan(40);
      expect(status.pending).toBe(40 - feitos);
      expect(espiao.chamadas).toHaveLength(feitos);
      expect(consumido <= '0.00050000').toBe(true);
      const custo = unitario.rows[0]?.custo ?? '0';
      expect(Number(consumido) + Number(custo)).toBeGreaterThan(0.0005);

      await aplicacao.banco.query(
        'UPDATE planos SET limite_custo_ia_usd = 10 WHERE id = (SELECT plano_id FROM contas WHERE id = $1)',
        [contaId],
      );
      await aplicacao.servicos.controleDeCusto.reavaliarJobsPausados();
      await esperarJob(projetoId, 'done');

      expect(await statusDosComentarios(projetoId)).toEqual({ done: 40 });
      expect(espiao.chamadas).toHaveLength(40);
    });

    it('sem reserva a chamada ao Jev não sai', async () => {
      const { contaId, projetoId, cookie } = await criarCenario(5, { limite: '0.000001' });
      espiao.chamadas.length = 0;

      await iniciar(cookie, projetoId);
      await esperarJob(projetoId, 'paused_limit');

      expect(espiao.chamadas).toHaveLength(0);
      expect(await contarLivro(aplicacao.banco, contaId, 'settled')).toBe(0);
      expect(await statusDosComentarios(projetoId)).toEqual({ pending: 5 });
    });
  });

  describe('interrupção', () => {
    it('uma classificação interrompida no meio continua sozinha depois da recuperação de jobs', async () => {
      const { contaId, projetoId } = await criarCenario(120);
      espiao.chamadas.length = 0;
      const controle = new AbortController();
      const interrompida = aplicacao.servicos.classificacao.classificarPendentes(
        contaId,
        comoProjetoId(projetoId),
        {
          sinal: controle.signal,
          aoProgredir: () => {
            controle.abort();
            return Promise.resolve();
          },
        },
      );
      await expect(interrompida).rejects.toThrow('classificacao_interrompida');
      const parcial = await statusDosComentarios(projetoId);
      expect(parcial.done).toBe(50);

      await aplicacao.banco.query(
        `INSERT INTO trabalhos (conta_id, projeto_id, tipo, status, bloqueado_por, tentativas, sinal_vida_em)
         VALUES ($1, $2, 'classify', 'running', 'instancia-morta', 1, now() - interval '10 minutes')`,
        [contaId, projetoId],
      );
      const reiniciada = await montarAppDeTeste({
        prepararBanco: false,
        classificadorDeComentarios: espiao.classificador,
        ajustesDoExecutor: { intervaloConsultaMs: 20 },
      });
      await reiniciada.executorDeTrabalhos.iniciar();
      await esperarJob(projetoId, 'done');

      expect(await statusDosComentarios(projetoId)).toEqual({ done: 120 });
      expect(espiao.chamadas).toHaveLength(120);
      await reiniciada.encerrar();
    });
  });

  it('o isolamento: cada conta só classifica e enxerga os próprios comentários', async () => {
    const a = await criarCenario(2);
    const b = await criarCenario(2);

    await iniciar(a.cookie, a.projetoId);
    await esperarJob(a.projetoId, 'done');

    expect(await statusDosComentarios(b.projetoId)).toEqual({ pending: 2 });
    const classificacoesDeB = await aplicacao.banco.query(
      'SELECT 1 FROM classificacoes WHERE conta_id = $1',
      [b.contaId],
    );
    expect(classificacoesDeB.rowCount).toBe(0);
  });
});
