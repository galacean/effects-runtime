import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import legacy from '@vitejs/plugin-legacy';
import { glslInner, getSWCPlugin } from '../../scripts/rollup-config-helper';

export default defineConfig(({ mode }) => {
  const development = mode === 'development';

  return {
    base: './',
    build: {
      rollupOptions: {
        input: {
          'index': resolve(__dirname, 'demo/index.html'),
          'simple': resolve(__dirname, 'demo/simple.html'),
        }
      },
      minify: false, // iOS 9 等低版本加载压缩代码报脚本异常
    },
    server: {
      host: '0.0.0.0',
      port: 8081,
    },
    preview: {
      host: '0.0.0.0',
      port: 8081,
    },
    define: {
      __VERSION__: 0,
      __DEBUG__: development,
    },
    plugins: [
      legacy({
        targets: ['iOS >= 9'],
        modernPolyfills: ['es/global-this'],
      }),
      glslInner(),
      getSWCPlugin({
        baseUrl: resolve(__dirname, '..', '..'),
      }),
      tsconfigPaths(),
    ],
  };
});
