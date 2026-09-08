import { CompositionComponent, VFXItem } from '@galacean/effects';
import type { EffectsObject, Engine, spec } from '@galacean/effects';
import { Control, Label, UIControl } from '@galacean/effects-plugin-gui';
import { SceneSerializer } from './scene-serializer';
import { SceneLoader } from './scene-loader';
import type { SceneGraph } from './scene-graph';
import { EditorContent } from '../content';
import { JsonSceneCooker } from '../cooker/json-scene-cooker';
import { EditorScene } from './editor-scene';
import { removeTimelineBindings } from './scene-timeline';

/** Owns the editable objects rendered by the scene viewport. The Engine is borrowed. */
export class SceneDocument {
  readonly scene: SceneGraph;
  private revision = 0;
  private savedRevision = 0;
  private viewport?: EditorScene;
  fileHandle?: FileSystemFileHandle;
  private readonly transformListeners = new Map<VFXItem, () => void>();

  static async open (engine: Engine, data: spec.JSONScene | string, name = 'scene.json'): Promise<SceneDocument> {
    const loaded = await SceneLoader.load(engine, data);

    try {
      const scene = SceneSerializer.deserialize(loaded.data, engine);

      scene.assets = loaded.assets;
      scene.resources = loaded.resources;

      return new SceneDocument(engine, scene, name);
    } catch (error) {
      for (const { asset } of loaded.assets) {
        engine.content.unloadAsset(asset);
        delete engine.jsonSceneData[asset.getInstanceId()];
      }
      loaded.resources.dispose();
      throw error;
    }
  }

  async previewData (): Promise<spec.JSONScene> {
    const snapshot = this.snapshot();

    return this.engine.content instanceof EditorContent ? new JsonSceneCooker(this.engine.content).cook(snapshot) : snapshot;
  }

  constructor (readonly engine: Engine, data: spec.JSONScene | SceneGraph, public name = 'scene.json') {
    this.scene = 'items' in data ? SceneSerializer.deserialize(data, engine) : data;
    try {
      for (const { root } of this.scene.compositions) {
        if (root.getComponent(UIControl)) {
          throw new Error('The composition root cannot have a UIControl. Place it on a child item.');
        }
      }
      SceneSerializer.initialize(this.scene);
      this.observeTransforms();
    } catch (error) {
      for (const { root } of this.scene.compositions) {root.dispose();}
      throw error;
    }
  }

  get root (): VFXItem {
    return this.scene.compositions.find(entry => entry.root.getInstanceId() === this.scene.compositionId)!.root;
  }

  snapshot (): spec.JSONScene {
    return SceneSerializer.serialize(this.scene);
  }

  serialize (): string {
    return JSON.stringify(this.snapshot(), null, 2);
  }

  get isDirty (): boolean {
    return this.revision !== this.savedRevision;
  }

  async save (handle: FileSystemFileHandle): Promise<void> {
    const revision = this.revision;
    const snapshot = this.serialize();
    const writable = await handle.createWritable();

    try {
      await writable.write(snapshot);
      await writable.close();
    } catch (error) {
      await writable.abort?.().catch(() => {});
      throw error;
    }
    this.fileHandle = handle;
    this.name = handle.name;
    this.markSaved(revision);
  }

  get currentRevision (): number { return this.revision; }

  markSaved (revision = this.revision): void {
    this.savedRevision = revision;
  }

  markModified (object?: EffectsObject): void {
    this.revision++;
    this.viewport?.markModified(object);
  }

  private observeTransforms (): void {
    for (const { root } of this.scene.compositions) {
      for (const item of [root, ...root.getDescendants()]) {
        if (this.transformListeners.has(item)) {continue;}
        const changed = () => this.markModified(item);

        item.transform.on('changed', changed);
        this.transformListeners.set(item, changed);
      }
    }
  }

  getPreviewObject<T extends EffectsObject> (object: T): T | undefined {
    return this.viewport?.objects.copies.get(object) as T | undefined;
  }

  getAuthoredObject<T extends EffectsObject> (object: T): T | undefined {
    return this.viewport?.objects.originals.get(object) as T | undefined;
  }

  setPlaying (playing: boolean): void {
    this.rebuildPreview(playing);
  }

  private rebuildPreview (playing = false): void {
    const camera = this.viewport?.camera;

    this.viewport?.dispose();
    this.viewport = undefined;
    const viewport = this.show(playing);

    if (camera && !playing) {viewport.camera.copy(camera);}
  }

  show (playing = false): EditorScene {
    if (!this.viewport) {
      const composition = this.scene.compositions.find(entry => entry.root === this.root)!;

      const viewport = new EditorScene(this.engine, composition.root, playing);

      try {
        viewport.initialize(composition, this.scene.renderSettings);
        this.viewport = viewport;
      } finally {
        // Only publish a fully initialized viewport; release partial allocations on failure.
        if (this.viewport !== viewport) {viewport.dispose();}
      }
    }

    return this.viewport;
  }

  owns (item: VFXItem): boolean {
    return this.scene.compositions.some(({ root }) => item === root || root.getDescendants().includes(item));
  }

  createControl (parent: VFXItem = this.root, kind: 'Control' | 'Label' = 'Label'): VFXItem {
    if (!this.owns(parent)) {throw new Error('Parent is outside the document.');}
    const item = new VFXItem(this.engine);

    item.name = kind;
    item.duration = parent.duration;
    item.endBehavior = parent.endBehavior;
    item.setParent(parent);
    item.addComponent(UIControl).control = kind === 'Label'
      ? new Label(this.engine, 'New label') : new Control(this.engine);
    item.getComponent(UIControl).control!.setSize(160, 40);
    item.initializeHierarchy();
    this.observeTransforms();
    if (this.viewport) {this.rebuildPreview();}
    this.markModified();

    return item;
  }

  reparent (item: VFXItem, parent: VFXItem): void {
    if (!this.owns(item) || !this.owns(parent) || this.scene.compositions.some(entry => entry.root === item) ||
      item === parent || item.getDescendants().includes(parent)) {
      throw new Error('Invalid scene parent.');
    }
    if (item.parent === parent) {return;}
    item.setParent(parent);
    if (this.viewport) {this.rebuildPreview();}
    this.markModified();
  }

  remove (item: VFXItem): void {
    if (!this.owns(item) || this.scene.compositions.some(entry => entry.root === item)) {
      throw new Error('Cannot delete a composition root.');
    }
    removeTimelineBindings(this.scene, new Set([item, ...item.getDescendants()]));
    for (const removed of [item, ...item.getDescendants()]) {
      const listener = this.transformListeners.get(removed);

      if (listener) {removed.transform.off('changed', listener);}
      this.transformListeners.delete(removed);
    }
    item.dispose();
    if (this.viewport) {this.rebuildPreview();}
    this.markModified();
  }

  dispose (): void {
    this.viewport?.dispose();
    this.viewport = undefined;
    for (const [item, listener] of this.transformListeners) {item.transform.off('changed', listener);}
    this.transformListeners.clear();
    for (const { root } of this.scene.compositions) {root.dispose();}
    for (const { asset } of this.scene.assets ?? []) {
      this.engine.content.unloadAsset(asset);
      delete this.engine.jsonSceneData[asset.getInstanceId()];
    }
    this.scene.assets = [];
    this.scene.resources?.dispose();
  }
}
