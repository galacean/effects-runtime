import type * as spec from '@galacean/effects-specification';
import { Asset } from './asset';
import { getClass, getEffectsClassName } from './decorators';
import type { Engine } from './engine';
import { SerializationHelper } from './serialization-helper';
import type { Constructor } from './utils';
import { generateGUID, logger } from './utils';

/**
 * Loads and owns the assets available in the current Engine content pool.
 *
 * Runtime content is deliberately GUID-only. Paths, asset discovery and file
 * access are editor responsibilities implemented by EditorContent.
 */
export class Content {
  protected readonly assets = new Map<string, Asset>();

  constructor (protected readonly engine: Engine) {
  }

  loadAsync<T extends Asset> (id: string, expectedType?: Constructor<T>): T | undefined {
    const loaded = this.getAsset<T>(id);

    if (loaded) {
      return this.checkType(loaded, expectedType, id);
    }

    const data = this.engine.findEffectsObjectData(id);

    if (!data) {
      return undefined;
    }

    return this.loadAssetData(data, expectedType);
  }

  async load<T extends Asset> (id: string, expectedType?: Constructor<T>): Promise<T | undefined> {
    const asset = this.loadAsync(id, expectedType);

    if (!asset) {
      return undefined;
    }

    try {
      await asset.waitForLoaded();

      return asset;
    } catch {
      return undefined;
    }
  }

  getAsset<T extends Asset> (id: string): T | undefined {
    return this.assets.get(id) as T | undefined;
  }

  getAssets<T extends Asset> (expectedType?: Constructor<T>): T[] {
    const assets = Array.from(this.assets.values());

    if (!expectedType) {
      return assets as T[];
    }

    return assets.filter(asset => asset instanceof expectedType) as T[];
  }

  unloadAsset (asset: Asset): void {
    if (this.assets.get(asset.getInstanceId()) !== asset) {
      return;
    }
    this.assets.delete(asset.getInstanceId());
    asset.dispose();
  }

  createVirtualAsset<T extends Asset> (type: Constructor<T>): T {
    const typeName = getEffectsClassName(type);

    if (!typeName) {
      throw new Error(`Asset class ${type.name} is not registered with effectsClass.`);
    }
    const registeredType = getClass<T>(typeName);

    if (!registeredType) {
      throw new Error(`Asset TypeName '${typeName}' has no registered constructor.`);
    }

    const asset = new registeredType(this.engine);

    if (!(asset instanceof type)) {
      asset.dispose();
      throw new Error(`Registered constructor for '${typeName}' is not compatible with ${type.name}.`);
    }

    asset.setInstanceId(generateGUID());
    this.assets.set(asset.getInstanceId(), asset);
    asset.initAsVirtual();

    return asset;
  }

  /** @internal */
  removeAssetFromPool (asset: Asset): void {
    if (this.assets.get(asset.getInstanceId()) === asset) {
      this.assets.delete(asset.getInstanceId());
    }
  }

  /**
   * Creates a placeholder and starts deserializing an in-memory JSON asset.
   * EditorContent uses the same path after reading a JsonAsset file.
   */
  protected loadAssetData<T extends Asset> (
    data: spec.EffectsObjectData,
    expectedType?: Constructor<T>,
  ): T | undefined {
    const existing = this.getAsset<T>(data.id);

    if (existing) {
      return this.checkType(existing, expectedType, data.id);
    }

    const classConstructor = getClass(data.dataType);

    if (!classConstructor) {
      logger.error(`Constructor for DataType '${data.dataType}' is not registered.`);

      return undefined;
    }
    if (!(classConstructor.prototype instanceof Asset)) {
      logger.error(`DataType '${data.dataType}' is not an Asset type.`);

      return undefined;
    }

    const asset = new classConstructor(this.engine) as Asset;

    if (expectedType && !(asset instanceof expectedType)) {
      asset.dispose();
      logger.warn(`Asset '${data.id}' has type ${classConstructor.name}, expected ${expectedType.name}.`);

      return undefined;
    }

    asset.setInstanceId(data.id);
    // Register before fromData so recursive and cyclic references reuse the
    // same placeholder.
    this.assets.set(data.id, asset);
    asset.startLoading(() => {
      SerializationHelper.deserialize(data, asset);
    });

    return asset as T;
  }

  protected createAssetPlaceholder<T extends Asset> (
    id: string,
    typeName: string,
    expectedType?: Constructor<T>,
  ): T | undefined {
    const classConstructor = getClass(typeName);

    if (!classConstructor || !(classConstructor.prototype instanceof Asset)) {
      logger.error(`Constructor for Asset TypeName '${typeName}' is not registered.`);

      return undefined;
    }

    const asset = new classConstructor(this.engine) as Asset;

    if (expectedType && !(asset instanceof expectedType)) {
      asset.dispose();
      logger.warn(`Asset '${id}' has type ${classConstructor.name}, expected ${expectedType.name}.`);

      return undefined;
    }

    asset.setInstanceId(id);
    this.assets.set(id, asset);

    return asset as T;
  }

  private checkType<T extends Asset> (
    asset: T,
    expectedType: Constructor<T> | undefined,
    id: string,
  ): T | undefined {
    if (expectedType && !(asset instanceof expectedType)) {
      logger.warn(`Asset '${id}' has type ${asset.constructor.name}, expected ${expectedType.name}.`);

      return undefined;
    }

    return asset;
  }
}
