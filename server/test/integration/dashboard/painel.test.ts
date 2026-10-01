import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarClassificacaoDeTeste,
  criarComentarioDeTeste,
  criarContaDeTeste,
  criarFonteDeTeste,
  criarProjetoDeTeste,
  criarRegistradorCapturado,
  criarUsuarioDeTeste,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

interface Painel {
  resumo: {
    total: number;
    classificados: number;
    pendentesDeRevisao: number;
    notaMedia: number | null;
  };
  temas: { tema: string; sentimento: string; total: number }[];
  gravidade: { nivel: number; total: number }[];
}

interface Pagina {
  itens: Record<string, unknown>[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

const BOM = '﻿';

describe('painel, comentários, revisão e exportação', () => {
  const captura = criarRegistradorCapturado();
  let aplicacao: AppDeTeste;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste({ registrador: captura.registrador });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function criarCenario() {
    const contaId = await criarContaDeTeste(aplicacao.banco);
    const dono = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'owner' });
    const membro = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'member' });
    const projetoId = await criarProjetoDeTeste(aplicacao.banco, contaId);
    const planilha = await criarFonteDeTeste(aplicacao.banco, contaId, projetoId, 'planilha.csv');
    const outraFonte = await criarFonteDeTeste(aplicacao.banco, contaId, projetoId, 'outra.csv');
    const novo = (
      texto: string,
      extras: Parameters<typeof criarComentarioDeTeste>[5],
      fonte = planilha,
    ) => criarComentarioDeTeste(aplicacao.banco, contaId, projetoId, fonte, texto, extras);
    const classificar = (
      id: Parameters<typeof criarClassificacaoDeTeste>[2],
      extras: Parameters<typeof criarClassificacaoDeTeste>[4],
    ) => criarClassificacaoDeTeste(aplicacao.banco, contaId, id, undefined, extras);
    return {
      contaId,
      dono,
      membro,
      projetoId,
      planilha,
      outraFonte,
      novo,
      classificar,
      cookieDono: await entrar(aplicacao, dono.email),
      cookieMembro: await entrar(aplicacao, membro.email),
    };
  }

  type Cenario = Awaited<ReturnType<typeof criarCenario>>;

  async function popular(c: Cenario) {
    const a = await c.novo('Fila enorme na loja', {
      unidade: 'Centro',
      nota: 1,
      autor: 'Ana',
      comentadoEm: new Date('2024-03-10T15:00:00Z'),
    });
    const b = await c.novo('Atendimento ótimo', {
      unidade: 'Centro',
      nota: 5,
      autor: 'Bia',
      comentadoEm: new Date('2024-03-20T15:00:00Z'),
    });
    const d = await c.novo('Preço alto demais', { unidade: 'Norte', nota: 3, autor: 'Caio' });
    const e = await c.novo('Sem classificação ainda', { unidade: 'Norte' });
    const f = await c.novo(
      'Entrega atrasou',
      { unidade: 'Norte', nota: 2, comentadoEm: new Date('2024-04-05T15:00:00Z') },
      c.outraFonte,
    );
    await c.classificar(a, {
      tema: 'wait_time',
      sentimento: 'negative',
      gravidadePontuacao: 2,
      precisaAcao: 0.85,
      precisaRevisao: true,
      temaConfianca: 0.4,
    });
    await c.classificar(b, {
      tema: 'service',
      sentimento: 'positive',
      gravidadePontuacao: 0,
      precisaAcao: 0.1,
    });
    await c.classificar(d, {
      tema: 'price',
      sentimento: 'negative',
      gravidadePontuacao: 1,
      precisaAcao: 0.49,
    });
    await c.classificar(f, {
      tema: 'delivery',
      sentimento: 'negative',
      gravidadePontuacao: 3,
      precisaAcao: 0.5,
      precisaRevisao: true,
    });
    return { a, b, d, e, f };
  }

  async function pegar(c: Cenario, caminho: string, cookie = c.cookieDono) {
    return chamar(aplicacao, {
      metodo: 'GET',
      url: `/api/projetos/${c.projetoId}${caminho}`,
      cookie,
    });
  }

  describe('painel', () => {
    it('devolve os cartões, o gráfico de tema por sentimento e a distribuição de gravidade', async () => {
      const c = await criarCenario();
      await popular(c);

      const resposta = await pegar(c, '/painel');

      const painel = resposta.json<Painel>();
      expect(resposta.statusCode).toBe(200);
      expect(painel.resumo).toEqual({
        total: 5,
        classificados: 4,
        pendentesDeRevisao: 2,
        notaMedia: 2.75,
      });
      expect(painel.temas).toHaveLength(4);
      expect(painel.temas).toContainEqual({ tema: 'wait_time', sentimento: 'negative', total: 1 });
      expect(painel.gravidade).toEqual([
        { nivel: 0, total: 1 },
        { nivel: 1, total: 1 },
        { nivel: 2, total: 1 },
        { nivel: 3, total: 1 },
      ]);
    });

    it('filtra por fonte, unidade, tema, sentimento e período', async () => {
      const c = await criarCenario();
      await popular(c);

      const porFonte = (await pegar(c, `/painel?fonteId=${c.outraFonte}`)).json<Painel>();
      const porUnidade = (await pegar(c, '/painel?unidade=Centro')).json<Painel>();
      const porTema = (await pegar(c, '/painel?tema=price')).json<Painel>();
      const porSentimento = (await pegar(c, '/painel?sentimento=positive')).json<Painel>();
      const porPeriodo = (await pegar(c, '/painel?de=2024-03-01&ate=2024-03-31')).json<Painel>();

      expect(porFonte.resumo.total).toBe(1);
      expect(porUnidade.resumo.total).toBe(2);
      expect(porTema.resumo.total).toBe(1);
      expect(porSentimento.resumo.total).toBe(1);
      expect(porPeriodo.resumo.total).toBe(2);
    });

    it('comentário sem data fica fora do filtro de período e aparece com o filtro vazio', async () => {
      const c = await criarCenario();
      await popular(c);

      const todos = (await pegar(c, '/comentarios?tamanhoPagina=100')).json<Pagina>();
      const periodo = (
        await pegar(c, '/comentarios?de=2020-01-01&ate=2030-12-31&tamanhoPagina=100')
      ).json<Pagina>();

      const semData = (itens: Pagina['itens']) =>
        itens.filter((i) => i.comentadoEm === null).length;
      expect(todos.total).toBe(5);
      expect(semData(todos.itens)).toBe(2);
      expect(periodo.total).toBe(3);
      expect(semData(periodo.itens)).toBe(0);
    });

    it('"precisa de ação" usa o limiar: 0,49 fica de fora e 0,5 entra', async () => {
      const c = await criarCenario();
      await popular(c);

      const resposta = (
        await pegar(c, '/comentarios?precisaAcao=true&tamanhoPagina=100')
      ).json<Pagina>();

      const textos = resposta.itens.map((i) => i.textoOriginal).sort();
      expect(textos).toEqual(['Entrega atrasou', 'Fila enorme na loja']);
      expect(resposta.itens.every((i) => i.precisaAcao === true)).toBe(true);
    });

    it('entrega as opções de filtro: fontes e unidades do projeto', async () => {
      const c = await criarCenario();
      await popular(c);

      const resposta = await pegar(c, '/painel/opcoes');

      expect(resposta.json()).toEqual({
        fontes: [
          { id: c.outraFonte, nome: 'outra.csv' },
          { id: c.planilha, nome: 'planilha.csv' },
        ],
        unidades: ['Centro', 'Norte'],
      });
    });

    it('recusa filtro desconhecido e valores malformados', async () => {
      const c = await criarCenario();

      expect((await pegar(c, '/painel?contaId=x')).statusCode).toBe(400);
      expect((await pegar(c, '/painel?de=ontem')).statusCode).toBe(400);
      expect((await pegar(c, '/painel?fonteId=nao-e-uuid')).statusCode).toBe(400);
    });

    it('o valor do filtro nunca vira SQL: texto perigoso só não encontra nada', async () => {
      const c = await criarCenario();
      await popular(c);
      const perigoso = encodeURIComponent("Centro'; DROP TABLE comentarios; --");

      const resposta = (await pegar(c, `/comentarios?unidade=${perigoso}`)).json<Pagina>();

      expect(resposta.total).toBe(0);
      const tabela = await aplicacao.banco.query(
        'SELECT 1 FROM comentarios WHERE projeto_id = $1',
        [c.projetoId],
      );
      expect(tabela.rowCount).toBe(5);
    });
  });

  describe('lista paginada', () => {
    it('pagina com total correto, ordenação estável e limite de 100 por página', async () => {
      const c = await criarCenario();
      await popular(c);

      const primeira = (await pegar(c, '/comentarios?pagina=1&tamanhoPagina=2')).json<Pagina>();
      const segunda = (await pegar(c, '/comentarios?pagina=2&tamanhoPagina=2')).json<Pagina>();
      const terceira = (await pegar(c, '/comentarios?pagina=3&tamanhoPagina=2')).json<Pagina>();
      const enorme = await pegar(c, '/comentarios?tamanhoPagina=101');

      expect(primeira).toMatchObject({ total: 5, pagina: 1, tamanhoPagina: 2 });
      expect([primeira, segunda, terceira].map((p) => p.itens.length)).toEqual([2, 2, 1]);
      const ids = [...primeira.itens, ...segunda.itens, ...terceira.itens].map((i) => i.id);
      expect(new Set(ids).size).toBe(5);
      expect(enorme.statusCode).toBe(400);
    });

    it('mostra o original, os rótulos por id, a confiança e o indicador de revisão', async () => {
      const c = await criarCenario();
      await popular(c);

      const resposta = (await pegar(c, '/comentarios?tema=wait_time')).json<Pagina>();

      expect(resposta.itens[0]).toMatchObject({
        textoOriginal: 'Fila enorme na loja',
        fonte: 'planilha.csv',
        unidade: 'Centro',
        autor: 'Ana',
        nota: 1,
        tema: 'wait_time',
        sentimento: 'negative',
        temaConfianca: 0.4,
        precisaRevisao: true,
        foiRevisado: false,
        precisaAcao: true,
      });
    });
  });

  describe('fila de revisão e correção humana', () => {
    it('lista só o que precisa de revisão e ainda não foi corrigido', async () => {
      const c = await criarCenario();
      await popular(c);

      const fila = (await pegar(c, '/revisao')).json<Pagina>();

      expect(fila.total).toBe(2);
      expect(fila.itens.map((i) => i.textoOriginal).sort()).toEqual([
        'Entrega atrasou',
        'Fila enorme na loja',
      ]);
    });

    it('a correção prevalece na lista, nos gráficos e nos contadores, sem apagar a resposta do modelo', async () => {
      const c = await criarCenario();
      const { a } = await popular(c);

      const resposta = await chamar(aplicacao, {
        metodo: 'PUT',
        url: `/api/projetos/${c.projetoId}/comentarios/${a}/revisao`,
        cookie: c.cookieDono,
        corpo: { tema: 'service', sentimento: 'mixed' },
      });

      expect(resposta.statusCode).toBe(204);
      const painel = (await pegar(c, '/painel')).json<Painel>();
      expect(painel.resumo.pendentesDeRevisao).toBe(1);
      expect(painel.temas).toContainEqual({ tema: 'service', sentimento: 'mixed', total: 1 });
      expect(painel.temas).not.toContainEqual({
        tema: 'wait_time',
        sentimento: 'negative',
        total: 1,
      });
      const porTema = (await pegar(c, '/comentarios?tema=service')).json<Pagina>();
      expect(porTema.itens.find((i) => i.id === a)).toMatchObject({
        tema: 'service',
        sentimento: 'mixed',
        temaDoModelo: 'wait_time',
        sentimentoDoModelo: 'negative',
        foiRevisado: true,
      });
      expect((await pegar(c, '/revisao')).json<Pagina>().total).toBe(1);
      const original = await aplicacao.banco.query<{ tema: string; sentimento: string }>(
        'SELECT tema, sentimento FROM classificacoes WHERE comentario_id = $1',
        [a],
      );
      expect(original.rows[0]).toEqual({ tema: 'wait_time', sentimento: 'negative' });
    });

    it('recusa tema ou sentimento inventado', async () => {
      const c = await criarCenario();
      const { a } = await popular(c);

      const resposta = await chamar(aplicacao, {
        metodo: 'PUT',
        url: `/api/projetos/${c.projetoId}/comentarios/${a}/revisao`,
        cookie: c.cookieDono,
        corpo: { tema: 'inventado', sentimento: 'positive' },
      });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json<{ erro: { codigo: string } }>().erro.codigo).toBe(
        'classificacao_invalida',
      );
    });

    it('member consegue filtrar, revisar e exportar', async () => {
      const c = await criarCenario();
      const { f } = await popular(c);

      const filtrar = await pegar(c, '/comentarios?tema=delivery', c.cookieMembro);
      const revisar = await chamar(aplicacao, {
        metodo: 'PUT',
        url: `/api/projetos/${c.projetoId}/comentarios/${f}/revisao`,
        cookie: c.cookieMembro,
        corpo: { tema: 'price', sentimento: 'negative' },
      });
      const exportar = await pegar(c, '/exportacao', c.cookieMembro);

      expect(filtrar.statusCode).toBe(200);
      expect(revisar.statusCode).toBe(204);
      expect(exportar.statusCode).toBe(200);
    });
  });

  describe('isolamento entre contas', () => {
    it('nenhuma rota devolve ou altera comentários de outra conta', async () => {
      const a = await criarCenario();
      const b = await criarCenario();
      const { a: comentarioDeA } = await popular(a);
      await popular(b);

      const respostas = await Promise.all([
        pegar(a, '/painel', b.cookieDono),
        pegar(a, '/painel/opcoes', b.cookieDono),
        pegar(a, '/comentarios', b.cookieDono),
        pegar(a, '/revisao', b.cookieDono),
        pegar(a, '/exportacao', b.cookieDono),
        chamar(aplicacao, {
          metodo: 'PUT',
          url: `/api/projetos/${a.projetoId}/comentarios/${comentarioDeA}/revisao`,
          cookie: b.cookieDono,
          corpo: { tema: 'price', sentimento: 'negative' },
        }),
        chamar(aplicacao, {
          metodo: 'PUT',
          url: `/api/projetos/${b.projetoId}/comentarios/${comentarioDeA}/revisao`,
          cookie: b.cookieDono,
          corpo: { tema: 'price', sentimento: 'negative' },
        }),
      ]);

      expect(respostas.map((r) => r.statusCode)).toEqual([404, 404, 404, 404, 404, 404, 404]);
      const revisoes = await aplicacao.banco.query(
        'SELECT 1 FROM revisoes_classificacao WHERE conta_id = $1',
        [a.contaId],
      );
      expect(revisoes.rowCount).toBe(0);
    });

    it('exige sessão', async () => {
      const c = await criarCenario();

      const resposta = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${c.projetoId}/painel`,
      });

      expect(resposta.statusCode).toBe(401);
    });
  });

  describe('exportação em CSV', () => {
    it('sai com ponto e vírgula, UTF-8 com BOM, acentos corretos e cabeçalho em português', async () => {
      const c = await criarCenario();
      await popular(c);

      const resposta = await pegar(c, '/exportacao');

      const corpo = Buffer.from(resposta.rawPayload);
      const texto = corpo.toString('utf8');
      const linhas = texto.split('\r\n').filter((l) => l !== '');
      expect(resposta.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(resposta.headers['content-disposition']).toMatch(
        /^attachment; filename="comentarios-.*\.csv"$/,
      );
      expect(corpo.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      expect(linhas[0]).toBe(
        `${BOM}Comentário;Fonte;Unidade;Autor;Data;Nota;Tema;Sentimento;Gravidade (0 a 1);Precisa de ação;Confiança do tema (0 a 1);Confiança do sentimento (0 a 1);Revisado por pessoa`,
      );
      expect(linhas).toHaveLength(6);
      expect(texto).toContain('Atendimento ótimo;planilha.csv;Centro;Bia;20/03/2024');
      expect(texto).toContain(';Atendimento;Positivo;');
      expect(texto).toContain(';Tempo de espera;Negativo;');
    });

    it('usa a correção humana e marca o comentário como revisado', async () => {
      const c = await criarCenario();
      const { a } = await popular(c);
      await chamar(aplicacao, {
        metodo: 'PUT',
        url: `/api/projetos/${c.projetoId}/comentarios/${a}/revisao`,
        cookie: c.cookieDono,
        corpo: { tema: 'price', sentimento: 'mixed' },
      });

      const texto = (await pegar(c, '/exportacao?tema=price&sentimento=mixed')).body;

      const linha = texto.split('\r\n').find((l) => l.startsWith('Fila enorme na loja'));
      expect(linha).toContain(';Preço;Misto;');
      expect(linha?.endsWith(';Sim')).toBe(true);
    });

    it('respeita os filtros da tela e informa precisa de ação como Sim ou Não', async () => {
      const c = await criarCenario();
      await popular(c);

      const texto = (await pegar(c, '/exportacao?precisaAcao=true')).body;

      const linhas = texto.split('\r\n').filter((l) => l !== '');
      expect(linhas).toHaveLength(3);
      expect(linhas.slice(1).every((l) => l.includes(';Sim;'))).toBe(true);
    });

    it('neutraliza texto que o Excel leria como fórmula e deixa números e texto comum intactos', async () => {
      const c = await criarCenario();
      for (const [indice, texto] of [
        '=1+1',
        '+cmd',
        '-cmd',
        '@SOMA(A1)',
        '\tcom tab',
        '\rcom retorno',
        'Texto normal',
      ].entries()) {
        const id = await c.novo(texto, {
          unidade: '=UNIDADE',
          autor: '@autor',
          nota: indice % 5 === 0 ? 1 : 4,
        });
        await c.classificar(id, { gravidadePontuacao: 0 });
      }

      const texto = (await pegar(c, '/exportacao')).body;

      expect(texto).toContain("\r\n'=1+1;planilha.csv;'=UNIDADE;'@autor;");
      expect(texto).toContain("\r\n'+cmd;");
      expect(texto).toContain("\r\n'-cmd;");
      expect(texto).toContain("\r\n'@SOMA(A1);");
      expect(texto).toContain("\r\n'\tcom tab;");
      expect(texto).toContain("'\rcom retorno");
      expect(texto).toContain("\r\nTexto normal;planilha.csv;'=UNIDADE;");
      expect(texto).toMatch(/;1;Outro|;4;/);
    });

    it('exporta em lotes sem perder nem repetir linhas e registra auditoria sem texto de comentário', async () => {
      const c = await criarCenario();
      for (let i = 0; i < 25; i += 1) {
        await c.novo(`Comentário número ${String(i)}`, { nota: (i % 5) + 1 });
      }

      const texto = (await pegar(c, '/exportacao')).body;

      const linhas = texto.split('\r\n').filter((l) => l !== '');
      expect(linhas).toHaveLength(26);
      expect(new Set(linhas).size).toBe(26);
      const evento = captura
        .linhas()
        .find((l) => l.acao === 'exportacao' && l.alvoId === c.projetoId);
      expect(evento).toMatchObject({
        categoria: 'auditoria',
        contaId: c.contaId,
        usuarioId: c.dono.id,
      });
      expect(JSON.stringify(evento)).not.toContain('Comentário número');
    });
  });

  describe('classificação: estimativa de tempo', () => {
    it('a rota de estimativa informa os minutos pelo cálculo de vazão', async () => {
      const c = await criarCenario();
      for (let i = 0; i < 7; i += 1) {
        await c.novo(`Pendente ${String(i)}`, {});
      }

      const resposta = await pegar(c, '/classificacao/estimativa');

      const corpo = resposta.json<{ pendentes: number; minutosEstimados: number }>();
      expect(corpo.pendentes).toBe(7);
      expect(corpo.minutosEstimados).toBe(
        Math.ceil(7 / Math.min((aplicacao.configuracao.jev.concorrencia * 60) / 1, 1200)),
      );
    });
  });
});
