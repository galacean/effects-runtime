const PROGRESS_ENDPOINT = '/__test-log';

// 实时进度上报:同时打到浏览器控制台(手动 `pnpm test`)与无头 runner 终端(经 /__test-log)。
// 端点不存在时 fetch 静默失败,无副作用。
export function reportProgress (message: string) {
  console.info(message);

  if (typeof fetch !== 'function') {
    return;
  }

  fetch(PROGRESS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  }).catch(() => { /* 端点不存在(手动跑)时静默 */ });
}
