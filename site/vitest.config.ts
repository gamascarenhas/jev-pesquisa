import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const RAIZ = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@site\//, replacement: `${resolve(RAIZ, 'src')}/` },
      { find: /^@\//, replacement: `${resolve(RAIZ, '../web/src')}/` },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    css: false,
    testTimeout: 60_000,
  },
});
