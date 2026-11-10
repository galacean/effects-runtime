import type { ChromeRuntimeAPI } from '../bridge/chrome-api';
import { RUNTIME_DISCONNECT, RUNTIME_PORT, RUNTIME_READY } from '../bridge/protocol';

const runtime = (globalThis as unknown as { chrome: { runtime: ChromeRuntimeAPI } }).chrome.runtime;

runtime.onConnect.addListener(port => {
  if (port.name !== RUNTIME_PORT) { return; }
  port.onDisconnect.addListener(() => window.postMessage({ type: RUNTIME_DISCONNECT }, '*'));
  port.postMessage(RUNTIME_READY);
});
