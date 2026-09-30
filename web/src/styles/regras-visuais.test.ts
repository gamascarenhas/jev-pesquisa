// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { ESLint } from 'eslint';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

const RAIZ_WEB = resolve(import.meta.dirname, '../..');
const RAIZ_SRC = join(RAIZ_WEB, 'src');
const ARQUIVO_FALSO = 'src/components/ui/ComponenteFalso.tsx';
const ARQUIVO_DE_FONTES = join('src', 'styles', 'fontes.css');
const PADRAO_DE_URL_DE_FONTE = /fonts\.(googleapis|gstatic)\.com|\.(woff2?|ttf|otf)\b/i;

const eslint = new ESLint({
  cwd: RAIZ_WEB,
  overrideConfig: {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: [ARQUIVO_FALSO] },
        tsconfigRootDir: RAIZ_WEB,
      },
    },
  },
});

async function regrasVioladas(componente: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(componente, {
    filePath: join(RAIZ_WEB, ARQUIVO_FALSO),
  });
  return (resultado?.messages ?? []).map((mensagem) => mensagem.ruleId ?? 'erro-de-sintaxe');
}

async function problemasDeCss(codigo: string, arquivo: string): Promise<string[]> {
  const resultado = await stylelint.lint({
    code: codigo,
    codeFilename: join(RAIZ_SRC, 'styles', arquivo),
    configFile: join(RAIZ_WEB, 'stylelint.config.js'),
  });
  return (resultado.results[0]?.warnings ?? []).map((aviso) => aviso.rule);
}

function listarArquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? listarArquivos(caminho) : [caminho];
  });
}

describe('lint dos componentes', { timeout: 60_000 }, () => {
  it('aceita um componente que só usa classes ligadas a tokens', async () => {
    const violacoes = await regrasVioladas(
      'export function Ok() {\n  return <p className="texto-corpo bg-acao p-4">Oi</p>;\n}\n',
    );

    expect(violacoes).toEqual([]);
  });

  it('recusa dangerouslySetInnerHTML', async () => {
    const violacoes = await regrasVioladas(
      'export function Mau({ html }: { html: string }) {\n  return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n',
    );

    expect(violacoes).toContain('react/no-danger');
  });

  it('recusa cor literal', async () => {
    const hexadecimal = await regrasVioladas(
      'export function Mau() {\n  return <p className="texto-corpo">{\'#ff0000\'}</p>;\n}\n',
    );
    const funcao = await regrasVioladas(
      "export const COR = 'rgb(255 0 0 / 50%)';\nexport function Mau() {\n  return <p>{COR}</p>;\n}\n",
    );

    expect(hexadecimal).toContain('no-restricted-syntax');
    expect(funcao).toContain('no-restricted-syntax');
  });

  it('recusa valor arbitrário do Tailwind', async () => {
    const colchetes = await regrasVioladas(
      'export function Mau() {\n  return <p className="w-[300px] texto-corpo">Oi</p>;\n}\n',
    );
    const comVariante = await regrasVioladas(
      'export function Mau() {\n  return <p className={`md:bg-[red] p-4`}>Oi</p>;\n}\n',
    );

    expect(colchetes).toContain('no-restricted-syntax');
    expect(comVariante).toContain('no-restricted-syntax');
  });

  it('recusa style inline', async () => {
    const violacoes = await regrasVioladas(
      'export function Mau() {\n  return <p style={{ color: "red" }}>Oi</p>;\n}\n',
    );

    expect(violacoes).toContain('no-restricted-syntax');
  });
});

describe('stylelint', () => {
  it('recusa cor literal fora de cores.css e aceita dentro dele', async () => {
    const hexadecimal = 'a { color: #ff0000; }\n';
    const funcao = 'a { color: rgb(255 0 0); }\n';

    expect(await problemasDeCss(hexadecimal, 'tipografia.css')).toContain('color-no-hex');
    expect(await problemasDeCss(funcao, 'tipografia.css')).toContain('function-disallowed-list');
    expect(await problemasDeCss(':root { --x: #ff0000; }\n', 'cores.css')).toEqual([]);
  });

  it('recusa família e tamanho de fonte fixos e @font-face fora de fontes.css', async () => {
    const familia = await problemasDeCss("a { font-family: 'Arial'; }\n", 'tipografia.css');
    const tamanho = await problemasDeCss('a { font-size: 14px; }\n', 'tipografia.css');
    const face = await problemasDeCss("@font-face { font-family: 'X'; }\n", 'tipografia.css');

    expect(familia).toContain('declaration-property-value-disallowed-list');
    expect(tamanho).toContain('declaration-property-value-disallowed-list');
    expect(face).toContain('at-rule-disallowed-list');
  });

  it('aceita fonte e tamanho vindos de variável e fixos dentro de fontes.css', async () => {
    const comVariavel = 'a { font-family: var(--fonte-corpo); font-size: var(--tamanho-corpo); }\n';
    const emFontes =
      "@font-face { font-family: 'X'; }\n:root { --t: 1rem; }\na { font-size: 14px; }\n";

    expect(await problemasDeCss(comVariavel, 'tipografia.css')).toEqual([]);
    expect(await problemasDeCss(emFontes, 'fontes.css')).toEqual([]);
  });
});

describe('fontes do projeto', () => {
  it('nenhum arquivo de fonte foi baixado para o repositório', () => {
    const arquivosDeFonte = listarArquivos(RAIZ_WEB).filter(
      (caminho) =>
        !caminho.includes(`${sep}node_modules${sep}`) &&
        !caminho.includes(`${sep}dist${sep}`) &&
        /\.(woff2?|ttf|otf|eot)$/i.test(caminho),
    );

    expect(arquivosDeFonte).toEqual([]);
  });

  it('só fontes.css referencia URL de fonte', () => {
    const fontesFora = listarArquivos(RAIZ_SRC)
      .filter((caminho) => /\.(css|tsx?|html)$/.test(caminho))
      .filter((caminho) => !caminho.endsWith('.test.ts') && !caminho.endsWith('.test.tsx'))
      .filter((caminho) => relative(RAIZ_WEB, caminho) !== ARQUIVO_DE_FONTES)
      .filter((caminho) => PADRAO_DE_URL_DE_FONTE.test(readFileSync(caminho, 'utf8')))
      .map((caminho) => relative(RAIZ_WEB, caminho));

    expect(fontesFora).toEqual([]);
  });

  it('o index.html só preconecta às origens de estilo e fonte', () => {
    const html = readFileSync(join(RAIZ_WEB, 'index.html'), 'utf8');
    const preload = [...html.matchAll(/rel="preload"[^>]*/g)];

    expect(preload).toHaveLength(0);
  });
});
