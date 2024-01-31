import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import ip from 'ip';
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
