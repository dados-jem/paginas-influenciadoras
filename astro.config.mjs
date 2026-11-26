import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://paginas-influenciadoras.pages.dev',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: { build: { sourcemap: false } },
});
