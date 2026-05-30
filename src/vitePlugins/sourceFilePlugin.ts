import type { PluginOption } from 'vite';

export function sourceFilePlugin(): PluginOption {
  const cwd = process.cwd().replace(/\\/g, '/') + '/src';

  return {
    name: 'vite:source-file-inject',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules') || id.startsWith('transforming')) {
        return null;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(id)) {
        return null;
      }
      if (code.includes('const __SOURCE_FILE__=')) {
        return null;
      }

      const normalizedId = id.replace(/\\/g, '/');
      const relativePath = normalizedId.startsWith(cwd)
        ? normalizedId.slice(cwd.length + 1)
        : normalizedId;

      const source = JSON.stringify(relativePath);
      return {
        code: `  const __SOURCE_FILE__=${source};\n` + code,
        map: null,
      };
    },
  };
}
