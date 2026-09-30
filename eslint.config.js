// Regras de padroes-de-engenharia.md; web e site entram aqui quando nascem.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const ARQUIVOS_DE_TESTE = ['**/test/**/*.ts', '**/*.test.ts', '**/*.test.tsx'];

// Entre módulos, só *.servico.ts e *.tipos.ts; shared e integrations passam.
const PADRAO_ENTRE_MODULOS = {
  regex: '^\\.\\./(?!\\.\\.)[^/]+/.*(?<!\\.servico|\\.tipos)\\.js$',
  message: 'Um módulo só importa de outro pelos arquivos *.servico.ts e *.tipos.ts.',
};

const PADRAO_DAS_ROTAS = {
  group: ['**/*.repositorio.js', '**/*.sistema.repositorio.js', '**/db/**', '**/integrations/**'],
  message: 'Rotas chamam serviços, nunca repositórios, banco ou integrações.',
};
const PROIBIDO_NAS_ROTAS = [{ name: 'pg', message: 'Rotas não falam direto com o banco.' }];

const IMPORTACAO_ENTRE_MODULOS = { patterns: [PADRAO_ENTRE_MODULOS] };
const IMPORTACAO_DAS_ROTAS = { patterns: [PADRAO_DAS_ROTAS], paths: PROIBIDO_NAS_ROTAS };
const IMPORTACAO_DAS_ROTAS_DE_MODULO = {
  patterns: [PADRAO_ENTRE_MODULOS, PADRAO_DAS_ROTAS],
  paths: PROIBIDO_NAS_ROTAS,
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
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
    files: ['server/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    files: ['server/src/modules/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', IMPORTACAO_ENTRE_MODULOS] },
  },
  {
    files: ['server/src/**/*.rotas.ts'],
    rules: { 'no-restricted-imports': ['error', IMPORTACAO_DAS_ROTAS] },
  },
  {
    files: ['server/src/modules/**/*.rotas.ts'],
    rules: { 'no-restricted-imports': ['error', IMPORTACAO_DAS_ROTAS_DE_MODULO] },
  },
  {
    files: ARQUIVOS_DE_TESTE,
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },
  {
    files: ['**/i18n/*.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    files: ['**/vitest.config.ts'],
    rules: { 'no-restricted-exports': 'off' },
  },
);
