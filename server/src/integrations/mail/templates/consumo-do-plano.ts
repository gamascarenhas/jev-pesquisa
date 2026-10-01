import type { ConteudoDeEmail } from '../enviador-email.js';

const formatadorDeData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
});

// Nunca cita dólar, token ou modelo: o cliente só vê a porcentagem do plano.
export function montarEmailDeConsumoDoPlano(dados: {
  nomeNegocio: string;
  nomeEmpresa: string;
  limiar: 80 | 100;
  renovaEm: Date;
}): ConteudoDeEmail {
  const renovacao = formatadorDeData.format(dados.renovaEm);
  if (dados.limiar === 80) {
    return {
      assunto: `${dados.nomeEmpresa}: você usou 80% do plano deste mês`,
      texto: [
        `A conta de ${dados.nomeEmpresa} no ${dados.nomeNegocio} já usou 80% das análises do plano neste ciclo.`,
        '',
        `Quando o limite for atingido, a análise para e continua sozinha na renovação, em ${renovacao}.`,
        'Importar e consultar comentários continua funcionando normalmente.',
      ].join('\n'),
    };
  }
  return {
    assunto: `${dados.nomeEmpresa}: o limite de análises do mês foi atingido`,
    texto: [
      `A conta de ${dados.nomeEmpresa} no ${dados.nomeNegocio} atingiu o limite de análises deste mês.`,
      '',
      `A análise continua automaticamente na renovação, em ${renovacao}.`,
      'Importar, consultar e exportar comentários continua funcionando normalmente.',
    ].join('\n'),
  };
}
