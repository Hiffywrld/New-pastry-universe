import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const impl = process.env.VITE_MOCK ? './src/api/mock.js' : './src/api/http.js';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@api-impl': fileURLToPath(new URL(impl, import.meta.url)) },
  },
  server: {
    // In development, /api goes to the Spring Boot server.
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
});
