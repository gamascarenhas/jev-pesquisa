import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Botao } from './Botao';

describe('Botao', () => {
  it('chama aoClicar e usa type=button por padrão', async () => {
    const aoClicar = vi.fn();
    render(<Botao onClick={aoClicar}>Salvar</Botao>);

    const botao = screen.getByRole('button', { name: 'Salvar' });
    await userEvent.click(botao);

    expect(botao).toHaveAttribute('type', 'button');
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it('fica desabilitado e ocupado enquanto carrega', async () => {
    const aoClicar = vi.fn();
    render(
      <Botao carregando onClick={aoClicar}>
        Enviar
      </Botao>,
    );

    const botao = screen.getByRole('button', { name: 'Enviar' });
    await userEvent.click(botao);

    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute('aria-busy', 'true');
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('aplica a variante escolhida', () => {
    render(<Botao variante="perigo">Apagar</Botao>);

    expect(screen.getByRole('button', { name: 'Apagar' })).toHaveClass('bg-perigo');
  });
});
