import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

import raiz from '../eslint.config.js';
import { IMPORTACOES_PROIBIDAS_NO_SITE } from '../eslint-restricoes.js';

// O esquery não aceita barra invertida: classes de caracteres no lugar dos escapes.
const COR_LITERAL = '^(#[0-9a-fA-F]{3,8}|(rgb|hsl|hwb|lab|lch|oklab|oklch)a?[(].*)$';
const VALOR_ARBITRARIO_TAILWIND = '(^| )[a-z0-9:!-]+-[[][^ ]+';

const AVISO_COR = 'Cor literal só em cores.css; use um estilo compartilhado ou token.';
const AVISO_ARBITRARIO =
  'Valor arbitrário do Tailwind é proibido; use token ou estilo compartilhado.';
const AVISO_STYLE = 'Sem style inline; use classes ligadas a tokens.';

const REGRAS_VISUAIS = [
  { selector: `Literal[value=/${COR_LITERAL}/]`, message: AVISO_COR },
  { selector: `TemplateElement[value.raw=/${COR_LITERAL}/]`, message: AVISO_COR },
  { selector: `Literal[value=/${VALOR_ARBITRARIO_TAILWIND}/]`, message: AVISO_ARBITRARIO },
  {
    selector: `TemplateElement[value.raw=/${VALOR_ARBITRARIO_TAILWIND}/]`,
    message: AVISO_ARBITRARIO,
  },
  { selector: "JSXAttribute[name.name='style']", message: AVISO_STYLE },
];

export default tseslint.config(
  ...raiz,
  { ignores: ['dist/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.tsx'],
    ...react.configs.flat.recommended,
    settings: { react: { version: '19.0' } },
  },
  {
    files: ['src/**/*.tsx'],
    ...react.configs.flat['jsx-runtime'],
  },
  {
    files: ['src/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['src/**/*.tsx'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'react/no-danger': 'error',
      'react/jsx-no-target-blank': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      complexity: ['error', 10],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: { 'no-restricted-imports': ['error', IMPORTACOES_PROIBIDAS_NO_SITE] },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts'],
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...REGRAS_VISUAIS] },
  },
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**/*.ts', 'src/test/**/*.tsx'],
    rules: { 'max-lines-per-function': 'off', 'max-lines': 'off' },
  },
);
