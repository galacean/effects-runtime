export interface ChromeEvent<T extends (...args: any[]) => void> { addListener(listener: T): void, removeListener(listener: T): void }
export interface ChromePort {
  name: string,
  onMessage: ChromeEvent<(message: unknown) => void>,
  onDisconnect: ChromeEvent<() => void>,
  postMessage(message: unknown): void,
  disconnect(): void,
}
export interface ChromeRuntimeAPI {
  getURL(path: string): string,
  lastError?: { message?: string },
  onConnect: ChromeEvent<(port: ChromePort) => void>,
}
export interface DevtoolsPanelWindow extends Window {
  effectsDevtoolsPanel?: { setVisible(visible: boolean): void },
  effectsDevtoolsPanelVisible?: boolean,
}
export interface ChromeDevtoolsAPI {
  runtime: ChromeRuntimeAPI,
  tabs: { connect(tabId: number, options: { name: string, frameId: number }): ChromePort },
  devtools: {
    inspectedWindow: {
      tabId: number,
      eval(expression: string, callback: (result: unknown, error?: { isException?: boolean, isError?: boolean, value?: string, description?: string }) => void): void,
    },
    panels: {
      create(title: string, icon: string, page: string, callback: (panel: {
        onShown: ChromeEvent<(window: DevtoolsPanelWindow) => void>,
        onHidden: ChromeEvent<() => void>,
      }) => void): void,
    },
    network: { onNavigated: ChromeEvent<(url: string) => void> },
  },
}

export function devtoolsChrome (): ChromeDevtoolsAPI {
  const api = (globalThis as unknown as { chrome?: ChromeDevtoolsAPI }).chrome;

  if (!api?.devtools?.inspectedWindow) { throw new Error('Open Effects from the Chrome DevTools panel.'); }

  return api;
}
