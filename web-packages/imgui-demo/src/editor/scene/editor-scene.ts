import { Camera, Composition, CompositionComponent, HideFlags } from '@galacean/effects';
import type { Engine, Scene, spec } from '@galacean/effects';
import type { SceneComposition } from './scene-graph';

/** Renders the document objects without advancing their playback clock. */
export class EditorScene extends Composition {
  constructor (engine: Engine, scene: SceneComposition | Scene, settings?: spec.RenderSettings) {
    const loaded = 'jsonScene' in scene ? scene : undefined;

    super(engine, { reusable: true }, loaded);
    if (loaded) {
      this.gotoAndStop(0);
    } else {
      const composition = scene as SceneComposition;

      // The viewport owns the canvas boundary; only composition.root belongs to the file.
      this.sceneRoot.hideFlags = HideFlags.DontSave;
      this.camera.copy(new Camera(composition.root.name, { ...composition.camera, aspect: this.width / this.height }));
      this.postProcessingEnabled = settings?.postProcessingEnabled ?? false;
      this.renderFrame.dispose();
      this.createRenderFrame();
      composition.root.setParent(this.sceneRoot);
    }
  }

  override update (): void {
    let order = 0;

    for (const item of this.sceneRoot.getDescendants()) {
      if (!item.isManuallySetRenderOrder) {item.setRendererComponentOrder(order++);}
    }
    // Renderer and layout components update against the same objects as Inspector.
    // CompositionComponent evaluates animation and must not overwrite authored values.
    for (const component of this.sceneTicking.update.components) {
      if (!(component instanceof CompositionComponent)) {component.onUpdate(0);}
    }
    this.sceneTicking.lateUpdate.tick(0);
    this.camera.aspect = this.width / this.height;
  }
}
