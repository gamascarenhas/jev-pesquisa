import { mkdir, readdir, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { comoContaId } from '../../../src/shared/ids.js';
import { aguardarAte } from '../../helpers/aguardar.js';
import {
  codificarCsvWindows1252,
  criarXlsx,
  criarZipComTamanhos,
  montarMultipart,
} from '../../helpers/arquivos.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  CABECALHO,
  MAPEAMENTO_PADRAO,
  linhasDeComentario,
  type Previa,
} from '../../helpers/envios.js';
import {
  criarContaDeTeste,
  criarProjetoDeTeste,
  criarUsuarioDeTeste,
  gerarUuid,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

interface Importacao {
  total: number;
  processadas: number;
  importados: number;
  ignorados: number;
  duplicados: number;
  concluida: boolean;
}

describe('envios e importação', () => {
  let aplicacao: AppDeTeste;
  let contaId: ReturnType<typeof comoContaId>;
  let cookie: string;
  let projetoId: string;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste({ ajustesDoExecutor: { intervaloConsultaMs: 20 } });
    const conta = await criarContaDeTeste(aplicacao.banco);
    contaId = conta;
    const usuario = await criarUsuarioDeTeste(aplicacao.banco, conta);
    cookie = await entrar(aplicacao, usuario.email);
    projetoId = await criarProjetoDeTeste(aplicacao.banco, conta, { criadoPor: usuario.id });
    await aplicacao.executorDeTrabalhos.iniciar();
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function enviar(
    nome: string,
    conteudo: Buffer,
    sessao = cookie,
    projeto = projetoId,
    app = aplicacao,
  ) {
    const { corpo, cabecalhos } = montarMultipart(nome, conteudo);
    return chamar(app, {
      metodo: 'POST',
      url: `/api/projetos/${projeto}/envios`,
      cookie: sessao,
      corpoBruto: corpo,
      cabecalhos,
    });
  }

  async function confirmar(
    envioId: string,
    corpo: unknown,
    sessao = cookie,
    projeto = projetoId,
    app = aplicacao,
  ) {
    return chamar(app, {
      metodo: 'POST',
      url: `/api/projetos/${projeto}/envios/${envioId}/confirmar`,
      cookie: sessao,
      corpo,
    });
  }

  async function importarCsv(conteudo: Buffer, mapeamento = MAPEAMENTO_PADRAO) {
    const envio = await enviar('avaliacoes.csv', conteudo);
    const { envioId } = envio.json<Previa>();
    const confirmacao = await confirmar(envioId, { mapeamento, nomeArquivo: 'avaliacoes.csv' });
    const { trabalhoId, fonteId } = confirmacao.json<{ trabalhoId: string; fonteId: string }>();
    await aguardarAte(async () => {
      const job = await aplicacao.banco.query<{ status: string }>(
        'SELECT status FROM trabalhos WHERE id = $1',
        [trabalhoId],
      );
      return job.rows[0]?.status === 'done';
    });
    const fonte = await chamar(aplicacao, {
      metodo: 'GET',
      url: `/api/projetos/${projetoId}/fontes/${fonteId}`,
      cookie,
    });
    return {
      envioId,
      trabalhoId,
      fonteId,
      resumo: fonte.json<{ importacao: Importacao }>().importacao,
    };
  }

  async function contarComentarios(): Promise<number> {
    const resultado = await aplicacao.banco.query<{ total: string }>(
      'SELECT count(*) AS total FROM comentarios WHERE projeto_id = $1',
      [projetoId],
    );
    return Number(resultado.rows[0]?.total);
  }

  async function limparProjeto(): Promise<void> {
    await aplicacao.banco.query('DELETE FROM comentarios WHERE projeto_id = $1', [projetoId]);
  }

  describe('fluxo de CSV brasileiro', () => {
    const csv = codificarCsvWindows1252(
      CABECALHO +
        [
          '01/02/2024;Ana;Ótimo atendimento, falem com ana@exemplo.com.br;5;Centro',
          ...Array.from(
            { length: 9 },
            (_v, i) =>
              `0${String(i + 2)}/02/2024;Cliente ${String(i)};Comentário ${String(i)} razoável;4;Centro`,
          ),
          '12/02/2024;Bia;;3;Centro',
          '13/02/2024;Caio;ok;3;Centro',
          '01/02/2024;Ana;Ótimo atendimento, falem com ana@exemplo.com.br;5;Centro',
        ].join('\n'),
    );

    it('devolve prévia de 10 linhas, sugere o mapeamento e guarda o arquivo com nome gerado', async () => {
      await limparProjeto();

      const resposta = await enviar('Planilha do Cliente.csv', csv);

      expect(resposta.statusCode).toBe(201);
      const previa = resposta.json<Previa>();
      expect(previa.tipo).toBe('csv');
      expect(previa.cabecalho).toEqual(['Data', 'Cliente', 'Comentário', 'Nota', 'Loja']);
      expect(previa.linhas).toHaveLength(10);
      expect(previa.linhas[0]?.[2]).toBe('Ótimo atendimento, falem com ana@exemplo.com.br');
      expect(previa.totalLinhas).toBe(13);
      expect(previa.sugestao).toEqual({ data: 0, autor: 1, comentario: 2, nota: 3, unidade: 4 });
      expect(previa.envioId).toMatch(/^[0-9a-f-]{36}\.csv$/);
      expect(await readdir(join(aplicacao.diretorioDeEnvios, contaId))).toEqual([previa.envioId]);
    });

    it('importa, conta importados, ignorados e duplicados, e apaga o arquivo', async () => {
      await limparProjeto();

      const { envioId, resumo } = await importarCsv(csv);

      expect(resumo).toEqual({
        total: 13,
        processadas: 13,
        importados: 10,
        ignorados: 2,
        duplicados: 1,
        concluida: true,
      });
      expect(await contarComentarios()).toBe(10);
      const existe = await readdir(join(aplicacao.diretorioDeEnvios, contaId));
      expect(existe).not.toContain(envioId);
    });

    it('grava texto mascarado, mantém o original e deixa o comentário pendente', async () => {
      const comentario = await aplicacao.banco.query<{
        texto_original: string;
        texto_mascarado: string;
        status_classificacao: string;
        nota: number;
        nome_unidade: string;
        nome_autor: string;
        comentado_em: Date;
      }>("SELECT * FROM comentarios WHERE projeto_id = $1 AND nome_autor = 'Ana'", [projetoId]);

      expect(comentario.rows).toHaveLength(1);
      expect(comentario.rows[0]).toMatchObject({
        texto_original: 'Ótimo atendimento, falem com ana@exemplo.com.br',
        texto_mascarado: 'Ótimo atendimento, falem com [EMAIL]',
        status_classificacao: 'pending',
        nota: 5,
        nome_unidade: 'Centro',
      });
      expect(comentario.rows[0]?.comentado_em.toISOString()).toBe('2024-02-01T03:00:00.000Z');
    });

    it('reimportar o mesmo arquivo não cria nenhum comentário novo', async () => {
      const antes = await contarComentarios();

      const { resumo } = await importarCsv(csv);

      expect(resumo).toMatchObject({ importados: 0, ignorados: 2, duplicados: 11 });
      expect(await contarComentarios()).toBe(antes);
    });

    it('comentários iguais com datas, unidades ou autores diferentes não colapsam', async () => {
      await limparProjeto();
      const igual = (data: string, autor: string, loja: string) =>
        `${data};${autor};Mesmo texto de comentário;5;${loja}`;

      const { resumo } = await importarCsv(
        codificarCsvWindows1252(
          CABECALHO +
            [
              igual('01/02/2024', 'Ana', 'A'),
              igual('02/02/2024', 'Ana', 'A'),
              igual('01/02/2024', 'Bia', 'A'),
              igual('01/02/2024', 'Ana', 'B'),
              igual('01/02/2024', 'Ana', 'A'),
            ].join('\n'),
        ),
      );

      expect(resumo).toMatchObject({ importados: 4, duplicados: 1 });
    });
  });

  describe('fluxo de Excel', () => {
    it('lista as abas, mostra a prévia da outra aba e importa datas seriais e do Excel', async () => {
      await limparProjeto();
      const xlsx = await criarXlsx([
        { nome: 'Leia-me', linhas: [['instruções'], ['nada aqui']] },
        {
          nome: 'Avaliações',
          linhas: [
            ['Data', 'Cliente', 'Comentário', 'Nota', 'Loja'],
            [new Date(Date.UTC(2024, 0, 2)), 'Ana', 'Gostei muito do atendimento', 5, 'Centro'],
            [45294, 'Bia', 'Demorou demais para atender', 2, 'Norte'],
          ],
        },
      ]);

      const envio = await enviar('relatorio.xlsx', xlsx);
      const { envioId, abas, aba } = envio.json<Previa>();
      const outra = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${projetoId}/envios/${envioId}/previa?aba=${encodeURIComponent('Avaliações')}`,
        cookie,
      });
      const confirmacao = await confirmar(envioId, {
        aba: 'Avaliações',
        mapeamento: MAPEAMENTO_PADRAO,
      });
      await aguardarAte(async () => (await contarComentarios()) === 2);

      expect(abas).toEqual(['Leia-me', 'Avaliações']);
      expect(aba).toBe('Leia-me');
      expect(outra.json<Previa>()).toMatchObject({ aba: 'Avaliações', totalLinhas: 2 });
      expect(outra.json<Previa>().linhas[0]?.[0]).toBe('02/01/2024');
      expect(confirmacao.statusCode).toBe(202);
      const datas = await aplicacao.banco.query<{ comentado_em: Date }>(
        'SELECT comentado_em FROM comentarios WHERE projeto_id = $1 ORDER BY comentado_em',
        [projetoId],
      );
      expect(datas.rows.map((linha) => linha.comentado_em.toISOString())).toEqual([
        '2024-01-02T03:00:00.000Z',
        '2024-01-03T03:00:00.000Z',
      ]);
    });

    it('recusa aba que não existe', async () => {
      const xlsx = await criarXlsx([{ nome: 'Única', linhas: [['comentario'], ['texto bom']] }]);
      const { envioId } = (await enviar('a.xlsx', xlsx)).json<Previa>();

      const resposta = await confirmar(envioId, { aba: 'Outra', mapeamento: { comentario: 0 } });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json<{ erro: { codigo: string } }>().erro.codigo).toBe('aba_nao_encontrada');
    });
  });

  describe('validação do envio', () => {
    async function arquivosDaConta(): Promise<string[]> {
      return readdir(join(aplicacao.diretorioDeEnvios, contaId)).catch(() => []);
    }

    async function esperarRejeicao(nome: string, conteudo: Buffer, status: number, codigo: string) {
      const antes = await arquivosDaConta();

      const resposta = await enviar(nome, conteudo);

      expect(resposta.statusCode).toBe(status);
      expect(resposta.json<{ erro: { codigo: string } }>().erro.codigo).toBe(codigo);
      expect(await arquivosDaConta()).toEqual(antes);
      return resposta.json<{ erro: { mensagem: string } }>().erro.mensagem;
    }

    it('rejeita .xls com a orientação de salvar como .xlsx', async () => {
      const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0]);

      const mensagem = await esperarRejeicao('antigo.xls', ole, 400, 'formato_xls_nao_suportado');

      expect(mensagem).toContain('salve como .xlsx');
    });

    it('rejeita .xlsx que não é ZIP e CSV com bytes nulos, apagando o arquivo', async () => {
      await esperarRejeicao('falso.xlsx', Buffer.from('a;b\n1;2\n'), 400, 'arquivo_invalido');
      await esperarRejeicao('nulo.csv', Buffer.from('a;b\0\n1;2\n'), 400, 'arquivo_invalido');
      await esperarRejeicao('sem-extensao', Buffer.from('a;b\n'), 400, 'arquivo_invalido');
    });

    it('rejeita o ZIP que descompacta acima do limite', async () => {
      const bomba = criarZipComTamanhos([
        { nome: 'xl/workbook.xml', descompactado: 250 * 1024 * 1024 },
      ]);

      await esperarRejeicao('bomba.xlsx', bomba, 400, 'arquivo_descompactado_grande');
    });

    it('rejeita arquivo acima de 20 MB', async () => {
      const enorme = Buffer.alloc(20 * 1024 * 1024 + 1, 'a');

      await esperarRejeicao('grande.csv', enorme, 413, 'arquivo_muito_grande');
    });

    it('rejeita mais de 50.000 linhas e aceita exatamente 50.000', async () => {
      const acima = Buffer.from('comentario\n' + 'texto de comentário\n'.repeat(50_001));
      const noLimite = Buffer.from('comentario\n' + 'texto de comentário\n'.repeat(50_000));

      await esperarRejeicao('muitas.csv', acima, 400, 'limite_de_linhas');
      const aceito = await enviar('limite.csv', noLimite);

      expect(aceito.statusCode).toBe(201);
      expect(aceito.json<Previa>().totalLinhas).toBe(50_000);
    });

    it('rejeita requisição sem arquivo e exige sessão', async () => {
      const semArquivo = await chamar(aplicacao, {
        metodo: 'POST',
        url: `/api/projetos/${projetoId}/envios`,
        cookie,
        corpoBruto: Buffer.from(''),
        cabecalhos: { 'content-type': 'multipart/form-data; boundary=x' },
      });
      const { corpo, cabecalhos } = montarMultipart('a.csv', Buffer.from('a\n'));
      const anonimo = await chamar(aplicacao, {
        metodo: 'POST',
        url: `/api/projetos/${projetoId}/envios`,
        corpoBruto: corpo,
        cabecalhos,
      });

      expect(semArquivo.statusCode).toBeGreaterThanOrEqual(400);
      expect(anonimo.statusCode).toBe(401);
    });
  });

  describe('confirmação do mapeamento', () => {
    it('exige a coluna do comentário e recusa a mesma coluna em dois usos', async () => {
      const { envioId } = (
        await enviar('a.csv', Buffer.from(CABECALHO + linhasDeComentario(2)))
      ).json<Previa>();

      const semComentario = await confirmar(envioId, { mapeamento: { data: 0 } });
      const repetida = await confirmar(envioId, { mapeamento: { comentario: 2, nota: 2 } });

      expect(semComentario.statusCode).toBe(400);
      expect(repetida.statusCode).toBe(400);
      expect(repetida.json<{ erro: { codigo: string } }>().erro.codigo).toBe('mapeamento_invalido');
    });

    it('não aceita conta_id nem campos extras', async () => {
      const { envioId } = (
        await enviar('a.csv', Buffer.from(CABECALHO + linhasDeComentario(2)))
      ).json<Previa>();

      const resposta = await confirmar(envioId, {
        mapeamento: { comentario: 2 },
        contaId: gerarUuid(),
      });

      expect(resposta.statusCode).toBe(400);
    });
  });

  describe('isolamento', () => {
    it('outra conta não vê a prévia, nem confirma, nem lê a fonte de um envio', async () => {
      const envio = (
        await enviar('a.csv', Buffer.from(CABECALHO + linhasDeComentario(2)))
      ).json<Previa>();
      const contaB = await criarContaDeTeste(aplicacao.banco);
      const usuarioB = await criarUsuarioDeTeste(aplicacao.banco, contaB);
      const projetoB = await criarProjetoDeTeste(aplicacao.banco, contaB);
      const cookieB = await entrar(aplicacao, usuarioB.email);
      const url = `/api/projetos/${projetoB}/envios/${envio.envioId}`;

      const previa = await chamar(aplicacao, {
        metodo: 'GET',
        url: `${url}/previa`,
        cookie: cookieB,
      });
      const confirmacao = await confirmar(
        envio.envioId,
        { mapeamento: { comentario: 2 } },
        cookieB,
        projetoB,
      );
      const projetoDeA = await enviar('a.csv', Buffer.from(CABECALHO), cookieB, projetoId);
      const fonte = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${projetoB}/fontes/${gerarUuid()}`,
        cookie: cookieB,
      });

      expect(previa.statusCode).toBe(404);
      expect(confirmacao.statusCode).toBe(404);
      expect(projetoDeA.statusCode).toBe(404);
      expect(fonte.statusCode).toBe(404);
      const intacto = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${projetoId}/envios/${envio.envioId}/previa`,
        cookie,
      });
      expect(intacto.statusCode).toBe(200);
    });

    it('recusa identificador de envio com caminho', async () => {
      const resposta = await chamar(aplicacao, {
        metodo: 'GET',
        url: `/api/projetos/${projetoId}/envios/..%2F..%2Fsegredo.csv/previa`,
        cookie,
      });

      expect(resposta.statusCode).toBe(400);
    });
  });

  describe('limpeza de órfãos e encerramento de conta', () => {
    const DOIS_DIAS_EM_SEGUNDOS = 2 * 24 * 60 * 60;

    async function criarArquivo(app: AppDeTeste, conta: string, antigo: boolean): Promise<string> {
      const envioId = `${gerarUuid()}.csv`;
      const pasta = join(app.diretorioDeEnvios, conta);
      await mkdir(pasta, { recursive: true });
      await writeFile(join(pasta, envioId), 'comentario\ntexto\n');
      if (antigo) {
        const passado = new Date(Date.now() - DOIS_DIAS_EM_SEGUNDOS * 1000);
        await utimes(join(pasta, envioId), passado, passado);
      }
      return envioId;
    }

    it('apaga na inicialização só os arquivos com mais de 24 horas sem job ativo', async () => {
      const app = await montarAppDeTeste();
      const conta = await criarContaDeTeste(app.banco);
      const projeto = await criarProjetoDeTeste(app.banco, conta);
      await criarArquivo(app, conta, true);
      const emUso = await criarArquivo(app, conta, true);
      const recente = await criarArquivo(app, conta, false);
      await app.banco.query(
        `INSERT INTO trabalhos (conta_id, projeto_id, tipo, status, carga)
         VALUES ($1, $2, 'import_upload', 'paused_limit', $3)`,
        [conta, projeto, JSON.stringify({ envioId: emUso })],
      );
      const outraConta = comoContaId(gerarUuid());
      const deOutraConta = await criarArquivo(app, outraConta, true);

      await app.executorDeTrabalhos.iniciar();
      await app.executorDeTrabalhos.parar();

      expect((await readdir(join(app.diretorioDeEnvios, conta))).sort()).toEqual(
        [emUso, recente].sort(),
      );
      expect(await readdir(join(app.diretorioDeEnvios, outraConta))).not.toContain(deOutraConta);
      await app.encerrar();
    });

    it('encerrar a conta apaga os arquivos que ela deixou no disco', async () => {
      const contaDoUsuario = await criarContaDeTeste(aplicacao.banco);
      const dono = await criarUsuarioDeTeste(aplicacao.banco, contaDoUsuario);
      const sessao = await entrar(aplicacao, dono.email);
      await criarArquivo(aplicacao, contaDoUsuario, false);

      const resposta = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: '/api/conta',
        cookie: sessao,
        corpo: { senha: dono.senha },
      });

      expect(resposta.statusCode).toBe(204);
      await expect(readdir(join(aplicacao.diretorioDeEnvios, contaDoUsuario))).rejects.toThrow();
    });
  });
});
