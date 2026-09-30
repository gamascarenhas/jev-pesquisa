import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Modal } from './Modal';

function Exemplo() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
        }}
      >
        Abrir
      </button>
      {aberto && (
        <Modal
          titulo="Confirmar"
          aoFechar={() => {
            setAberto(false);
          }}
        >
          <input aria-label="Campo" />
          <button type="button">Primeiro</button>
          <button type="button">Último</button>
        </Modal>
      )}
    </>
  );
}

describe('Modal', () => {
  it('abre como diálogo nomeado e leva o foco para dentro', async () => {
    render(<Exemplo />);

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByRole('dialog', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Campo')).toHaveFocus();
  });

  it('prende o foco: Tab volta ao início e Shift+Tab vai ao fim', async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Último' })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByLabelText('Campo')).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Último' })).toHaveFocus();
  });

  it('fecha com Escape e devolve o foco a quem abriu', async () => {
    render(<Exemplo />);
    const abrir = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(abrir);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });
});
