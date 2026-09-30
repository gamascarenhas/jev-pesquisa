import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DialogoConfirmacao } from './DialogoConfirmacao';

function renderizar(aoConfirmar = vi.fn(), aoCancelar = vi.fn()) {
  render(
    <DialogoConfirmacao
      titulo="Apagar o projeto Loja?"
      descricao="Não dá para desfazer."
      nomeEsperado="Loja Centro"
      rotuloDoCampo="Digite Loja Centro para confirmar"
      rotuloDaAcao="Apagar projeto"
      aoConfirmar={aoConfirmar}
      aoCancelar={aoCancelar}
    />,
  );
  return { aoConfirmar, aoCancelar };
}

describe('DialogoConfirmacao', () => {
  it('só habilita a ação quando o nome é digitado por inteiro', async () => {
    const { aoConfirmar } = renderizar();
    const acao = screen.getByRole('button', { name: 'Apagar projeto' });
    const campo = screen.getByLabelText('Digite Loja Centro para confirmar');

    expect(acao).toBeDisabled();

    await userEvent.type(campo, 'Loja Cent');
    expect(acao).toBeDisabled();

    await userEvent.type(campo, 'ro');
    expect(acao).toBeEnabled();

    await userEvent.click(acao);
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  it('volta a desabilitar se o nome deixar de bater', async () => {
    renderizar();
    const campo = screen.getByLabelText('Digite Loja Centro para confirmar');

    await userEvent.type(campo, 'Loja Centro');
    await userEvent.type(campo, 'x');

    expect(screen.getByRole('button', { name: 'Apagar projeto' })).toBeDisabled();
  });

  it('cancela sem confirmar', async () => {
    const { aoConfirmar, aoCancelar } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(aoCancelar).toHaveBeenCalledTimes(1);
    expect(aoConfirmar).not.toHaveBeenCalled();
  });
});
