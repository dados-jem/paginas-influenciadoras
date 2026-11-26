import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://lp.joaoemariaeditora.com.br',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: { build: { sourcemap: false } },
});
