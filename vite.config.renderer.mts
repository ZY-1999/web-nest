import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { sourceFilePlugin } from './src/vitePlugins/sourceFilePlugin';
import { fileURLToPath } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
        'webapp-titlebar': path.resolve(__dirname, 'src/renderer/webapp-titlebar.html'),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    sourceFilePlugin(),
    visualizer({
      open: false,
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.PROCESS_TYPE': JSON.stringify('renderer') as 'main' | 'preload' | 'renderer',
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
