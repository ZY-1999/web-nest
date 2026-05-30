import path from 'node:path';
import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';
import { sourceFilePlugin } from './src/vitePlugins/sourceFilePlugin';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';



export default defineConfig({
  plugins: [sourceFilePlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    lib: {
      entry: 'src/preload/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: 'dist/preload',
    emptyOutDir: true,
    sourcemap: isDev,
    minify: !isDev,
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      output: {
        dynamicImportInCjs: false,
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.PROCESS_TYPE': JSON.stringify('preload') as 'main' | 'preload' | 'renderer',
  },
});
