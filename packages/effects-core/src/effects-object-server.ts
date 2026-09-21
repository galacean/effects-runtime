import type * as spec from '@galacean/effects-specification';
import { AssetServer } from './asset-server';
import { effectsClass } from './decorators';
import type { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { EngineServer } from './engine-server';
import { isPlainObject } from './utils';

/** Owns object registration and resolves serialized object references per engine. */
@effectsClass('EffectsObjectServer')
export class EffectsObjectServer extends EngineServer {
  objectInstance: Record<string, EffectsObject> = {};

  constructor (engine: Engine) {
    super(engine, -700);
  }

  /** @internal Called by EffectsObject to keep its registration state in sync. */
  registerObject (object: EffectsObject): void {
    this.objectInstance[object.getInstanceId()] = object;
  }

  /** @internal Called by EffectsObject to keep its registration state in sync. */
  unregisterObject (object: EffectsObject): void {
    delete this.objectInstance[object.getInstanceId()];
  }

  /** Reset the current lookup context without disposing the objects or GPU resources. */
  clearResources (): void {
    for (const id of Object.keys(this.objectInstance)) {
      this.objectInstance[id].unregisterObject();
    }
    this.engine.getServer(AssetServer).clearSceneData();
    this.objectInstance = {};
  }

  findObject<T> (guid: spec.DataPath): T {
    // 编辑器可能传 Class 对象，这边判断处理一下直接返回原对象。
    if (!isPlainObject(guid)) {
      return guid as T;
    }

    if (this.objectInstance[guid.id]) {
      return this.objectInstance[guid.id] as T;
    }

    return this.engine.getServer(AssetServer).loadGUID<T>(guid);
  }
}
