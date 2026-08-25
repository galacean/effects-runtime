import { Composition, Player } from '@galacean/effects';
import type { AppContext } from './context';
import { ControlApp } from './app';
import { attachFullRect } from './layout';
import { createDemoState, persistAppearance } from './state';
import { applyTheme } from './theme';

export function boot (): void {
  const state = createDemoState();

  applyTheme(state.theme, state.accent, state.customAccent);
  const player = new Player({
    container: document.body,
    interactive: true,
    env: 'editor',
  });
  const composition = new Composition(player.engine);
  let app: ControlApp;
  let rebuildQueued = false;
  let disposed = false;
  const context: AppContext = {
    state,
    requestRebuild: () => {
      persistAppearance(state);
      if (rebuildQueued || disposed) {
        return;
      }
      rebuildQueued = true;
      queueMicrotask(() => {
        rebuildQueued = false;
        if (disposed) {
          return;
        }
        player.engine.windowRoot.guiReleaseFocus();
        player.engine.windowRoot.cancelPointerInput();
        applyTheme(state.theme, state.accent, state.customAccent);
        app.dispose();
        app = new ControlApp(player.engine, context);
        attachFullRect(app, composition.uiCanvas.rootControl);
      });
    },
  };

  app = new ControlApp(player.engine, context);
  attachFullRect(app, composition.uiCanvas.rootControl);
  window.addEventListener('resize', () => player.resize());
  window.addEventListener('beforeunload', () => {
    disposed = true;
    player.dispose();
  }, { once: true });
  player.play();
}
