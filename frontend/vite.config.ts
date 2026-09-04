import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const POLITICA_CSP_DEV = [
  "default-src 'self'",
  "script-src 'self' ",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const cspHeadersDev = (): Plugin => ({
  name: 'csp-headers-dev',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Content-Security-Policy', POLITICA_CSP_DEV);
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), cspHeadersDev()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
