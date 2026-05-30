import path from 'node:path';
import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { sourceFilePlugin } from './src/vitePlugins/sourceFilePlugin';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  plugins: [
    sourceFilePlugin(),
    viteStaticCopy({
      targets: [
        {
          src: 'src/main/assets/**/*',
          dest: 'assets',
        },
      ],
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: 'dist/main',
    emptyOutDir: true,
    sourcemap: isDev,
    minify: !isDev,
    rollupOptions: {
      external: ['electron', 'native', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      output: {
        dynamicImportInCjs: false,
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.PROCESS_TYPE': JSON.stringify('main') as 'main' | 'preload' | 'renderer',
    'process.env.UPDATE_SERVER_URL': JSON.stringify(process.env.UPDATE_SERVER_URL ?? ''),
    'process.env.AUTO_CHECK_ON_STARTUP': JSON.stringify(
      process.env.AUTO_CHECK_ON_STARTUP ?? 'true',
    ),
    'process.env.AUTO_DOWNLOAD': JSON.stringify(process.env.AUTO_DOWNLOAD ?? 'false'),
    'process.env.UPDATE_CHECK_INTERVAL': JSON.stringify(
      process.env.UPDATE_CHECK_INTERVAL ?? '3600000',
    ),
  },
});
