import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import legacy from '@vitejs/plugin-legacy';
import ip from 'ip';
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
          'mock-fail': resolve(__dirname, 'demo/mock-fail.html'),
          'alipay-mini-app': resolve(__dirname, 'demo/alipay-mini-app.html'),
          'wechat-mini-app': resolve(__dirname, 'demo/wechat-mini-app.html'),
          'user-agent': resolve(__dirname, 'demo/user-agent.html'),
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
      __DEBUG__: development ? true : false,
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
      configureServerPlugin(),
    ],
  };
});

// 用于配置开发服务器的钩子
function configureServerPlugin() {
  const handleServer = function (server) {
    const host = ip.address() ?? 'localhost';
    const port = server.config.server.port;
    const baseUrl = `http://${host}:${port}`;

    setTimeout(() => {
      console.log(`  \x1b[1m\x1b[32m->\x1b[97m Demo: \x1b[0m\x1b[96m${baseUrl}/demo/index.html\x1b[0m`);
      console.log(`  \x1b[1m\x1b[32m->\x1b[97m Test: \x1b[0m\x1b[96m${baseUrl}/test/index.html\x1b[0m`);
    }, 1000);
  }

  return {
    name: 'configure-server',
    configurePreviewServer(server) {
      server.httpServer.once('listening', handleServer.bind(this, server));
    },
    configureServer(server) {
      server.httpServer.once('listening', handleServer.bind(this, server));
    },
  }
}
