import { Camera, Composition, CompositionComponent, UpdateModes, VFXItem } from '@galacean/effects';
import type { EffectsObject, Engine, spec } from '@galacean/effects';
import type { SceneComposition } from './scene-graph';
import { PreviewObjects } from './preview-objects';

/** The viewport runs copies of the document's objects, never the authored tree. */
export class EditorScene extends Composition {
  readonly objects: PreviewObjects;
  private readonly pending = new Set<EffectsObject>();

  constructor (engine: Engine, root: VFXItem, readonly playing = false) {
    super(engine, { reusable: true });
    this.objects = new PreviewObjects(engine, root);
  }

  initialize (scene: SceneComposition, settings?: spec.RenderSettings): void {
    this.camera.copy(new Camera(scene.root.name, { ...scene.camera, aspect: this.width / this.height }));
    this.postProcessingEnabled = settings?.postProcessingEnabled ?? false;
    this.renderFrame.dispose();
    this.createRenderFrame();
    this.objects.initialize();
    const runtimeRoot = this.objects.copies.get(scene.root) as VFXItem;

    runtimeRoot.initializeHierarchy();
    runtimeRoot.setParent(this.sceneRoot);
    this.sceneRoot.duration = runtimeRoot.duration;
    this.sceneRoot.endBehavior = runtimeRoot.endBehavior;
    this.rootComposition = runtimeRoot.getComponent(CompositionComponent) ?? runtimeRoot.addComponent(CompositionComponent);
    this.rootComposition.updateMode = UpdateModes.Manual;
    this.rootComposition.play();
    if (this.playing) {this.resume();}
  }

  markModified (object?: EffectsObject): void {
    if (object) {
      this.pending.add(object);
      if (object instanceof VFXItem) {
        for (const component of object.components) {this.pending.add(component);}
      }
    } else {
      for (const source of this.objects.copies.keys()) {this.pending.add(source);}
    }
  }

  override update (deltaTime: number): void {
    if (this.playing) {
      super.update(deltaTime);

      return;
    }
    for (const object of this.pending) {this.objects.sync(object);}
    this.pending.clear();
    let order = 0;

    for (const item of this.sceneRoot.getDescendants()) {
      if (!item.isManuallySetRenderOrder) {item.setRendererComponentOrder(order++);}
    }
    for (const component of this.sceneTicking.update.components) {
      if (!(component instanceof CompositionComponent)) {component.onUpdate(0);}
    }
    this.sceneTicking.lateUpdate.tick(0);
    this.camera.aspect = this.width / this.height;
  }

  override dispose (): void {
    super.dispose();
    this.objects.dispose();
  }
}
