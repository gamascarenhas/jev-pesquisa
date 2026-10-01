import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PreviaDoEnvio } from '@/api/types';
import { erroDaApi, simularApi } from '@/test/api-falsa';
import { renderizarComProvedores } from '@/test/renderizar';

import { UploadPage } from './UploadPage';

const PROJETO = 'p-1';
const previa: PreviaDoEnvio = {
  envioId: 'e-1.csv',
  tipo: 'csv',
  nomeArquivo: 'avaliacoes.csv',
  abas: [],
  aba: null,
  cabecalho: ['Data', 'Comentário'],
  linhas: [['01/02/2024', 'Ótimo atendimento']],
  totalLinhas: 1,
  sugestao: { data: 0, comentario: 1 },
};
const resumo = {
  total: 13,
  processadas: 13,
  importados: 10,
  ignorados: 2,
  duplicados: 1,
  concluida: true,
};

function renderizar() {
  renderizarComProvedores(
    <Routes>
      <Route path="/projetos/:projetoId/importar" element={<UploadPage />} />
      <Route path="/projetos" element={<p>Tela de projetos</p>} />
    </Routes>,
    { rota: `/projetos/${PROJETO}/importar` },
  );
}

function escolherArquivo(nome = 'avaliacoes.csv') {
  const arquivo = new File(['Data;Comentário\n01/02/2024;Ótimo atendimento\n'], nome, {
    type: 'text/csv',
  });
  return userEvent.upload(
    screen.getByLabelText('Escolher arquivo', { selector: 'input' }),
    arquivo,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UploadPage', () => {
  it('envia o arquivo, confirma o mapeamento e mostra o resumo da importação', async () => {
    const chamadas = simularApi({
      [`POST /projetos/${PROJETO}/envios`]: { status: 201, corpo: previa },
      [`POST /projetos/${PROJETO}/envios/e-1.csv/confirmar`]: {
        status: 202,
        corpo: { trabalhoId: 't-1', fonteId: 'f-1' },
      },
      'GET /trabalhos/t-1': {
        corpo: {
          id: 't-1',
          tipo: 'import_upload',
          status: 'done',
          projetoId: PROJETO,
          progresso: { total: 13, feito: 13 },
          criadoEm: '2026-01-01T00:00:00.000Z',
          iniciadoEm: null,
          finalizadoEm: null,
        },
      },
      [`GET /projetos/${PROJETO}/fontes/f-1`]: {
        corpo: { id: 'f-1', nome: 'avaliacoes.csv', importacao: resumo, criadoEm: '2026-01-01' },
      },
    });
    renderizar();

    await escolherArquivo();
    await userEvent.click(await screen.findByRole('button', { name: 'Importar comentários' }));

    expect(await screen.findByText('Importação concluída')).toBeInTheDocument();
    expect(screen.getByText('Importados').nextElementSibling).toHaveTextContent('10');
    expect(screen.getByText('Ignorados').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Duplicados').nextElementSibling).toHaveTextContent('1');
    const confirmacao = chamadas.find((chamada) => chamada.caminho.endsWith('/confirmar'));
    expect(confirmacao?.corpo).toEqual({
      nomeArquivo: 'avaliacoes.csv',
      mapeamento: { comentario: 1, data: 0 },
    });
  });

  it('mostra a orientação do servidor quando o arquivo é recusado', async () => {
    simularApi({
      [`POST /projetos/${PROJETO}/envios`]: erroDaApi(400, 'formato_xls_nao_suportado'),
    });
    renderizar();

    await escolherArquivo('antigo.xls');

    expect(await screen.findByRole('alert')).toHaveTextContent('salve como .xlsx');
    expect(screen.getByRole('button', { name: 'Escolher arquivo' })).toBeEnabled();
  });

  it('avisa quando a importação falha e permite recomeçar', async () => {
    simularApi({
      [`POST /projetos/${PROJETO}/envios`]: { status: 201, corpo: previa },
      [`POST /projetos/${PROJETO}/envios/e-1.csv/confirmar`]: {
        status: 202,
        corpo: { trabalhoId: 't-1', fonteId: 'f-1' },
      },
      'GET /trabalhos/t-1': {
        corpo: {
          id: 't-1',
          tipo: 'import_upload',
          status: 'failed',
          projetoId: PROJETO,
          progresso: { total: 0, feito: 0 },
          criadoEm: '2026-01-01T00:00:00.000Z',
          iniciadoEm: null,
          finalizadoEm: null,
        },
      },
    });
    renderizar();

    await escolherArquivo();
    await userEvent.click(await screen.findByRole('button', { name: 'Importar comentários' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Escolher outro arquivo' }));

    expect(screen.getByRole('button', { name: 'Escolher arquivo' })).toBeInTheDocument();
  });
});
