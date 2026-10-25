import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'client',
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    root: '.',
    include: ['server/test/**/*.test.ts', 'client/test/**/*.test.ts'],
  },
});
