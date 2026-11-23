import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { glslInner, getSWCPlugin } from '../../scripts/rollup-config-helper';

export default defineConfig(({ mode }) => {
  const development = mode === 'development';

  return {
    base: './',
    server: {
      host: '0.0.0.0',
      port: 8088,
    },
    define: {
      __VERSION__: 0,
      __DEBUG__: development ? true : false,
    },
    plugins: [
      glslInner(),
      getSWCPlugin({
        target: 'ES6',
        baseUrl: resolve(__dirname, '..', '..'),
      }),
      tsconfigPaths(),
    ],
  };
});
