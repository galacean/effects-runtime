import type { Engine } from './engine';
import { EngineService } from './engine-service';
import { effectsClass } from './decorators';

/** Schedules and unloads the compositions owned by an engine. */
@effectsClass('SceneService')
export class SceneService extends EngineService {
  private disposed = false;

  constructor (engine: Engine) {
    super(engine, 200);
  }

  override onUpdate (deltaTime: number): void {
    for (const composition of this.engine.compositions) {
      composition.sceneTicking.update.tick(deltaTime);
    }
  }

  override onLateUpdate (deltaTime: number): void {
    for (const composition of this.engine.compositions) {
      composition.sceneTicking.lateUpdate.tick(deltaTime);
    }
  }

  override onBeforeExit (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const composition of this.engine.compositions.slice()) {
      composition.dispose();
    }
    this.engine.compositions.length = 0;
  }
}
