/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { CSP_META } from './src/security/policy.ts';

/** Content-Security-Policy for the production build only (the dev server needs inline HMR scripts). */
const csp = (): Plugin => ({
  name: 'epoch-csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_META }, injectTo: 'head-prepend' }],
});

export default defineConfig({
  base: './',
  plugins: [csp()],
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: ['es2020', 'safari15'],
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
