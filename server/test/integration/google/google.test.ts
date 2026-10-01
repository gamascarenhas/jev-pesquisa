import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ErroDoGoogle,
  TAMANHO_DA_PAGINA_DE_AVALIACOES,
} from '../../../src/integrations/google/fonte-avaliacoes.js';
import {
  CODIGO_SIMULADO,
  criarFonteDeAvaliacoesSimulada,
  type FonteDeAvaliacoesSimulada,
} from '../../../src/integrations/google/fonte-avaliacoes-simulada.js';
import { comoComentarioId } from '../../../src/shared/ids.js';
import { sincronizarGoogleAgendado } from '../../../src/composicao-google.js';
import { criarConexoesGoogleSistemaRepositorio } from '../../../src/modules/google-business/conexoes-google.sistema.repositorio.js';
import { aguardarAte } from '../../helpers/aguardar.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarClassificacaoDeTeste,
  criarContaDeTeste,
  criarRegistradorCapturado,
  criarUsuarioDeTeste,
  type UsuarioDeTeste,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

const UNIDADE_GRANDE = 'accounts/1000000001/locations/2000000001';
const UNIDADE_MEDIA = 'accounts/1000000001/locations/2000000002';
const TOTAL_DA_UNIDADE_GRANDE = 101;
const TOTAL_DA_UNIDADE_MEDIA = 33;

function exigir<T>(valor: T | undefined): T {
  if (valor === undefined) {
    throw new Error('Valor esperado no teste não existe.');
  }
  return valor;
}

interface Cenario {
  dono: UsuarioDeTeste;
  membro: UsuarioDeTeste;
  cookieDono: string;
  cookieMembro: string;
  projetoId: string;
}

describe('Perfil da Empresa no Google (modo simulado)', () => {
  let aplicacao: AppDeTeste;
  let fonte: FonteDeAvaliacoesSimulada;
  const captura = criarRegistradorCapturado();

  beforeAll(async () => {
    fonte = criarFonteDeAvaliacoesSimulada({
      uriRedirecionamento: 'http://localhost:3000/api/google/callback',
    });
    aplicacao = await montarAppDeTeste({
      fonteDeAvaliacoes: fonte,
      registrador: captura.registrador,
      ajustesDoExecutor: { intervaloConsultaMs: 20 },
    });
    await aplicacao.executorDeTrabalhos.iniciar();
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function criarCenario(): Promise<Cenario> {
    const contaId = await criarContaDeTeste(aplicacao.banco);
    const dono = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'owner' });
    const membro = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'member' });
    const cookieDono = await entrar(aplicacao, dono.email);
    const resposta = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/projetos',
      cookie: cookieDono,
      corpo: { nome: 'Lojas' },
    });
    return {
      dono,
      membro,
      cookieDono,
      cookieMembro: await entrar(aplicacao, membro.email),
      projetoId: resposta.json<{ id: string }>().id,
    };
  }

  async function iniciarConexao(cenario: Cenario): Promise<string> {
    const resposta = await chamar(aplicacao, {
      metodo: 'POST',
      url: `/api/projetos/${cenario.projetoId}/google/conectar`,
      cookie: cenario.cookieDono,
    });
    return new URL(resposta.json<{ url: string }>().url).searchParams.get('state') ?? '';
  }

  function callback(cenario: Cenario, state: string, code = CODIGO_SIMULADO) {
    return chamar(aplicacao, {
      metodo: 'GET',
      url: `/api/google/callback?code=${code}&state=${state}`,
      cookie: cenario.cookieDono,
    });
  }

  async function conectar(cenario: Cenario): Promise<void> {
    const resposta = await callback(cenario, await iniciarConexao(cenario));
    expect(resposta.statusCode).toBe(302);
  }

  async function sincronizarUnidades(cenario: Cenario, unidades: string[]): Promise<void> {
    const resposta = await chamar(aplicacao, {
      metodo: 'PUT',
      url: `/api/projetos/${cenario.projetoId}/google/unidades`,
      cookie: cenario.cookieDono,
      corpo: { unidades },
    });
    expect(resposta.statusCode).toBe(202);
    await aguardarFimDaSincronizacao(cenario);
  }

  async function aguardarFimDaSincronizacao(cenario: Cenario): Promise<void> {
    await aguardarAte(async () => {
      const ativos = await aplicacao.banco.query(
        `SELECT 1 FROM trabalhos WHERE projeto_id = $1 AND tipo = 'google_sync'
            AND status IN ('pending', 'running')`,
        [cenario.projetoId],
      );
      return ativos.rowCount === 0;
    });
  }

  async function contarJobsDeSincronizacao(projetoId: string): Promise<number> {
    const resultado = await aplicacao.banco.query<{ total: string }>(
      "SELECT count(*) AS total FROM trabalhos WHERE projeto_id = $1 AND tipo = 'google_sync'",
      [projetoId],
    );
    return Number(resultado.rows[0]?.total);
  }

  async function contar(cenario: Cenario, condicao = 'true'): Promise<number> {
    const resultado = await aplicacao.banco.query<{ total: string }>(
      `SELECT count(*) AS total FROM comentarios WHERE projeto_id = $1 AND ${condicao}`,
      [cenario.projetoId],
    );
    return Number(resultado.rows[0]?.total);
  }

  describe('conexão', () => {
    it('conecta pelo OAuth, grava os tokens criptografados e nunca os escreve em log', async () => {
      const cenario = await criarCenario();

      await conectar(cenario);

      const linha = await aplicacao.banco.query<{
        token_atualizacao_criptografado: string;
        token_acesso_criptografado: string;
        email_conta_google: string;
      }>(
        `SELECT token_atualizacao_criptografado, token_acesso_criptografado, email_conta_google
           FROM conexoes_google WHERE projeto_id = $1`,
        [cenario.projetoId],
      );
      const conexao = linha.rows[0];
      expect(conexao?.email_conta_google).toBe('conta-simulada@exemplo.com.br');
      expect(conexao?.token_atualizacao_criptografado).toMatch(/^v1:/);
      expect(conexao?.token_atualizacao_criptografado).not.toContain('atualizacao-simulada');
      expect(conexao?.token_acesso_criptografado).not.toContain('acesso-simulado');
      const logs = JSON.stringify(captura.linhas());
      expect(logs).not.toContain('atualizacao-simulada');
      expect(logs).not.toContain('acesso-simulado');
      expect(logs).not.toContain(conexao?.token_atualizacao_criptografado ?? 'x');
      const evento = captura.linhas().find((l) => l.acao === 'google_conectado');
      expect(evento).toMatchObject({ categoria: 'auditoria', alvoId: cenario.projetoId });
    });

    it('recusa callback com state ausente, errado ou reutilizado', async () => {
      const cenario = await criarCenario();
      const state = await iniciarConexao(cenario);

      const errado = await callback(cenario, 'outro-valor');
      const semEstadoGuardado = await callback(cenario, state);
      const reutilizado = await callback(cenario, state);
      const semParametros = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/google/callback',
        cookie: cenario.cookieDono,
      });

      expect(errado.statusCode).toBe(400);
      expect(errado.json<{ erro: { codigo: string } }>().erro.codigo).toBe(
        'google_estado_invalido',
      );
      // O estado é de uso único: errar uma vez já o consome.
      expect(semEstadoGuardado.statusCode).toBe(400);
      expect(reutilizado.statusCode).toBe(400);
      expect(semParametros.statusCode).toBe(302);
      const conexoes = await aplicacao.banco.query(
        'SELECT 1 FROM conexoes_google WHERE projeto_id = $1',
        [cenario.projetoId],
      );
      expect(conexoes.rowCount).toBe(0);
    });

    it('recusa um state expirado', async () => {
      const cenario = await criarCenario();
      const state = await iniciarConexao(cenario);
      await aplicacao.banco.query(
        `UPDATE sessoes SET dados = jsonb_set(dados, '{googleEstado,criadoEm}', '0'::jsonb)
          WHERE usuario_id = $1`,
        [cenario.dono.id],
      );

      const resposta = await callback(cenario, state);

      expect(resposta.statusCode).toBe(400);
    });

    it('member recebe 403 ao conectar, escolher unidades, sincronizar e desconectar', async () => {
      const cenario = await criarCenario();
      const base = `/api/projetos/${cenario.projetoId}/google`;
      const chamadas = [
        { metodo: 'POST' as const, url: `${base}/conectar` },
        { metodo: 'GET' as const, url: `${base}/unidades` },
        { metodo: 'PUT' as const, url: `${base}/unidades`, corpo: { unidades: [UNIDADE_GRANDE] } },
        { metodo: 'POST' as const, url: `${base}/sincronizar` },
        { metodo: 'DELETE' as const, url: base },
        { metodo: 'GET' as const, url: '/api/google/callback?code=a&state=b' },
      ];

      for (const chamada of chamadas) {
        const resposta = await chamar(aplicacao, { ...chamada, cookie: cenario.cookieMembro });
        expect(resposta.statusCode, `${chamada.metodo} ${chamada.url}`).toBe(403);
      }
      const status = await chamar(aplicacao, {
        metodo: 'GET',
        url: base,
        cookie: cenario.cookieMembro,
      });
      expect(status.statusCode).toBe(200);
    });

    it('não conecta duas vezes o mesmo projeto', async () => {
      const cenario = await criarCenario();
      await conectar(cenario);

      const resposta = await callback(cenario, await iniciarConexao(cenario));

      expect(resposta.statusCode).toBe(302);
      expect(resposta.headers.location).toContain('erro=google_ja_conectado');
    });
  });

  describe('importação e sincronização', () => {
    it('importa as unidades escolhidas e a segunda sincronização não duplica nada', async () => {
      const cenario = await criarCenario();
      await conectar(cenario);

      await sincronizarUnidades(cenario, [UNIDADE_GRANDE, UNIDADE_MEDIA]);
      const primeira = await contar(cenario);
      await chamar(aplicacao, {
        metodo: 'POST',
        url: `/api/projetos/${cenario.projetoId}/google/sincronizar`,
        cookie: cenario.cookieDono,
      });
      await aguardarFimDaSincronizacao(cenario);

      expect(primeira).toBe(TOTAL_DA_UNIDADE_GRANDE + TOTAL_DA_UNIDADE_MEDIA);
      expect(await contar(cenario)).toBe(primeira);
      const fontes = await aplicacao.banco.query(
        "SELECT 1 FROM fontes WHERE projeto_id = $1 AND tipo = 'google_business'",
        [cenario.projetoId],
      );
      expect(fontes.rowCount).toBe(2);
    });

    it('avaliação só com estrelas é gravada como no_text, sem texto e com nota', async () => {
      const cenario = await criarCenario();
      await conectar(cenario);

      await sincronizarUnidades(cenario, [UNIDADE_GRANDE]);

      const semTexto = await aplicacao.banco.query<{ nota: number | null; texto: string | null }>(
        `SELECT nota, texto_original AS texto FROM comentarios
          WHERE projeto_id = $1 AND status_classificacao = 'no_text'`,
        [cenario.projetoId],
      );
      expect(semTexto.rowCount).toBeGreaterThan(0);
      expect(semTexto.rows.every((c) => c.texto === null && c.nota !== null)).toBe(true);
      expect(await contar(cenario, "status_classificacao = 'pending'")).toBe(
        TOTAL_DA_UNIDADE_GRANDE - (semTexto.rowCount ?? 0),
      );
      expect(await contar(cenario, 'nota IS NULL')).toBe(0);
    });

    it('lê as páginas de 50 em 50 até o fim', async () => {
      const p1 = await fonte.listarAvaliacoes('t', UNIDADE_GRANDE, null);
      const p2 = await fonte.listarAvaliacoes('t', UNIDADE_GRANDE, p1.proximaPagina);
      const p3 = await fonte.listarAvaliacoes('t', UNIDADE_GRANDE, p2.proximaPagina);

      expect(p1.avaliacoes).toHaveLength(TAMANHO_DA_PAGINA_DE_AVALIACOES);
      expect(p2.avaliacoes).toHaveLength(TAMANHO_DA_PAGINA_DE_AVALIACOES);
      expect(p3.avaliacoes).toHaveLength(1);
      expect(p3.proximaPagina).toBeNull();
    });

    it('a incremental para na primeira avaliação antiga; a editada volta a pending sem classificação', async () => {
      const cenario = await criarCenario();
      await conectar(cenario);
      await sincronizarUnidades(cenario, [UNIDADE_GRANDE]);
      const alvo = await aplicacao.banco.query<{ id: string; id_externo: string }>(
        `SELECT id, id_externo FROM comentarios
          WHERE projeto_id = $1 AND status_classificacao = 'pending' ORDER BY id_externo LIMIT 1`,
        [cenario.projetoId],
      );
      const { id, id_externo: idExterno } = alvo.rows[0] ?? { id: '', id_externo: '' };
      await criarClassificacaoDeTeste(
        aplicacao.banco,
        cenario.dono.contaId,
        comoComentarioId(id),
        cenario.dono.id,
      );
      const amanha = new Date(Date.now() + 24 * 3_600_000).toISOString();
      const lista = exigir(fonte.avaliacoesPorUnidade[UNIDADE_GRANDE]);
      const original = exigir(lista.find((a) => a.reviewId === idExterno));
      const copia = { ...original };
      Object.assign(original, { comment: 'Texto editado pelo cliente.', updateTime: amanha });
      lista.push({
        reviewId: 'NovaAvaliacao001',
        starRating: 'FIVE',
        comment: 'Avaliação nova.',
        createTime: amanha,
        updateTime: amanha,
      });
      const paginas: (string | null)[] = [];
      const lerOriginal = fonte.listarAvaliacoes.bind(fonte);
      fonte.listarAvaliacoes = (token, unidade, pagina) => {
        paginas.push(pagina);
        return lerOriginal(token, unidade, pagina);
      };

      try {
        await chamar(aplicacao, {
          metodo: 'POST',
          url: `/api/projetos/${cenario.projetoId}/google/sincronizar`,
          cookie: cenario.cookieDono,
        });
        await aguardarFimDaSincronizacao(cenario);
      } finally {
        fonte.listarAvaliacoes = lerOriginal;
        Object.assign(original, copia);
        lista.pop();
      }

      expect(paginas).toEqual([null]);
      expect(await contar(cenario)).toBe(TOTAL_DA_UNIDADE_GRANDE + 1);
      const editado = await aplicacao.banco.query<{ status: string; texto: string }>(
        'SELECT status_classificacao AS status, texto_original AS texto FROM comentarios WHERE id = $1',
        [id],
      );
      expect(editado.rows[0]).toEqual({
        status: 'pending',
        texto: 'Texto editado pelo cliente.',
      });
      for (const tabela of ['classificacoes', 'revisoes_classificacao']) {
        const restantes = await aplicacao.banco.query(
          `SELECT 1 FROM ${tabela} WHERE comentario_id = $1`,
          [id],
        );
        expect(restantes.rowCount).toBe(0);
      }
    });
  });

  describe('sincronização agendada', () => {
    it('cria um job só para projetos com conexão ativa e unidades escolhidas', async () => {
      const conectado = await criarCenario();
      await conectar(conectado);
      await sincronizarUnidades(conectado, [UNIDADE_MEDIA]);
      const semUnidades = await criarCenario();
      await conectar(semUnidades);
      const antes = await contarJobsDeSincronizacao(conectado.projetoId);

      await sincronizarGoogleAgendado(
        criarConexoesGoogleSistemaRepositorio(aplicacao.banco),
        aplicacao.servicos.trabalhos,
      );
      await aguardarFimDaSincronizacao(conectado);

      expect(await contarJobsDeSincronizacao(conectado.projetoId)).toBe(antes + 1);
      expect(await contarJobsDeSincronizacao(semUnidades.projetoId)).toBe(0);
    });
  });

  describe('falhas do Google', () => {
    it('403 explica que o acesso à API ainda não foi aprovado e fica registrado na fonte', async () => {
      const cenario = await criarCenario();
      await conectar(cenario);
      const original = fonte.listarAvaliacoes.bind(fonte);
      fonte.listarAvaliacoes = () => Promise.reject(new ErroDoGoogle('sem_acesso', 403));

      try {
        await sincronizarUnidades(cenario, [UNIDADE_MEDIA]);
      } finally {
        fonte.listarAvaliacoes = original;
      }

      const status = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${cenario.projetoId}/google`,
        cookie: cenario.cookieDono,
      });
      const falha = status.json<{ unidades: { falha: { codigo: string; mensagem: string } }[] }>()
        .unidades[0]?.falha;
      expect(falha?.codigo).toBe('google_sem_acesso');
      expect(falha?.mensagem).toContain('ainda não foi aprovado');
      expect(await contar(cenario)).toBe(0);
    });

    it('403 ao listar unidades devolve a mesma mensagem clara', async () => {
      const cenario = await criarCenario();
      await conectar(cenario);
      const original = fonte.listarContas.bind(fonte);
      fonte.listarContas = () => Promise.reject(new ErroDoGoogle('sem_acesso', 403));

      let resposta;
      try {
        resposta = await chamar(aplicacao, {
          metodo: 'GET',
          url: `/api/projetos/${cenario.projetoId}/google/unidades`,
          cookie: cenario.cookieDono,
        });
      } finally {
        fonte.listarContas = original;
      }

      expect(resposta.statusCode).toBe(502);
      expect(resposta.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain(
        'ainda não foi aprovado',
      );
    });

    it('recusa unidades que o Google não listou para a conexão', async () => {
      const cenario = await criarCenario();
      await conectar(cenario);

      const resposta = await chamar(aplicacao, {
        metodo: 'PUT',
        url: `/api/projetos/${cenario.projetoId}/google/unidades`,
        cookie: cenario.cookieDono,
        corpo: { unidades: ['accounts/9/locations/9'] },
      });

      expect(resposta.statusCode).toBe(400);
    });
  });

  describe('desconexão e exclusão', () => {
    it('desconectar revoga no Google, apaga os tokens e mantém a linha como histórico', async () => {
      const cenario = await criarCenario();
      await conectar(cenario);
      await sincronizarUnidades(cenario, [UNIDADE_MEDIA]);

      const resposta = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/projetos/${cenario.projetoId}/google`,
        cookie: cenario.cookieDono,
      });

      expect(resposta.statusCode).toBe(204);
      expect(fonte.tokensRevogados).toContain('atualizacao-simulada');
      const linha = await aplicacao.banco.query<Record<string, unknown>>(
        `SELECT token_atualizacao_criptografado, token_acesso_criptografado,
                token_acesso_expira_em, revogado_em FROM conexoes_google WHERE projeto_id = $1`,
        [cenario.projetoId],
      );
      expect(linha.rows[0]).toMatchObject({
        token_atualizacao_criptografado: null,
        token_acesso_criptografado: null,
        token_acesso_expira_em: null,
      });
      expect(linha.rows[0]?.revogado_em).toBeInstanceOf(Date);
      const status = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${cenario.projetoId}/google`,
        cookie: cenario.cookieDono,
      });
      expect(status.json<{ conectado: boolean }>().conectado).toBe(false);
      const agendadas = await aplicacao.banco.query(
        `SELECT 1 FROM conexoes_google WHERE projeto_id = $1 AND revogado_em IS NULL`,
        [cenario.projetoId],
      );
      expect(agendadas.rowCount).toBe(0);
      const evento = captura.linhas().find((l) => l.acao === 'google_desconectado');
      expect(evento).toMatchObject({ categoria: 'auditoria', alvoId: cenario.projetoId });
    });

    it('apagar o projeto e encerrar a conta revogam o token junto ao Google', async () => {
      const apagado = await criarCenario();
      await conectar(apagado);
      const encerrada = await criarCenario();
      await conectar(encerrada);
      fonte.tokensRevogados.length = 0;

      const projeto = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/projetos/${apagado.projetoId}`,
        cookie: apagado.cookieDono,
        corpo: { nomeProjeto: 'Lojas' },
      });
      const conta = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: '/api/conta',
        cookie: encerrada.cookieDono,
        corpo: { senha: encerrada.dono.senha },
      });

      expect(projeto.statusCode).toBe(204);
      expect(conta.statusCode).toBe(204);
      expect(fonte.tokensRevogados).toHaveLength(2);
      for (const cenario of [apagado, encerrada]) {
        const restantes = await aplicacao.banco.query(
          'SELECT 1 FROM conexoes_google WHERE conta_id = $1',
          [cenario.dono.contaId],
        );
        expect(restantes.rowCount).toBe(0);
      }
    });
  });

  describe('isolamento entre contas', () => {
    it('outra conta não vê nem altera a conexão do projeto', async () => {
      const dono = await criarCenario();
      const intruso = await criarCenario();
      await conectar(dono);
      const base = `/api/projetos/${dono.projetoId}/google`;

      for (const chamada of [
        { metodo: 'GET' as const, url: base },
        { metodo: 'GET' as const, url: `${base}/unidades` },
        { metodo: 'POST' as const, url: `${base}/conectar` },
        { metodo: 'POST' as const, url: `${base}/sincronizar` },
        { metodo: 'DELETE' as const, url: base },
      ]) {
        const resposta = await chamar(aplicacao, { ...chamada, cookie: intruso.cookieDono });
        expect(resposta.statusCode, `${chamada.metodo} ${chamada.url}`).toBe(404);
      }
      const ativa = await aplicacao.banco.query(
        'SELECT 1 FROM conexoes_google WHERE projeto_id = $1 AND revogado_em IS NULL',
        [dono.projetoId],
      );
      expect(ativa.rowCount).toBe(1);
    });

    it('o banco recusa uma conexão cujo projeto é de outra conta', async () => {
      const a = await criarCenario();
      const b = await criarCenario();

      await expect(
        aplicacao.banco.query(
          `INSERT INTO conexoes_google (conta_id, projeto_id, email_conta_google,
                                        token_atualizacao_criptografado, escopos)
           VALUES ($1, $2, 'x@exemplo.com.br', 'v1:a:b:c', '{}')`,
          [a.dono.contaId, b.projetoId],
        ),
      ).rejects.toThrow();
    });
  });
});
