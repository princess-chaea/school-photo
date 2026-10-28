import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  worker: { format: 'es' },
  build: { rollupOptions: { input: { admin: fileURLToPath(new URL('./index.html', import.meta.url)), booth: fileURLToPath(new URL('./booth.html', import.meta.url)) } } },
});
