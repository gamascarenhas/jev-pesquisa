import { noul } from '@typesafe-ai/sdk';

// state: { claim: achado.texto, evidence: [{ id: "c1", text: "..." }, ...] }
export const perguntasVerificacaoAchado = {
  supported: noul(
    'Do the customer comments in `evidence` clearly support the statement in `claim`?',
    {
      true: 'The comments directly describe what `claim` states',
      false: 'The comments do not mention it, contradict it, or support only a weaker version',
    },
  ),
};

export const CARACTERES_DAS_PERGUNTAS_DE_VERIFICACAO = JSON.stringify(
  perguntasVerificacaoAchado,
).length;
