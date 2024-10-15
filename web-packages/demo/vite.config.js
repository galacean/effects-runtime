import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import legacy from '@vitejs/plugin-legacy';
import { viteExternalsPlugin } from 'vite-plugin-externals';
import { glslInner, getSWCPlugin } from '../../scripts/rollup-config-helper';

export default defineConfig(({ mode }) => {
  const development = mode === 'development';

  return {
    base: './',
    build: {
      rollupOptions: {
        input: {
          'index': resolve(__dirname, 'index.html'),
          'inspire-index': resolve(__dirname, 'html/inspire/index.html'),
          'inspire-player': resolve(__dirname, 'html/inspire/player.html'),
          'inspire-threejs': resolve(__dirname, 'html/inspire/threejs.html'),
          'inspire-pre-player': resolve(__dirname, 'html/inspire/pre-player.html'),
          'compressed': resolve(__dirname, 'html/compressed.html'),
          'context-lost-restore': resolve(__dirname, 'html/context-lost-restore.html'),
          'dashboard': resolve(__dirname, 'html/dashboard.html'),
          'dynamic-image': resolve(__dirname, 'html/dynamic-image.html'),
          'dynamic-video': resolve(__dirname, 'html/dynamic-video.html'),
          'interactive': resolve(__dirname, 'html/interactive.html'),
          'local-file': resolve(__dirname, 'html/local-file.html'),
          'post-processing': resolve(__dirname, 'html/post-processing.html'),
          'render-level': resolve(__dirname, 'html/render-level.html'),
          'shader-compile': resolve(__dirname, 'html/shader-compile.html'),
          'shape': resolve(__dirname, 'html/shape.html'),
          'single': resolve(__dirname, 'html/single.html'),
          'text': resolve(__dirname, 'html/text.html'),
          'rich-text': resolve(__dirname, 'html/rich-text.html'),
          'three-particle': resolve(__dirname, 'html/three-particle.html'),
          'three-sprite': resolve(__dirname, 'html/three-sprite.html'),
          'threejs-large-scene': resolve(__dirname, 'html/threejs-large-scene.html'),
        },
        context: 'undefined',
      },
      minify: false, // iOS 9 等低版本加载压缩代码报脚本异常
    },
    server: {
      host: '0.0.0.0',
      port: 8080,
    },
    preview: {
      host: '0.0.0.0',
      port: 8080,
    },
    define: {
      __VERSION__: 0,
      __DEBUG__: development,
    },
    plugins: [
      legacy({
        targets: ['iOS >= 9'],
      }),
      glslInner(),
      getSWCPlugin({
        target: 'ES6',
        baseUrl: resolve(__dirname, '..', '..'),
      }),
      tsconfigPaths(),
      viteExternalsPlugin({
        'three': 'THREE',
      }),
    ],
  };
});
