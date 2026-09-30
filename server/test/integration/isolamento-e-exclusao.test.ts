import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Banco } from '../../src/db/conexoes.js';
import { montarAppDeTeste, type AppDeTeste } from '../helpers/build-app.js';
import {
  criarContaDeTeste,
  criarProjetoDeTeste,
  criarRegistradorCapturado,
  criarUsuarioDeTeste,
  type UsuarioDeTeste,
} from '../helpers/factories.js';
import { chamar, entrar } from '../helpers/login.js';

interface ContaCompleta {
  dono: UsuarioDeTeste;
  membro: UsuarioDeTeste;
  cookieDono: string;
  cookieMembro: string;
  projetoId: string;
  nomeProjeto: string;
}

// Toda tabela de dados de cliente tem conta_id; as fases seguintes entram aqui sem mudar o teste.
async function contarLinhasDaConta(banco: Banco, contaId: string): Promise<Record<string, number>> {
  const tabelas = await banco.query<{ table_name: string }>(
    `SELECT DISTINCT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'conta_id'`,
  );
  const contagens: Record<string, number> = {};
  for (const { table_name: tabela } of tabelas.rows) {
    const resultado = await banco.query<{ total: string }>(
      `SELECT count(*) AS total FROM "${tabela}" WHERE conta_id = $1`,
      [contaId],
    );
    contagens[tabela] = Number(resultado.rows[0]?.total);
  }
  const contas = await banco.query('SELECT 1 FROM contas WHERE id = $1', [contaId]);
  contagens.contas = contas.rowCount ?? 0;
  const sessoes = await banco.query(
    'SELECT 1 FROM sessoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE conta_id = $1)',
    [contaId],
  );
  contagens.sessoes = sessoes.rowCount ?? 0;
  return contagens;
}

async function contarLinhasDoProjeto(banco: Banco, projetoId: string): Promise<number> {
  const tabelas = await banco.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND (
        (table_name = 'projetos' AND column_name = 'id') OR column_name = 'projeto_id')`,
  );
  let total = 0;
  for (const { table_name: tabela, column_name: coluna } of tabelas.rows) {
    const resultado = await banco.query<{ total: string }>(
      `SELECT count(*) AS total FROM "${tabela}" WHERE "${coluna}" = $1`,
      [projetoId],
    );
    total += Number(resultado.rows[0]?.total);
  }
  return total;
}

describe('isolamento entre contas e exclusão de dados', () => {
  let aplicacao: AppDeTeste;
  const captura = criarRegistradorCapturado();
  const passosExecutados: string[] = [];

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste({
      registrador: captura.registrador,
    });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function criarContaCompleta(nomeProjeto: string): Promise<ContaCompleta> {
    const contaId = await criarContaDeTeste(aplicacao.banco);
    const dono = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'owner' });
    const membro = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'member' });
    const projetoId = await criarProjetoDeTeste(aplicacao.banco, contaId, {
      nome: nomeProjeto,
      criadoPor: dono.id,
    });
    return {
      dono,
      membro,
      cookieDono: await entrar(aplicacao, dono.email),
      cookieMembro: await entrar(aplicacao, membro.email),
      projetoId,
      nomeProjeto,
    };
  }

  describe('isolamento', () => {
    it('nenhuma rota devolve nem altera dados da outra conta', async () => {
      const a = await criarContaCompleta('Projeto da A');
      const b = await criarContaCompleta('Projeto da B');

      const listagem = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/projetos',
        cookie: a.cookieDono,
      });
      const renomear = await chamar(aplicacao, {
        metodo: 'PATCH',
        url: `/api/projetos/${b.projetoId}`,
        cookie: a.cookieDono,
        corpo: { nome: 'Invadido' },
      });
      const apagar = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/projetos/${b.projetoId}`,
        cookie: a.cookieDono,
        corpo: { nomeProjeto: b.nomeProjeto },
      });
      const usuarios = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/usuarios',
        cookie: a.cookieDono,
      });
      const conta = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/conta',
        cookie: a.cookieDono,
      });

      const projetos = listagem.json<{ itens: { id: string }[]; total: number }>();
      expect(projetos.itens.map((p) => p.id)).toEqual([a.projetoId]);
      expect(projetos.total).toBe(1);
      expect(renomear.statusCode).toBe(404);
      expect(apagar.statusCode).toBe(404);
      const intacto = await aplicacao.banco.query<{ nome: string }>(
        'SELECT nome FROM projetos WHERE id = $1',
        [b.projetoId],
      );
      expect(intacto.rows[0]?.nome).toBe('Projeto da B');
      const emails = usuarios.json<{ itens: { email: string }[] }>().itens.map((u) => u.email);
      expect(emails).not.toContain(b.dono.email);
      expect(emails.sort()).toEqual([a.dono.email, a.membro.email].sort());
      expect(conta.json<{ id: string }>().id).toBe(a.dono.contaId);
    });

    it('nenhuma rota aceita conta_id no corpo nem na URL', async () => {
      const a = await criarContaCompleta('Projeto da A');
      const b = await criarContaCompleta('Projeto da B');

      const noCorpo = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/projetos',
        cookie: a.cookieDono,
        corpo: { nome: 'Novo', contaId: b.dono.contaId },
      });
      const naUrl = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos?contaId=${b.dono.contaId}`,
        cookie: a.cookieDono,
      });

      expect(noCorpo.statusCode).toBe(400);
      expect(naUrl.statusCode).toBe(400);
    });

    it('o convite de uma conta não aparece nem é revogado por outra', async () => {
      const a = await criarContaCompleta('Projeto da A');
      const b = await criarContaCompleta('Projeto da B');
      await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/convites',
        cookie: b.cookieDono,
        corpo: { email: `convite-${b.dono.id}@exemplo.com.br` },
      });
      const [convite] = (
        await chamar(aplicacao, { metodo: 'GET', url: '/api/convites', cookie: b.cookieDono })
      ).json<{ itens: { id: string }[] }>().itens;

      const revogar = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/convites/${convite?.id ?? ''}`,
        cookie: a.cookieDono,
      });

      expect(revogar.statusCode).toBe(404);
    });

    it('o banco recusa um token de autenticação apontando para usuário de outra conta', async () => {
      const contaA = await criarContaDeTeste(aplicacao.banco);
      const contaB = await criarContaDeTeste(aplicacao.banco);
      const usuarioB = await criarUsuarioDeTeste(aplicacao.banco, contaB);

      const gravacaoCruzada = aplicacao.banco.query(
        `INSERT INTO tokens_autenticacao (conta_id, usuario_id, tipo, email, hash_token, expira_em)
         VALUES ($1, $2, 'password_reset', 'x@exemplo.com.br', 'hash-cruzado', now() + interval '1 hour')`,
        [contaA, usuarioB.id],
      );

      await expect(gravacaoCruzada).rejects.toThrow(/foreign key/i);
    });

    it('o e-mail é único no sistema, sem diferenciar maiúsculas', async () => {
      const contaA = await criarContaDeTeste(aplicacao.banco);
      const contaB = await criarContaDeTeste(aplicacao.banco);
      await criarUsuarioDeTeste(aplicacao.banco, contaA, { email: 'Unico@Exemplo.com.br' });

      const duplicado = criarUsuarioDeTeste(aplicacao.banco, contaB, {
        email: 'unico@exemplo.com.br',
      });

      await expect(duplicado).rejects.toThrow(/usuarios_email_unico/);
    });
  });

  describe('projetos', () => {
    it('member cria e renomeia projetos, mas não apaga', async () => {
      const conta = await criarContaCompleta('Projeto');

      const criar = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/projetos',
        cookie: conta.cookieMembro,
        corpo: { nome: '  Feito pelo membro  ' },
      });
      const { id } = criar.json<{ id: string }>();
      const renomear = await chamar(aplicacao, {
        metodo: 'PATCH',
        url: `/api/projetos/${id}`,
        cookie: conta.cookieMembro,
        corpo: { nome: 'Renomeado' },
      });
      const apagar = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/projetos/${id}`,
        cookie: conta.cookieMembro,
        corpo: { nomeProjeto: 'Renomeado' },
      });

      expect(criar.statusCode).toBe(201);
      expect(criar.json()).toMatchObject({ nome: 'Feito pelo membro' });
      expect(renomear.json()).toMatchObject({ nome: 'Renomeado' });
      expect(apagar.statusCode).toBe(403);
    });

    it('lista com paginação e recusa tamanho de página acima de 100', async () => {
      const conta = await criarContaCompleta('Projeto 1');
      await criarProjetoDeTeste(aplicacao.banco, conta.dono.contaId, { nome: 'Projeto 2' });
      await criarProjetoDeTeste(aplicacao.banco, conta.dono.contaId, { nome: 'Projeto 3' });

      const pagina = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/projetos?pagina=2&tamanhoPagina=2',
        cookie: conta.cookieDono,
      });
      const enorme = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/projetos?tamanhoPagina=101',
        cookie: conta.cookieDono,
      });

      expect(pagina.json()).toMatchObject({ total: 3, pagina: 2, tamanhoPagina: 2 });
      expect(pagina.json<{ itens: unknown[] }>().itens).toHaveLength(1);
      expect(enorme.statusCode).toBe(400);
    });

    it('recusa nome vazio', async () => {
      const conta = await criarContaCompleta('Projeto');

      const resposta = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/projetos',
        cookie: conta.cookieDono,
        corpo: { nome: '   ' },
      });

      expect(resposta.statusCode).toBe(400);
    });
  });

  describe('apagar projeto', () => {
    it('exige o nome exato e remove tudo do projeto, sem tocar no resto da conta', async () => {
      const conta = await criarContaCompleta('Projeto para apagar');
      const outro = await criarProjetoDeTeste(aplicacao.banco, conta.dono.contaId, {
        nome: 'Projeto que fica',
      });

      const nomeErrado = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/projetos/${conta.projetoId}`,
        cookie: conta.cookieDono,
        corpo: { nomeProjeto: 'projeto para apagar' },
      });
      const correto = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/projetos/${conta.projetoId}`,
        cookie: conta.cookieDono,
        corpo: { nomeProjeto: 'Projeto para apagar' },
      });

      expect(nomeErrado.statusCode).toBe(400);
      expect(nomeErrado.json<{ erro: { codigo: string } }>().erro.codigo).toBe(
        'confirmacao_invalida',
      );
      expect(correto.statusCode).toBe(204);
      expect(await contarLinhasDoProjeto(aplicacao.banco, conta.projetoId)).toBe(0);
      expect(await contarLinhasDoProjeto(aplicacao.banco, outro)).toBe(1);
      const evento = captura.linhas().find((l) => l.acao === 'projeto_apagado');
      expect(evento).toMatchObject({ categoria: 'auditoria', alvoId: conta.projetoId });
    });
  });

  describe('encerrar conta', () => {
    it('member recebe 403 e senha errada recusa, sem apagar nada', async () => {
      const conta = await criarContaCompleta('Projeto');

      const membro = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: '/api/conta',
        cookie: conta.cookieMembro,
        corpo: { senha: conta.membro.senha },
      });
      const errada = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: '/api/conta',
        cookie: conta.cookieDono,
        corpo: { senha: 'senha-errada-123' },
      });

      expect(membro.statusCode).toBe(403);
      expect(errada.statusCode).toBe(403);
      expect((await contarLinhasDaConta(aplicacao.banco, conta.dono.contaId)).contas).toBe(1);
    });

    it('apaga todos os dados da conta, encerra as sessões e preserva as outras contas', async () => {
      const alvo = await criarContaCompleta('Projeto do alvo');
      const vizinha = await criarContaCompleta('Projeto da vizinha');
      await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/convites',
        cookie: alvo.cookieDono,
        corpo: { email: `pendente-${alvo.dono.id}@exemplo.com.br` },
      });
      const antes = await contarLinhasDaConta(aplicacao.banco, alvo.dono.contaId);
      const vizinhaAntes = await contarLinhasDaConta(aplicacao.banco, vizinha.dono.contaId);

      const resposta = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: '/api/conta',
        cookie: alvo.cookieDono,
        corpo: { senha: alvo.dono.senha },
      });

      expect(antes.usuarios).toBe(2);
      expect(antes.projetos).toBe(1);
      expect(antes.tokens_autenticacao).toBe(1);
      expect(resposta.statusCode).toBe(204);
      const depois = await contarLinhasDaConta(aplicacao.banco, alvo.dono.contaId);
      expect(Object.values(depois).every((total) => total === 0)).toBe(true);
      expect(await contarLinhasDaConta(aplicacao.banco, vizinha.dono.contaId)).toEqual(
        vizinhaAntes,
      );
      const semSessao = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/auth/eu',
        cookie: alvo.cookieMembro,
      });
      expect(semSessao.statusCode).toBe(401);
      const evento = captura.linhas().find((l) => l.acao === 'conta_encerrada');
      expect(evento).toMatchObject({ categoria: 'auditoria', contaId: alvo.dono.contaId });
    });
  });

  describe('ponto de extensão da exclusão', () => {
    it('roda os passos registrados antes de apagar a conta', async () => {
      const comPasso = await montarAppDeTeste({
        prepararBanco: false,
        passosAntesDeEncerrarConta: [
          (contaId) => {
            passosExecutados.push(contaId);
            return Promise.resolve();
          },
        ],
      });
      const contaId = await criarContaDeTeste(comPasso.banco);
      const dono = await criarUsuarioDeTeste(comPasso.banco, contaId);
      const cookie = await entrar(comPasso, dono.email);

      await chamar(comPasso, {
        metodo: 'DELETE',
        url: '/api/conta',
        cookie,
        corpo: { senha: dono.senha },
      });
      await comPasso.encerrar();

      expect(passosExecutados).toEqual([contaId]);
    });
  });
});
