import type { Database, Engine } from '@galacean/effects';
import { Player, RenderingDevice } from '@galacean/effects';
import { ImGuiTextureBinding } from '../imgui/texture-binding';
import { EditorRenderingDevice } from './editor-rendering-device';

export class EditorRuntimeSession {
  static player: Player;
  static assetDatabase?: Database;
  static device: EditorRenderingDevice;
  static readonly viewportTexture = new ImGuiTextureBinding(() => this.device?.sceneTexture ?? null, true);
  private static lastTime = 0;

  static initialize (container: HTMLElement | null, surface: HTMLCanvasElement, createDatabase?: (engine: Engine) => Database): void {
    if (!container) { throw new Error('The scene viewport container is missing.'); }
    const canvas = document.createElement('canvas');

    canvas.style.visibility = 'hidden'; canvas.style.pointerEvents = 'none'; container.appendChild(canvas);
    const createDevice = RenderingDevice.create;

    RenderingDevice.create = engine => engine.canvas === canvas ? EditorRenderingDevice.forSurface(engine, surface) : createDevice(engine);
    try {
      this.player = new Player({ canvas, interactive: true, env: 'editor', manualRender: true, doNotHandleContextLost: false });
    } finally { RenderingDevice.create = createDevice; }
    this.device = this.player.engine.displayServer.renderingDevice as EditorRenderingDevice;
    this.player.engine.inputServer.bindListeners(null);
    this.assetDatabase = createDatabase?.(this.player.engine);
    if (this.assetDatabase) { this.player.engine.assetServer.database = this.assetDatabase; }
  }

  static render (time: number): void {
    const delta = this.lastTime ? Math.max(0, time - this.lastTime) : 0;

    this.lastTime = time;
    if (this.device.contextWasLost || this.device.gl.isContextLost()) { return; }
    this.device.prepareFrame(); this.player.tick(delta);
  }

  static resetClock (): void { this.lastTime = 0; }
}
