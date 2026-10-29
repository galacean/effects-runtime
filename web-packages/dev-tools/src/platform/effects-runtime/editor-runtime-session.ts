import type { Database, Engine } from '@galacean/effects';
import { Player } from '@galacean/effects';
import { viewportRenderBridge } from './viewport-render-bridge';

export class EditorRuntimeSession {
  static player: Player;
  static assetDatabase?: Database;

  static initialize (container: HTMLElement | null, createDatabase?: (engine: Engine) => Database): void {
    this.player = new Player({ container, interactive: true, env: 'editor' });
    this.player.engine.inputServer.bindListeners(null);
    this.player.renderer.addOverlayRenderer({ render: () => viewportRenderBridge.update(this.player) });
    this.assetDatabase = createDatabase?.(this.player.engine);
    if (this.assetDatabase) { this.player.engine.assetServer.database = this.assetDatabase; }
  }
}
