import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const RAIZ = import.meta.dirname;

// O cliente só gera o CSS (as páginas saem do build de renderização no servidor + prerender.ts).
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@site\//, replacement: `${resolve(RAIZ, 'src')}/` },
      { find: /^@\//, replacement: `${resolve(RAIZ, '../web/src')}/` },
    ],
  },
  build: isSsrBuild
    ? { outDir: 'dist-ssr', emptyOutDir: true }
    : {
        outDir: 'dist',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: { input: resolve(RAIZ, 'src/styles/index.css') },
      },
}));
