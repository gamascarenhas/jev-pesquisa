import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { AlternarTema } from './AlternarTema';

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('tema-escuro');
});

describe('AlternarTema', () => {
  it('começa no tema claro e alterna para o escuro, salvando a escolha', async () => {
    render(<AlternarTema />);

    await userEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }));

    expect(document.documentElement.classList.contains('tema-escuro')).toBe(true);
    expect(localStorage.getItem('tema')).toBe('escuro');
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument();
  });

  it('volta para o tema claro', async () => {
    localStorage.setItem('tema', 'escuro');
    render(<AlternarTema />);

    await userEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }));

    expect(document.documentElement.classList.contains('tema-escuro')).toBe(false);
    expect(localStorage.getItem('tema')).toBe('claro');
  });
});
