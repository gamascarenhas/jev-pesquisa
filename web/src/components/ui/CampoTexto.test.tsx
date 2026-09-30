import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CampoTexto } from './CampoTexto';

describe('CampoTexto', () => {
  it('liga o rótulo ao campo e aceita digitação', async () => {
    render(<CampoTexto rotulo="E-mail" />);

    const campo = screen.getByLabelText('E-mail');
    await userEvent.type(campo, 'ana@empresa.com.br');

    expect(campo).toHaveValue('ana@empresa.com.br');
    expect(campo).toHaveAttribute('aria-invalid', 'false');
  });

  it('mostra o erro, marca o campo como inválido e o descreve', () => {
    render(<CampoTexto rotulo="Senha" erro="Preencha este campo." />);

    const campo = screen.getByLabelText('Senha');
    const mensagem = screen.getByText('Preencha este campo.');

    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Preencha este campo.');
    expect(mensagem).toHaveClass('texto-erro');
  });

  it('mostra a ajuda quando não há erro', () => {
    render(<CampoTexto rotulo="Nome" ajuda="Como aparece na conta." />);

    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('Como aparece na conta.');
  });
});
