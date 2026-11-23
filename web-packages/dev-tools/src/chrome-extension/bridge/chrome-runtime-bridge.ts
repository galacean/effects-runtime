import { devtoolsChrome } from './chrome-api';
import type { ChromeDevtoolsAPI, ChromePort } from './chrome-api';
import type { RuntimeBridge, RuntimeRequest, RuntimeSnapshot } from './protocol';
import { RUNTIME_PORT, RUNTIME_PROTOCOL_VERSION, RUNTIME_READY } from './protocol';

export class ChromeRuntimeBridge implements RuntimeBridge {
  private readonly api: ChromeDevtoolsAPI = devtoolsChrome();
  private source?: Promise<string>;
  private port?: ChromePort;
  private connected?: Promise<void>;
  private disposed = false;

  async request (request: RuntimeRequest): Promise<RuntimeSnapshot> {
    if (this.disposed) { throw new Error('The inspected-page connection is closed.'); }
    await this.connect();
    if (this.disposed) { throw new Error('The inspected-page connection is closed.'); }
    const expression = 'window.__EFFECTS_DEVTOOLS_AGENT__?.version === ' + RUNTIME_PROTOCOL_VERSION + ' ? window.__EFFECTS_DEVTOOLS_AGENT__.request(' + JSON.stringify(request) + ') : null';
    let snapshot = await this.evaluate(expression) as RuntimeSnapshot | null;

    if (!snapshot) {
      this.source ??= fetch(this.api.runtime.getURL('agent.js')).then(response => {
        if (!response.ok) { throw new Error('Unable to load the runtime debugging agent.'); }

        return response.text();
      });
      await this.evaluate(await this.source + '\n; true;');
      snapshot = await this.evaluate(expression) as RuntimeSnapshot;
    }

    if (!snapshot || snapshot.version !== RUNTIME_PROTOCOL_VERSION) { throw new Error('The inspected page returned an incompatible runtime response.'); }

    return snapshot;
  }

  async suspend (): Promise<void> { if (!this.disposed) { await this.evaluate('window.__EFFECTS_DEVTOOLS_AGENT__?.suspend(); true;'); } }
  dispose (): void { this.disposed = true; this.port?.disconnect(); this.port = undefined; this.connected = undefined; }

  private connect (): Promise<void> {
    if (this.connected) { return this.connected; }
    const port = this.api.tabs.connect(this.api.devtools.inspectedWindow.tabId, { name: RUNTIME_PORT, frameId: 0 });

    this.port = port;
    this.connected = new Promise((resolve, reject) => {
      port.onMessage.addListener(message => { if (message === RUNTIME_READY) { resolve(); } });
      port.onDisconnect.addListener(() => {
        const error = this.api.runtime.lastError;

        if (this.port === port) { this.port = undefined; this.connected = undefined; }
        reject(new Error(error?.message ? 'Reload the inspected page to connect Effects DevTools. ' + error.message : 'The inspected page disconnected.'));
      });
    });

    return this.connected;
  }

  private evaluate (expression: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.api.devtools.inspectedWindow.eval(expression, (value, error) => {
        if (error?.isException || error?.isError) { reject(new Error(error.value || error.description || 'The inspected page is unavailable.')); } else { resolve(value); }
      });
    });
  }
}
