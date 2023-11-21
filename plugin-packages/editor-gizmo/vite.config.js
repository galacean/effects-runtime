import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import glslInner from '../../scripts/rollup-plugin-glsl-inner';

export default defineConfig(({ mode }) => {
  const development = mode === 'development';

  return {
    esbuild: {},
    server: {
      host: '0.0.0.0',
      port: 8081,
    },
    define: {
      __VERSION__: 0,
      __DEBUG__: development ? true : false,
    },
    plugins: [
      glslInner(),
      tsconfigPaths(),
    ],
  };
});
