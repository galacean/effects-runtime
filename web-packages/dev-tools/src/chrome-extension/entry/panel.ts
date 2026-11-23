import { EditorSurface } from '../../platform/editor-surface';
import { ChromeRuntimeBridge } from '../bridge/chrome-runtime-bridge';
import { RuntimeConnection } from '../bridge/runtime-connection';
import type { DevtoolsPanelWindow } from '../bridge/chrome-api';
import { RuntimeInspectorApplication } from '../application';
import { loadControlIcons } from '../../ui/icons/control-icons';

async function initialize (): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#effects-panel');

  if (!canvas) { throw new Error('The runtime panel canvas is missing.'); }
  const surface = new EditorSurface();

  await surface.initialize(canvas); await loadControlIcons(surface.engine);
  const connection = new RuntimeConnection(new ChromeRuntimeBridge());
  const application = new RuntimeInspectorApplication(connection);

  application.initialize(surface.engine, surface.root);
  let visible = (window as DevtoolsPanelWindow).effectsDevtoolsPanelVisible ?? true, disposed = false;

  connection.setVisible(visible);
  (window as DevtoolsPanelWindow).effectsDevtoolsPanel = { setVisible: value => { visible = value; connection.setVisible(value); } };
  const frame = (time: number): void => {
    if (disposed) { return; }
    requestAnimationFrame(frame);
    if (!visible || surface.device.contextWasLost || surface.device.gl.isContextLost()) { return; }
    const delta = application.tick(time);

    surface.update(delta); surface.render();
  };

  window.addEventListener('pagehide', () => { disposed = true; application.dispose(); surface.dispose(); delete (window as DevtoolsPanelWindow).effectsDevtoolsPanel; }, { once: true });
  requestAnimationFrame(frame);
}

void initialize().catch(error => {
  const output = document.getElementById('effects-error');

  if (output) { output.hidden = false; output.textContent = error instanceof Error ? error.stack ?? error.message : String(error); }
  console.error(error);
});
