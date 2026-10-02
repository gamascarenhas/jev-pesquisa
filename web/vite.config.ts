import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const PORTA_PADRAO_DO_SERVIDOR = '3000';

export default defineConfig(({ mode }) => {
  const ambiente = loadEnv(mode, resolve(import.meta.dirname, '..'), '');
  const porta = ambiente.PORT ?? PORTA_PADRAO_DO_SERVIDOR;
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
    server: {
      strictPort: true,
      // Mantém o Host do app: o servidor decide entre app e site pelo Host, e o site também usa esta porta.
      proxy: { '/api': { target: `http://localhost:${porta}`, changeOrigin: false } },
    },
  };
});
