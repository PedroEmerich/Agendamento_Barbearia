import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Em subpasta (GitHub Pages) o build recebe BASE_PATH=/<repositorio>/.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
