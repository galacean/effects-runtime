import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import glslInner from '../../scripts/rollup-plugin-glsl-inner';

const defines = {
  __VERSION__: 0,
  __DEBUG__: false,
};

export default defineConfig({
  build: {
    sourcemap: true,
  },
  esbuild: {},
  server: {
    host: '0.0.0.0',
    port: 9090,
  },
  define: defines,
  plugins: [
    glslInner(),
    tsconfigPaths(),
  ]
});
