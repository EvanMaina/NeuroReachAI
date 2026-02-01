/**
 * Vite Configuration - Performance Optimized
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['hydrologically-nesh-sook.ngrok-free.dev'],
    proxy: {
      '/api': {
        // BACKEND_URL is set by docker-compose to http://backend:8000;
        // falls back to localhost for bare `npm run dev`.
        target: process.env.BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'query-vendor': ['@tanstack/react-query'],
          icons: ['lucide-react'],
          charts: ['recharts'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    cssCodeSplit: true,
    target: 'es2020',
    chunkSizeWarningLimit: 500,
    reportCompressedSize: false,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      'lucide-react',
      'recharts',
    ],
  },
});
