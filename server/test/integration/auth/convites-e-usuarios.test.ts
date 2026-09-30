import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Relogio } from '../../../src/shared/clock.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarContaComDonoDeTeste,
  criarEnviadorEmMemoria,
  criarProjetoDeTeste,
  criarRegistradorCapturado,
  criarUsuarioDeTeste,
  type EnviadorEmMemoria,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

const INICIO = new Date('2026-07-01T10:00:00.000Z');
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

interface Convite {
  id: string;
  email: string;
  papel: string;
}

describe('convites e usuários', () => {
  let aplicacao: AppDeTeste;
  let enviador: EnviadorEmMemoria;
  let agora: Date;
  const relogio: Relogio = { agora: () => new Date(agora) };
  const captura = criarRegistradorCapturado();

  beforeAll(async () => {
    enviador = criarEnviadorEmMemoria();
    agora = new Date(INICIO);
    aplicacao = await montarAppDeTeste({
      enviadorDeEmail: enviador,
      relogio,
      registrador: captura.registrador,
    });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function prepararDonoLogado() {
    const dono = await criarContaComDonoDeTeste(aplicacao.banco);
    return { dono, cookie: await entrar(aplicacao, dono.email) };
  }

  function convidar(cookie: string, email: string, papel?: string) {
    return chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/convites',
      cookie,
      corpo: papel === undefined ? { email } : { email, papel },
    });
  }

  function aceitar(token: string, sobrescritas: Record<string, unknown> = {}) {
    return chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/aceitar-convite',
      corpo: {
        token,
        nome: 'Convidado',
        senha: 'senha-do-convidado-1',
        aceiteTermos: true,
        ...sobrescritas,
      },
    });
  }

  async function listarConvites(cookie: string): Promise<Convite[]> {
    const resposta = await chamar(aplicacao, { metodo: 'GET', url: '/api/convites', cookie });
    return resposta.json<{ itens: Convite[] }>().itens;
  }

  describe('convites', () => {
    it('o owner convida, o convidado aceita os termos, entra na mesma conta e o aceite é gravado', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const email = `convidado-${dono.id}@exemplo.com.br`;

      const resposta = await convidar(cookie, email);
      const token = enviador.tokenDaUltimaMensagem(email);
      const aceite = await aceitar(token);

      expect(resposta.statusCode).toBe(202);
      expect(aceite.statusCode).toBe(204);
      const linha = await aplicacao.banco.query<{
        conta_id: string;
        papel: string;
        versao_termos: string;
        termos_aceitos_em: Date;
        email_confirmado_em: Date | null;
      }>(
        `SELECT conta_id, papel, versao_termos, termos_aceitos_em, email_confirmado_em
           FROM usuarios WHERE email = $1`,
        [email],
      );
      expect(linha.rows[0]).toMatchObject({
        conta_id: dono.contaId,
        papel: 'member',
        versao_termos: aplicacao.configuracao.versaoTermos,
        termos_aceitos_em: INICIO,
        email_confirmado_em: INICIO,
      });
      await expect(entrar(aplicacao, email, 'senha-do-convidado-1')).resolves.toBeTypeOf('string');
    });

    it('o convite não é aceito sem o aceite dos termos', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const email = `sem-termos-${dono.id}@exemplo.com.br`;
      await convidar(cookie, email);

      const resposta = await aceitar(enviador.tokenDaUltimaMensagem(email), {
        aceiteTermos: false,
      });

      expect(resposta.statusCode).toBe(400);
    });

    it('o link só vale uma vez e expira em 7 dias', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const primeiro = `uma-vez-${dono.id}@exemplo.com.br`;
      const segundo = `expira-${dono.id}@exemplo.com.br`;
      await convidar(cookie, primeiro);
      await convidar(cookie, segundo);
      const tokenUsado = enviador.tokenDaUltimaMensagem(primeiro);
      const tokenExpirado = enviador.tokenDaUltimaMensagem(segundo);

      await aceitar(tokenUsado);
      const repetido = await aceitar(tokenUsado);
      agora = new Date(INICIO.getTime() + SETE_DIAS_MS + 1000);
      const expirado = await aceitar(tokenExpirado);
      agora = new Date(INICIO);

      expect(repetido.statusCode).toBe(400);
      expect(expirado.statusCode).toBe(400);
    });

    it('lista os pendentes e a revogação invalida o link', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const email = `revogado-${dono.id}@exemplo.com.br`;
      await convidar(cookie, email, 'owner');
      const token = enviador.tokenDaUltimaMensagem(email);

      const pendentes = await listarConvites(cookie);
      const revogacao = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/convites/${pendentes[0]?.id ?? ''}`,
        cookie,
      });
      const aceite = await aceitar(token);

      expect(pendentes).toEqual([expect.objectContaining({ email, papel: 'owner' })]);
      expect(revogacao.statusCode).toBe(204);
      expect(aceite.statusCode).toBe(400);
      expect(await listarConvites(cookie)).toEqual([]);
    });

    it('um novo convite ao mesmo e-mail invalida o anterior', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const email = `repetido-${dono.id}@exemplo.com.br`;
      await convidar(cookie, email);
      const antigo = enviador.tokenDaUltimaMensagem(email);
      await convidar(cookie, email);

      const comAntigo = await aceitar(antigo);

      expect(comAntigo.statusCode).toBe(400);
      expect(await listarConvites(cookie)).toHaveLength(1);
    });

    it('convite para e-mail já existente responde igual, avisa o endereço e não cria token', async () => {
      const { cookie } = await prepararDonoLogado();
      const existente = await criarContaComDonoDeTeste(aplicacao.banco);

      const novo = await convidar(cookie, `livre-${existente.id}@exemplo.com.br`);
      const repetido = await convidar(cookie, existente.email);

      expect(repetido.statusCode).toBe(novo.statusCode);
      expect(repetido.json()).toEqual(novo.json());
      const aviso = enviador.paraEndereco(existente.email).at(-1);
      expect(aviso?.assunto).toContain('Já existe uma conta');
      expect(aviso?.texto).not.toContain('token=');
      expect(await listarConvites(cookie)).toHaveLength(1);
    });

    it('a resposta do convite não revela o convite pendente de outra conta', async () => {
      const { cookie: cookieA } = await prepararDonoLogado();
      const { cookie: cookieB } = await prepararDonoLogado();
      await convidar(cookieA, 'compartilhado@exemplo.com.br');

      expect(await listarConvites(cookieB)).toEqual([]);
    });

    it('member recebe 403 em convidar, listar e revogar convites', async () => {
      const { dono } = await prepararDonoLogado();
      const membro = await criarUsuarioDeTeste(aplicacao.banco, dono.contaId, { papel: 'member' });
      const cookie = await entrar(aplicacao, membro.email);

      const respostas = await Promise.all([
        convidar(cookie, 'x@exemplo.com.br'),
        chamar(aplicacao, { metodo: 'GET', url: '/api/convites', cookie }),
        chamar(aplicacao, {
          metodo: 'DELETE',
          url: `/api/convites/${dono.id}`,
          cookie,
        }),
      ]);

      expect(respostas.map((r) => r.statusCode)).toEqual([403, 403, 403]);
      expect(respostas[0].json<{ erro: { codigo: string } }>().erro.codigo).toBe('apenas_owner');
    });

    it('registra auditoria de convite e revogação só com ids', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const email = `auditoria-${dono.id}@exemplo.com.br`;
      await convidar(cookie, email);
      const [convite] = await listarConvites(cookie);
      await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/convites/${convite?.id ?? ''}`,
        cookie,
      });

      const eventos = captura
        .linhas()
        .filter((linha) => linha.contaId === dono.contaId && linha.categoria === 'auditoria')
        .filter((linha) => String(linha.acao).startsWith('convite'));

      expect(eventos.map((linha) => linha.acao)).toEqual(['convite_criado', 'convite_revogado']);
      expect(JSON.stringify(eventos)).not.toContain(email);
    });
  });

  describe('usuários', () => {
    it('o owner lista os usuários da própria conta', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const membro = await criarUsuarioDeTeste(aplicacao.banco, dono.contaId, { papel: 'member' });

      const resposta = await chamar(aplicacao, { metodo: 'GET', url: '/api/usuarios', cookie });

      const emails = resposta.json<{ itens: { email: string }[] }>().itens.map((u) => u.email);
      expect(emails.sort()).toEqual([dono.email, membro.email].sort());
    });

    it('member recebe 403 ao listar e ao remover usuários', async () => {
      const { dono } = await prepararDonoLogado();
      const membro = await criarUsuarioDeTeste(aplicacao.banco, dono.contaId, { papel: 'member' });
      const cookie = await entrar(aplicacao, membro.email);

      const listar = await chamar(aplicacao, { metodo: 'GET', url: '/api/usuarios', cookie });
      const remover = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/usuarios/${dono.id}`,
        cookie,
      });

      expect(listar.statusCode).toBe(403);
      expect(remover.statusCode).toBe(403);
    });

    it('remover encerra as sessões do usuário e mantém os dados que ele criou', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const membro = await criarUsuarioDeTeste(aplicacao.banco, dono.contaId, { papel: 'member' });
      const sessaoDoMembro = await entrar(aplicacao, membro.email);
      const projetoId = await criarProjetoDeTeste(aplicacao.banco, dono.contaId, {
        criadoPor: membro.id,
      });

      const resposta = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/usuarios/${membro.id}`,
        cookie,
      });
      const semSessao = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/api/auth/eu',
        cookie: sessaoDoMembro,
      });

      expect(resposta.statusCode).toBe(204);
      expect(semSessao.statusCode).toBe(401);
      const projeto = await aplicacao.banco.query<{ criado_por: string | null }>(
        'SELECT criado_por FROM projetos WHERE id = $1',
        [projetoId],
      );
      expect(projeto.rows[0]).toEqual({ criado_por: null });
    });

    it('o owner não remove a si mesmo nem o último owner', async () => {
      const { dono, cookie } = await prepararDonoLogado();

      const aSiMesmo = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/usuarios/${dono.id}`,
        cookie,
      });

      expect(aSiMesmo.statusCode).toBe(409);
      expect(aSiMesmo.json<{ erro: { codigo: string } }>().erro.codigo).toBe('remocao_propria');
    });

    it('um owner pode remover outro owner enquanto sobra ao menos um', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const outroDono = await criarUsuarioDeTeste(aplicacao.banco, dono.contaId, {
        papel: 'owner',
      });

      const resposta = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/usuarios/${outroDono.id}`,
        cookie,
      });

      expect(resposta.statusCode).toBe(204);
    });

    it('não remove usuário de outra conta', async () => {
      const { cookie } = await prepararDonoLogado();
      const estranho = await criarContaComDonoDeTeste(aplicacao.banco);

      const resposta = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: `/api/usuarios/${estranho.id}`,
        cookie,
      });

      expect(resposta.statusCode).toBe(404);
      const ainda = await aplicacao.banco.query('SELECT 1 FROM usuarios WHERE id = $1', [
        estranho.id,
      ]);
      expect(ainda.rowCount).toBe(1);
    });

    it('registra a auditoria da remoção', async () => {
      const { dono, cookie } = await prepararDonoLogado();
      const membro = await criarUsuarioDeTeste(aplicacao.banco, dono.contaId, { papel: 'member' });
      await chamar(aplicacao, { metodo: 'DELETE', url: `/api/usuarios/${membro.id}`, cookie });

      const eventos = captura.linhas().filter((linha) => linha.acao === 'usuario_removido');

      expect(eventos.at(-1)).toMatchObject({
        categoria: 'auditoria',
        contaId: dono.contaId,
        usuarioId: dono.id,
        alvoId: membro.id,
      });
    });
  });
});
