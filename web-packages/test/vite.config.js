import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { glslInner, getSWCPlugin, wasm } from '../../scripts/rollup-config-helper';

const defines = {
  __VERSION__: 0,
  __DEBUG__: true,
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
    wasm({
      targetEnv: 'auto-inline', // auto-inline
    }),
    getSWCPlugin({
      baseUrl: resolve(__dirname, '..', '..'),
    }),
    tsconfigPaths(),
  ],
});
