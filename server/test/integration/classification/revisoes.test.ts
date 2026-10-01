import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarRevisoesRepositorio } from '../../../src/modules/classification/revisoes.repositorio.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarComentarioDeTeste,
  criarContaDeTeste,
  criarFonteDeTeste,
  criarProjetoDeTeste,
  criarUsuarioDeTeste,
} from '../../helpers/factories.js';

describe('revisões da classificação', () => {
  let aplicacao: AppDeTeste;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste();
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function criarConta() {
    const contaId = await criarContaDeTeste(aplicacao.banco);
    const usuario = await criarUsuarioDeTeste(aplicacao.banco, contaId);
    const projetoId = await criarProjetoDeTeste(aplicacao.banco, contaId);
    const fonteId = await criarFonteDeTeste(aplicacao.banco, contaId, projetoId);
    const comentarioId = await criarComentarioDeTeste(aplicacao.banco, contaId, projetoId, fonteId);
    return { contaId, usuario, comentarioId };
  }

  it('grava e corrige a revisão humana do comentário', async () => {
    const { contaId, usuario, comentarioId } = await criarConta();
    const revisoes = criarRevisoesRepositorio(aplicacao.banco);

    await revisoes.gravar(contaId, comentarioId, 'price', 'negative', usuario.id);
    await revisoes.gravar(contaId, comentarioId, 'service', 'positive', usuario.id);

    expect(await revisoes.buscar(contaId, comentarioId)).toMatchObject({
      tema: 'service',
      sentimento: 'positive',
      revisadoPor: usuario.id,
    });
  });

  it('recusa tema e sentimento fora da lista de questions.ts', async () => {
    const { contaId, usuario, comentarioId } = await criarConta();
    const revisoes = criarRevisoesRepositorio(aplicacao.banco);

    const temaInvalido = revisoes.gravar(
      contaId,
      comentarioId,
      'inventado',
      'positive',
      usuario.id,
    );
    const sentimentoInvalido = revisoes.gravar(contaId, comentarioId, 'price', 'feliz', usuario.id);

    await expect(temaInvalido).rejects.toMatchObject({ codigo: 'classificacao_invalida' });
    await expect(sentimentoInvalido).rejects.toMatchObject({ codigo: 'classificacao_invalida' });
  });

  it('não grava revisão de comentário de outra conta, nem a enxerga', async () => {
    const a = await criarConta();
    const b = await criarConta();
    const revisoes = criarRevisoesRepositorio(aplicacao.banco);

    await revisoes.gravar(a.contaId, a.comentarioId, 'price', 'negative', a.usuario.id);
    const cruzada = revisoes.gravar(b.contaId, a.comentarioId, 'price', 'negative', b.usuario.id);

    await expect(cruzada).rejects.toMatchObject({ codigo: 'comentario_nao_encontrado' });
    expect(await revisoes.buscar(b.contaId, a.comentarioId)).toBeUndefined();
  });
});
