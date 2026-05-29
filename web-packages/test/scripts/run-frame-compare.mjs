// 无头后台运行帧对比测试:同一 Node 进程内用 Vite JS API 起服务,
// 拉起本机 Chrome(headless + SwiftShader 软件渲染 WebGL2)跑 mocha,
// 页面跑完 POST /__test-result 回传结果,按 passes/failures 给退出码。零第三方依赖。
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const testRoot = resolve(scriptDir, '..');
const PORT = 9090;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const VALID_SUITES = ['2d', '3d', 'spine'];

function parseArgs (argv) {
  // 落盘开关纯由 CLI 控制:传 --dump 才落盘,默认关闭。
  const args = { suite: '2d', version: undefined, timeout: DEFAULT_TIMEOUT_MS, dump: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--suite') {
      args.suite = argv[++i];
    } else if (arg.startsWith('--suite=')) {
      args.suite = arg.slice('--suite='.length);
    } else if (arg === '--version') {
      args.version = argv[++i];
    } else if (arg.startsWith('--version=')) {
      args.version = arg.slice('--version='.length);
    } else if (arg === '--timeout') {
      args.timeout = Number(argv[++i]);
    } else if (arg.startsWith('--timeout=')) {
      args.timeout = Number(arg.slice('--timeout='.length));
    } else if (arg === '--dump') {
      args.dump = true;
    }
  }

  return args;
}

// runner 内联定义 result 插件,闭包持有 onResult 回调,同进程直接引用,
// 规避 Vite 配置打包导致的模块实例隔离问题。
function resultPlugin (onResult) {
  return {
    name: 'test-result-receiver',
    configureServer (server) {
      server.middlewares.use('/__test-result', (req, res, next) => {
        if (req.method !== 'POST') {
          next();

          return;
        }

        let body = '';

        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            onResult(JSON.parse(body));
          } catch (e) {
            onResult({ error: String(e), passes: 0, failures: 1, fails: [] });
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

// 接收页面端 reportProgress 的实时进度,直接打到终端,实现无头跑时的逐用例输出。
function logPlugin () {
  return {
    name: 'test-log-receiver',
    configureServer (server) {
      server.middlewares.use('/__test-log', (req, res, next) => {
        if (req.method !== 'POST') {
          next();

          return;
        }

        let body = '';

        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { message } = JSON.parse(body);

            if (message) {
              console.info(message);
            }
          } catch {
            // 忽略非法进度包
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

function findChrome () {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates = [];

  if (process.platform === 'win32') {
    const bases = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env['LOCALAPPDATA']].filter(Boolean);

    for (const base of bases) {
      candidates.push(join(base, 'Google/Chrome/Application/chrome.exe'));
      candidates.push(join(base, 'Google/Chrome Dev/Application/chrome.exe'));
      candidates.push(join(base, 'Microsoft/Edge/Application/msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.push('/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary');
    candidates.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    candidates.push('/usr/bin/google-chrome');
    candidates.push('/usr/bin/google-chrome-stable');
    candidates.push('/usr/bin/chromium');
    candidates.push('/usr/bin/chromium-browser');
  }

  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

async function main () {
  const { suite, version, timeout, dump } = parseArgs(process.argv.slice(2));

  if (!VALID_SUITES.includes(suite)) {
    console.error(`[Test] Invalid suite "${suite}". Expected one of: ${VALID_SUITES.join(', ')}`);
    process.exit(1);
  }

  const chromePath = findChrome();

  if (!chromePath) {
    console.error('[Test] Chrome executable not found. Set CHROME_PATH to your Chrome/Chromium binary.');
    process.exit(1);
  }

  let resolveResult;
  const resultPromise = new Promise(r => { resolveResult = r; });
  let settled = false;
  const onResult = payload => {
    if (settled) {
      return;
    }
    settled = true;
    resolveResult(payload);
  };

  const server = await createServer({
    configFile: resolve(testRoot, 'vite.config.js'),
    root: testRoot,
    server: { port: PORT },
    plugins: [resultPlugin(onResult), logPlugin()],
  });

  await server.listen();

  const queryParts = [];

  if (version) {
    queryParts.push(`version=${encodeURIComponent(version)}`);
  }
  if (dump) {
    queryParts.push('dumpArtifacts=1');
  }
  const query = queryParts.length ? `?${queryParts.join('&')}` : '';
  const url = `http://localhost:${PORT}/case/${suite}.html${query}`;

  console.info(`[Test] Server listening. Launching headless Chrome: ${url}`);

  const userDataDir = mkdtempSync(join(tmpdir(), 'ge-frame-compare-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    url,
  ], { stdio: 'ignore' });

  let chromeExited = false;

  chrome.on('exit', () => { chromeExited = true; });
  chrome.on('error', err => {
    console.error('[Test] Failed to launch Chrome:', err);
    onResult({ error: String(err), passes: 0, failures: 1, fails: [] });
  });

  let timeoutHandle;
  const timeoutPromise = new Promise(r => {
    timeoutHandle = setTimeout(() => r({ timedOut: true }), timeout);
  });

  const result = await Promise.race([resultPromise, timeoutPromise]);

  clearTimeout(timeoutHandle);

  if (!chromeExited) {
    try {
      chrome.kill('SIGKILL');
    } catch {
      // ignore kill failure
    }
  }
  await server.close();
  try {
    rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failure
  }

  if (result.timedOut) {
    console.error(`[Test] Timed out after ${timeout}ms waiting for test results.`);
    process.exit(1);
  }

  if (result.error) {
    console.error('[Test] Run error:', result.error);
  }

  const { passes = 0, failures = 0, duration = 0, fails = [] } = result;

  console.info(`[Test] Done. passes=${passes}, failures=${failures}, duration=${duration}ms`);
  if (fails.length) {
    console.error('[Test] Failures:');
    for (const fail of fails) {
      console.error(` - ${fail.title}\n   ${fail.error}`);
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[Test] Unexpected error:', err);
  process.exit(1);
});
