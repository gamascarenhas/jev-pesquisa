import { resolve } from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const RAIZ = resolve(import.meta.dirname, '../..');
// O parser com tipos só aceita arquivos que o tsconfig do projeto já inclui.
const ARQUIVO_EXISTENTE = { site: 'src/entry-server.tsx', web: 'src/main.tsx' };

async function violacoes(projeto: 'site' | 'web', codigo: string) {
  const eslint = new ESLint({ cwd: resolve(RAIZ, projeto) });
  const [resultado] = await eslint.lintText(codigo, {
    filePath: resolve(RAIZ, projeto, ARQUIVO_EXISTENTE[projeto]),
  });
  return (resultado?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports');
}

describe('direção das dependências entre site e web', () => {
  it('o site pode importar de lib, styles e components/ui do web', async () => {
    const codigo = "import { cn } from '@/lib/cn';\nexport const x = cn;\n";

    expect(await violacoes('site', codigo)).toEqual([]);
  });

  it.each([
    "import { x } from '@/features/auth/auth.servico';",
    "import { x } from '../../web/src/features/auth/x';",
  ])('o site não importa de outras partes do web: %s', async (importacao) => {
    const problemas = await violacoes('site', `${importacao}\nexport const y = x;\n`);

    expect(problemas).toHaveLength(1);
  });

  it.each([
    "import { x } from '@site/seo/robots';",
    "import { x } from '../../site/src/seo/robots';",
  ])('o web não importa do site: %s', async (importacao) => {
    const problemas = await violacoes('web', `${importacao}\nexport const y = x;\n`);

    expect(problemas).toHaveLength(1);
  });
});
