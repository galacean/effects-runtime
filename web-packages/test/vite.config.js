import { resolve, normalize, dirname, sep } from 'path';
import { writeFile, mkdir } from 'node:fs/promises';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { glslInner, getSWCPlugin, wasm } from '../../scripts/rollup-config-helper';

const defines = {
  __VERSION__: 0,
  __DEBUG__: true,
};

// 帧对比差异产物落盘:接收前端 POST /__test-artifact,把图片/文本写入 case/.test-artifacts。
// 始终注册,手动 `pnpm test` 与无头 `pnpm test:frame` 都能落盘。
function artifactSaverPlugin () {
  const baseDir = resolve(__dirname, 'case/.test-artifacts');

  return {
    name: 'test-artifact-saver',
    configureServer (server) {
      server.middlewares.use('/__test-artifact', (req, res, next) => {
        if (req.method !== 'POST') {
          next();

          return;
        }

        let body = '';

        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          void (async () => {
            try {
              const { path: relPath, data, encoding } = JSON.parse(body);
              // 路径安全:剥离前导 ..,resolve 后校验仍在 baseDir 内,越界返回 400。
              const normalized = normalize(String(relPath || '')).replace(/^(\.\.[/\\])+/, '');
              const target = resolve(baseDir, normalized);

              if (target !== baseDir && !target.startsWith(baseDir + sep)) {
                res.statusCode = 400;
                res.end('Invalid artifact path');

                return;
              }

              await mkdir(dirname(target), { recursive: true });
              await writeFile(target, Buffer.from(data, encoding === 'base64' ? 'base64' : 'utf8'));
              res.statusCode = 200;
              res.end('OK');
            } catch (e) {
              res.statusCode = 400;
              res.end(`Bad Request: ${e && e.message}`);
            }
          })();
        });
      });
    },
  };
}

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
    artifactSaverPlugin(),
  ],
});
