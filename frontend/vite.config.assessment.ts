/**
 * Vite Configuration for Assessment Page Bundle
 * 
 * Builds a self-contained, single JS file (assessment.js) that includes:
 * - React + ReactDOM
 * - All step components + useIntakeForm hook
 * - All CSS (Tailwind + custom) inlined into JS
 * - IIFE format (immediately invoked, no module system required)
 * 
 * Usage: npm run build:assessment
 * Output: dist-assessment/assessment.js
 */

import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite plugin to inject CSS into the JS bundle.
 */
function cssInjectedByJsPlugin(): Plugin {
  return {
    name: 'css-injected-by-js',
    apply: 'build',
    enforce: 'post',
    generateBundle(options, bundle) {
      let cssCode = '';
      const cssAssetKeys: string[] = [];
      
      for (const [key, chunk] of Object.entries(bundle)) {
        if (key.endsWith('.css') && chunk.type === 'asset') {
          cssCode += chunk.source;
          cssAssetKeys.push(key);
        }
      }

      for (const key of cssAssetKeys) {
        delete bundle[key];
      }

      if (cssCode) {
        for (const [key, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk' && chunk.isEntry) {
            const cssInjection = `(function(){try{var s=document.createElement('style');s.setAttribute('data-nr-assessment','');s.textContent=${JSON.stringify(cssCode)};document.head.appendChild(s);}catch(e){console.error('Assessment: Failed to inject styles',e);}})();\n`;
            chunk.code = cssInjection + chunk.code;
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
  ],

  css: {
    postcss: './postcss.config.widget.js',
  },

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

  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({}),
    'import.meta.env.VITE_API_URL': JSON.stringify(''),
  },

  build: {
    outDir: 'dist-assessment',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2015',

    lib: {
      entry: path.resolve(__dirname, 'src/assessment-entry.tsx'),
      name: 'NeuroReachAssessment',
      formats: ['iife'],
      fileName: () => 'assessment.js',
    },

    rollupOptions: {
      external: [],
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assessment.js',
        manualChunks: undefined,
      },
    },

    cssCodeSplit: false,
    chunkSizeWarningLimit: 1500,
    reportCompressedSize: true,
  },
});
