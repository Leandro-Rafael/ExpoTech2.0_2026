import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Bibliotecas pesadas ficam em chunks próprios. Como só são importadas por
// páginas/componentes carregados com React.lazy(), não entram no bundle inicial.
const heavyChunks: Record<string, string[]> = {
  three: ['three'],
  tfjs: ['@tensorflow/tfjs', '@tensorflow-models/mobilenet', '@tensorflow/tfjs-core', '@tensorflow/tfjs-converter', '@tensorflow/tfjs-backend-webgl', '@tensorflow/tfjs-backend-cpu', '@tensorflow/tfjs-layers', '@tensorflow/tfjs-data'],
  leaflet: ['leaflet', 'react-leaflet', '@react-leaflet/core'],
  charts: ['recharts', 'd3-', 'victory-vendor'],
  scroll: ['gsap', 'lenis'],
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // Cookies HttpOnly (ez_access/ez_refresh) e XSRF-TOKEN passam pelo proxy
      // como mesma origem: localhost:5173 → localhost:8080.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        secure: false,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          for (const [chunk, pkgs] of Object.entries(heavyChunks)) {
            if (pkgs.some((p) => id.includes(`/node_modules/${p}`))) return chunk;
          }
          if (/\/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
});
