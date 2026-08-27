import { Composition, Player } from '@galacean/effects';
import { GUIRootComponent, UICanvas } from '@galacean/effects-plugin-gui';
import type { AppContext } from './context';
import { ControlApp } from './app';
import { attachFullRect } from './layout';
import { createDemoState, persistAppearance } from './state';
import { applyTheme, getRuntimeTheme } from './theme';

export function boot (): void {
  const state = createDemoState();

  applyTheme(state.theme, state.accent, state.customAccent);
  const player = new Player({
    container: document.body,
    interactive: true,
    env: 'editor',
  });
  const composition = new Composition(player.engine);

  const uiCanvas = composition.sceneRoot.getComponent(UICanvas);
  const guiRoot = player.engine.root.getComponent(GUIRootComponent);

  if (!uiCanvas || !guiRoot) {
    throw new Error('GUI plugin failed to initialize.');
  }
  uiCanvas.rootControl.theme = getRuntimeTheme();
  let app: ControlApp;
  let rebuildQueued = false;
  let disposed = false;
  const context: AppContext = {
    state,
    navigate: page => app.selectPage(page),
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
        guiRoot.windowRoot.guiReleaseFocus();
        guiRoot.windowRoot.cancelPointerInput();
        applyTheme(state.theme, state.accent, state.customAccent);
        app.dispose();
        app = new ControlApp(player.engine, context);
        attachFullRect(app, uiCanvas.rootControl);
      });
    },
  };

  app = new ControlApp(player.engine, context);
  attachFullRect(app, uiCanvas.rootControl);
  window.addEventListener('resize', () => player.resize());
  window.addEventListener('beforeunload', () => {
    disposed = true;
    player.dispose();
  }, { once: true });
  player.play();
}
