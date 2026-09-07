import type { Asset } from '@galacean/effects';
import { EffectsObject, SerializationHelper, spec } from '@galacean/effects';
import type { EditorContent } from '../content';

/**
 * Expands editor-only JsonAsset references into the existing JSONScene layout.
 * It does not introduce a new published format.
 */
export class JsonSceneCooker {
  constructor (private readonly content: EditorContent) {
  }

  async cook (source: spec.JSONScene): Promise<spec.JSONScene> {
    const scene = structuredClone(source);
    const pending = Array.from(this.collectReferences(scene));
    const visited = new Set<string>();

    while (pending.length > 0) {
      const id = pending.pop()!;

      if (visited.has(id)) {
        continue;
      }
      visited.add(id);

      const asset = await this.content.loadGraph(id);

      if (!asset) {
        throw new Error(`Failed to cook missing JsonAsset '${id}'.`);
      }

      this.addAsset(scene, asset);
      for (const dependency of this.content.getDependencies(id)) {
        pending.push(dependency);
      }
    }

    return this.convertReferences(scene) as spec.JSONScene;
  }

  private addAsset (scene: spec.JSONScene, asset: Asset): void {
    const serialized = {
      ...SerializationHelper.serialize(asset),
    } as spec.EffectsObjectData & Record<string, unknown>;

    if (serialized.dataType === spec.DataType.Texture) {
      // EditorContent prepares DOM upload sources at runtime. Published
      // JSONScene must retain only its serializable `source`/binary fields so
      // AssetManager can decode them for the target Player.
      delete serialized.image;
      delete serialized.video;
      delete serialized.cube;
    }
    const data = this.convertReferences({
      ...serialized,
      id: asset.getInstanceId(),
    }) as spec.EffectsObjectData;

    switch (data.dataType) {
      case spec.DataType.Material:
        upsert(scene.materials, data as spec.MaterialData);

        break;
      case spec.DataType.Shader:
        upsert(scene.shaders, data as spec.ShaderData);

        break;
      case spec.DataType.Geometry:
        upsert(scene.geometries, data as spec.GeometryData);

        break;
      case spec.DataType.AnimationClip:
      case spec.DataType.AnimationGraphAsset:
        upsert(scene.animations, data as spec.AnimationClipData);

        break;
      case spec.DataType.Texture:
        scene.textures ??= [];
        upsert(scene.textures as Array<spec.EffectsObjectData>, data);

        break;
      default:
        upsert(scene.miscs, data);

        break;
    }
  }

  private collectReferences (value: unknown, result = new Set<string>()): Set<string> {
    if (!value || typeof value !== 'object') {
      return result;
    }
    if (value instanceof EffectsObject) {
      const id = value.getInstanceId();

      if (this.content.getAssetInfo(id)) {
        result.add(id);
      }

      return result;
    }
    if (SerializationHelper.checkDataPath(value)) {
      const info = this.content.getAssetInfo(value.id);

      if (info) {
        result.add(info.id);
      }

      return result;
    }
    if (Array.isArray(value)) {
      value.forEach(entry => this.collectReferences(entry, result));

      return result;
    }

    Object.values(value).forEach(entry => this.collectReferences(entry, result));

    return result;
  }

  private convertReferences (value: unknown): unknown {
    if (value instanceof EffectsObject) {
      return { id: value.getInstanceId() };
    }
    // Published JSONScene references are already in their final shape. Keep
    // them intact instead of recursively converting their `id` field.
    if (SerializationHelper.checkDataPath(value)) {
      return { id: value.id };
    }
    if (Array.isArray(value)) {
      return value.map(entry => this.convertReferences(entry));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }

    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      // `id` on a full EffectsObjectData is object identity, not an asset
      // reference. References represented by an object were handled above.
      result[key] = key === 'id' ? entry : this.convertReferences(entry);
    }

    return result;
  }
}

function upsert<T extends { id: string }> (collection: T[], data: T): void {
  const index = collection.findIndex(entry => entry.id === data.id);

  if (index === -1) {
    collection.push(data);
  } else {
    collection[index] = data;
  }
}
