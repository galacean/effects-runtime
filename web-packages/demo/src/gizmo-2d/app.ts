import { Composition, Player, math } from '@galacean/effects';
import { GestureHandler, selectionSnapConfig, viewportNavigationConfig, viewportOverlayConfig } from '@galacean/effects-plugin-editor-gizmo';
import { UICanvas } from '@galacean/effects-plugin-gui';
import { DOMEvents, element } from './dom';
import { DemoEditor } from './editor';
import { DemoScene } from './scene';
import { DemoView } from './view';

/** 装配运行时、场景、交互和视图，并管理整个 Demo 的生命周期。 */
export class GizmoDemo {
  private readonly events = new DOMEvents();
  private readonly unsubscribes: (() => void)[] = [];
  private readonly status = element('status');
  private readonly player: Player;
  private readonly handler: GestureHandler;
  private readonly editor: DemoEditor;
  private readonly view: DemoView;
  private started = false;
  private disposed = false;

  constructor () {
    const viewport = element('viewport');

    this.player = new Player({
      container: viewport,
      interactive: true,
      env: 'editor',
      onError: error => this.reportError(error.message, error),
    });
    const composition = new Composition(this.player.engine);

    composition.camera.fov = 45;
    composition.camera.position = new math.Vector3(0, 0, 12);
    const uiCanvas = composition.sceneRoot.getComponent(UICanvas);

    if (!uiCanvas) {
      throw new Error('GUI canvas failed to initialize.');
    }
    this.handler = new GestureHandler(this.player.engine);
    this.handler.parent = uiCanvas.rootControl;
    this.handler.setAnchorsAndOffsetsPreset('fullRect');
    this.handler.setErrorMonitor({
      report: (error, phase, context) => {
        this.reportError(`${context.gizmoType ?? 'gizmo'} / ${phase}: ${String(error)}`, error);
      },
    });
    this.configureViewport();
    const scene = new DemoScene(this.player, composition);
    const initialSelection = scene.createDefaultItems();

    this.editor = new DemoEditor(this.player, scene, this.handler, viewport);
    this.view = new DemoView(scene, this.editor);
    this.unsubscribes.push(
      this.editor.on('scenechange', () => this.view.refreshScene()),
      this.editor.on('selectionchange', () => this.view.refreshSelection()),
      this.editor.on('toolchange', tool => this.view.showTool(tool)),
      this.editor.on('viewportchange', scale => this.view.showZoom(scale)),
      this.editor.on('action', label => this.view.recordAction(label)),
      this.player.on('update', () => this.view.refreshSelection()),
    );
    this.events.on(window, 'resize', () => this.player.resize());
    this.events.on(window, 'beforeunload', () => this.dispose());
    this.editor.select(initialSelection);
  }

  start (): void {
    if (this.disposed || this.started) {
      return;
    }
    this.started = true;
    this.player.play();
  }

  dispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.player.pause();
    this.events.dispose();
    this.unsubscribes.splice(0).forEach(unsubscribe => unsubscribe());
    this.view.dispose();
    this.editor.dispose();
    this.handler.dispose();
    this.player.dispose();
  }

  private configureViewport (): void {
    const configs = this.handler.getConfigManager();

    configs.set(viewportNavigationConfig, { scrollWheelZoom: false });
    configs.set(selectionSnapConfig, { enabled: true });
    configs.set(viewportOverlayConfig, { outerMaskEnabled: false, boxColor: 0xe0e0e0 });
    this.handler.getViewportNavigation().setScaleRange(0.2, 5);
  }

  private reportError (message: string, error: unknown): void {
    this.status.textContent = message;
    this.status.dataset.error = 'true';
    console.error(error);
  }
}
