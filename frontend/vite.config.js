import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const impl = process.env.VITE_MOCK ? './src/api/mock.js' : './src/api/http.js';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// /admin/anything loads the kitchen app; everything else loads the shop.
function adminRoutes() {
  const rewrite = (req, _res, next) => {
    const path = req.url.split('?')[0];
    if ((path === '/admin' || path.startsWith('/admin/')) && !path.includes('.')) req.url = '/admin/index.html';
    next();
  };
  return {
    name: 'admin-routes',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [react(), adminRoutes()],
  resolve: {
    alias: { '@api-impl': here(impl) },
  },
  build: {
    rollupOptions: {
      input: { shop: here('./index.html'), admin: here('./admin/index.html') },
    },
  },
  server: {
    // In development, /api goes to the Spring Boot server.
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
});
