/**
 * Vite Configuration for Widget Embed Bundle
 * 
 * Builds a self-contained, single JS file (widget-embed.js) that includes:
 * - React + ReactDOM
 * - All widget components
 * - All CSS (Tailwind + custom) inlined into JS
 * - IIFE format (immediately invoked, no module system required)
 * 
 * Usage: npm run build:widget
 * Output: dist-widget/widget-embed.js
 */

import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite plugin to inject CSS into the JS bundle.
 * When building a widget, we want a single JS file with CSS included.
 * This plugin takes the extracted CSS and injects it via JS at runtime.
 */
function cssInjectedByJsPlugin(): Plugin {
  return {
    name: 'css-injected-by-js',
    apply: 'build',
    enforce: 'post',
    generateBundle(options, bundle) {
      // Find the CSS asset
      let cssCode = '';
      const cssAssetKeys: string[] = [];
      
      for (const [key, chunk] of Object.entries(bundle)) {
        if (key.endsWith('.css') && chunk.type === 'asset') {
          cssCode += chunk.source;
          cssAssetKeys.push(key);
        }
      }

      // Remove CSS asset files (we'll inline them)
      for (const key of cssAssetKeys) {
        delete bundle[key];
      }

      // Inject CSS into the JS bundle
      if (cssCode) {
        for (const [key, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk' && chunk.isEntry) {
            // Prepend CSS injection code to the JS
            const cssInjection = `(function(){try{var s=document.createElement('style');s.setAttribute('data-nr-widget','');s.textContent=${JSON.stringify(cssCode)};document.head.appendChild(s);}catch(e){console.error('NeuroReach widget: Failed to inject styles',e);}})();\n`;
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

  // Use widget-specific PostCSS config (with scoped Tailwind)
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

  // Define env variables for the widget
  // CRITICAL: process.env.NODE_ENV must be defined for React to work in browser
  // (without this, "process is not defined" ReferenceError crashes the IIFE)
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({}),
    'import.meta.env.VITE_API_URL': JSON.stringify(''),
  },

  build: {
    outDir: 'dist-widget',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2015',

    // Build as a single IIFE bundle
    lib: {
      entry: path.resolve(__dirname, 'src/widget-embed.tsx'),
      name: 'NeuroReachWidget',
      formats: ['iife'],
      fileName: () => 'widget-embed.js',
    },

    rollupOptions: {
      // Don't externalize anything - bundle everything including React
      external: [],
      output: {
        // IIFE format
        format: 'iife',
        // Ensure CSS is inlined into JS
        inlineDynamicImports: true,
        // Single file output
        entryFileNames: 'widget-embed.js',
        // No code splitting
        manualChunks: undefined,
      },
    },

    // Inline all CSS into the JS bundle
    cssCodeSplit: false,

    // No chunk size warning for widget (it will be larger than a normal chunk)
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: true,
  },
});
