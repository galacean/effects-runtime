import type { Engine } from '@galacean/effects';
import { glContext, loadImage, SerializationHelper, spec, Texture, TextureSourceType } from '@galacean/effects';
import { blobDataURL } from '../../../platform/browser-files/blob-data-url';
import type { AssetEntry, AssetImage } from '../model/asset-types';

interface TextureSource {
  projectId(): string,
  entry(id: string): AssetEntry | undefined,
  image(id: string, projectId: string): Promise<AssetImage | undefined>,
}

export class AssetTextureCache {
  private textures = new WeakMap<Engine, Map<string, Texture>>();
  private requests = new WeakMap<Engine, Map<string, Promise<Texture>>>();
  private engines = new Set<WeakRef<Engine>>();

  constructor (private readonly source: TextureSource) {}

  registerEngine (engine: Engine): void {
    for (const reference of this.engines) {
      const current = reference.deref();

      if (current === engine) { return; }
      if (!current || current.disposed) { this.engines.delete(reference); }
    }
    this.engines.add(new WeakRef(engine));
  }

  invalidate (): void {
    this.textures = new WeakMap();
    this.requests = new WeakMap();
  }

  reset (): void {
    this.invalidate();
  }

  async refresh (entry: AssetEntry): Promise<void> {
    for (const reference of this.engines) {
      const engine = reference.deref();

      if (!engine || engine.disposed) {
        this.engines.delete(reference);
        continue;
      }
      const texture = engine.effectsObjectServer.objectInstance[entry.id];

      if (texture instanceof Texture && !texture.isDestroyed) {
        this.textures.get(engine)?.delete(entry.id);
        await this.load(engine, entry.id);
      }
    }
  }

  get (engine: Engine, id: string): Texture | undefined {
    this.registerEngine(engine);
    const entry = this.source.entry(id), object = engine.effectsObjectServer.objectInstance[id];
    const cached = this.textures.get(engine)?.get(id);
    const texture = object instanceof Texture ? object : cached?.isRegistered ? cached : undefined;

    if (texture && !texture.isDestroyed && entry?.kind === 'texture') {
      texture.name = entry.name; texture.definition.name = entry.name;

      return texture;
    }
  }

  async load (engine: Engine, id: string): Promise<Texture> {
    const projectId = this.source.projectId();
    const cached = this.textures.get(engine)?.get(id);

    this.registerEngine(engine);

    if (cached?.isRegistered && !cached.isDestroyed) { return cached; }
    let requests = this.requests.get(engine);

    if (!requests) { requests = new Map(); this.requests.set(engine, requests); }
    const pending = requests.get(id);

    if (pending) { return pending; }
    const task = (async () => {
      const entry = this.source.entry(id), source = await this.source.image(id, projectId);

      if (!entry || !source) { throw new Error('The source image is missing from the content library.'); }
      const dataURL = await blobDataURL(source.blob);
      const image = await loadImage(dataURL);

      if (projectId !== this.source.projectId()) { throw new Error('The texture belongs to a project that is no longer open.'); }

      if (this.source.entry(id)?.updatedAt !== entry.updatedAt) {
        requests.delete(id);

        return this.load(engine, id);
      }
      const existing = engine.effectsObjectServer.objectInstance[id];
      const texture = existing instanceof Texture && !existing.isDestroyed ? existing : Texture.create(engine);
      const data = { id, name: entry.name, dataType: spec.DataType.Texture as const, source: dataURL, sourceType: TextureSourceType.image as const,
        image, flipY: true, minFilter: glContext.LINEAR, magFilter: glContext.LINEAR, wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE };

      SerializationHelper.deserialize(data, texture);
      if (texture === existing) { texture.updateSource(data); }
      texture.initialize();
      engine.assetServer.addEffectsObjectData(data);
      let textures = this.textures.get(engine);

      if (!textures) { textures = new Map(); this.textures.set(engine, textures); }
      textures.set(id, texture);

      return texture;
    })().finally(() => requests.delete(id));

    requests.set(id, task);

    return task;
  }

}
