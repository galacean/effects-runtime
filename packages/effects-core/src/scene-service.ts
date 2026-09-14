import type { Composition } from './composition';
import type { Engine } from './engine';
import { EngineService } from './engine-service';
import { effectsClass } from './decorators';
import { addItem, removeItem } from './utils';

/** Owns and schedules the independent runtime compositions. Built into every engine. */
@effectsClass('SceneService')
export class SceneService extends EngineService {
  private readonly scenes: Composition[] = [];
  private disposed = false;

  constructor (engine: Engine) {
    super(engine, 200);
  }

  get compositions (): Composition[] {
    return this.scenes.sort((a, b) => a.getIndex() - b.getIndex());
  }

  addComposition (composition: Composition): void {
    if (!this.disposed && !this.engine.disposed) {
      addItem(this.compositions, composition);
    }
  }

  removeComposition (composition: Composition): void {
    removeItem(this.scenes, composition);
  }

  override onUpdate (deltaTime: number): void {
    for (const composition of this.compositions) {
      composition.sceneTicking.update.tick(deltaTime);
    }
  }

  override onLateUpdate (deltaTime: number): void {
    for (const composition of this.compositions) {
      composition.sceneTicking.lateUpdate.tick(deltaTime);
    }
  }

  setCameraAspect (aspect: number): void {
    for (const composition of this.scenes) {
      composition.camera.aspect = aspect;
    }
  }

  override onBeforeExit (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const composition of this.scenes.slice()) {
      composition.dispose();
    }
    this.scenes.length = 0;
  }
}
