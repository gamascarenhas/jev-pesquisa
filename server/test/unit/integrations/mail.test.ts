import { describe, expect, it, vi } from 'vitest';

import { criarEnviadorLog } from '../../../src/integrations/mail/enviador-log.js';
import { criarEnviadorSmtp } from '../../../src/integrations/mail/enviador-smtp.js';
import { montarEmailDeConfirmacao } from '../../../src/integrations/mail/templates/confirmacao-email.js';
import { montarEmailDeContaJaExistente } from '../../../src/integrations/mail/templates/conta-ja-existente.js';
import { montarEmailDeConvite } from '../../../src/integrations/mail/templates/convite.js';
import { montarEmailDeRedefinicaoDeSenha } from '../../../src/integrations/mail/templates/redefinicao-senha.js';
import { montarEmailDeTrocaDeEmail } from '../../../src/integrations/mail/templates/troca-email.js';
import { criarRegistradorCapturado } from '../../helpers/factories.js';

const NOME = 'Negócio Exemplo';
const LINK = 'https://app.exemplo.com.br/x?token=abc';

describe('modelos de e-mail', () => {
  const modelos = [
    montarEmailDeConfirmacao({ nomeNegocio: NOME, nomeUsuario: 'Ana', link: LINK }),
    montarEmailDeTrocaDeEmail({ nomeNegocio: NOME, nomeUsuario: 'Ana', link: LINK }),
    montarEmailDeRedefinicaoDeSenha({ nomeNegocio: NOME, nomeUsuario: 'Ana', link: LINK }),
    montarEmailDeConvite({
      nomeNegocio: NOME,
      nomeConvidante: 'Bia',
      nomeEmpresa: 'Padaria',
      link: LINK,
    }),
    montarEmailDeContaJaExistente({
      nomeNegocio: NOME,
      linkEntrar: 'https://app.exemplo.com.br/entrar',
      linkRedefinirSenha: 'https://app.exemplo.com.br/esqueci-senha',
    }),
  ];

  it.each(modelos.map((modelo, indice) => [indice, modelo] as const))(
    'o modelo %i usa o nome do negócio no assunto e no corpo',
    (_indice, modelo) => {
      expect(modelo.assunto).toContain(NOME);
      expect(modelo.texto).toContain(NOME);
    },
  );

  it('os modelos com link o trazem no corpo e o aviso de conta existente não traz token', () => {
    for (const modelo of modelos.slice(0, 4)) {
      expect(modelo.texto).toContain(LINK);
    }
    expect(modelos[4]?.texto).not.toContain('token=');
  });
});

describe('enviador SMTP', () => {
  it('usa o nome do negócio como nome de exibição do remetente', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const enviador = criarEnviadorSmtp(
      { sendMail },
      { nome: NOME, endereco: 'nao-responda@exemplo.com.br' },
    );

    await enviador.enviar({ para: 'ana@exemplo.com.br', assunto: 'Olá', texto: 'Corpo' });

    expect(sendMail).toHaveBeenCalledWith({
      from: { name: NOME, address: 'nao-responda@exemplo.com.br' },
      to: 'ana@exemplo.com.br',
      subject: 'Olá',
      text: 'Corpo',
    });
  });

  it('propaga a falha do transporte', async () => {
    const enviador = criarEnviadorSmtp(
      { sendMail: vi.fn().mockRejectedValue(new Error('smtp fora do ar')) },
      { nome: NOME, endereco: 'nao-responda@exemplo.com.br' },
    );

    await expect(
      enviador.enviar({ para: 'ana@exemplo.com.br', assunto: 'A', texto: 'B' }),
    ).rejects.toThrow('smtp fora do ar');
  });
});

describe('enviador que só escreve no log', () => {
  it('registra a mensagem, com o link, no log', async () => {
    const captura = criarRegistradorCapturado();

    await criarEnviadorLog(captura.registrador).enviar({
      para: 'ana@exemplo.com.br',
      assunto: 'Assunto',
      texto: `Abra ${LINK}`,
    });

    expect(captura.linhas()[0]).toMatchObject({
      categoria: 'email_simulado',
      para: 'ana@exemplo.com.br',
    });
    expect(captura.texto()).toContain(LINK);
  });
});
