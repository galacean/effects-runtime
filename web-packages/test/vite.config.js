import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { glslInner, getSWCPlugin } from '../../scripts/rollup-config-helper';

const defines = {
  __VERSION__: 0,
  __DEBUG__: false,
};

export default defineConfig({
  build: {
    sourcemap: true,
  },
  server: {
    host: '0.0.0.0',
    port: 9090,
  },
  define: defines,
  plugins: [
    glslInner(),
    getSWCPlugin(),
    tsconfigPaths(),
  ]
});
