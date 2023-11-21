import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import legacy from '@vitejs/plugin-legacy';
import glslInner from '../../scripts/rollup-plugin-glsl-inner';

export default defineConfig(({ mode }) => {
  const development = mode === 'development';

  return {
    base: './',
    build: {
      rollupOptions: {
        input: {
          'index': resolve(__dirname, 'demo/index.html'),
          'simple': resolve(__dirname, 'demo/simple.html'),
          'mobile': resolve(__dirname, 'demo/mobile.html'),
        }
      },
      minify: false, // iOS 9 等低版本加载压缩代码报脚本异常
    },
    esbuild: {},
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
      __DEBUG__: development ? true : false,
    },
    plugins: [
      legacy({
        targets: ['iOS >= 9'],
      }),
      glslInner(),
      tsconfigPaths(),
    ],
  };
});
