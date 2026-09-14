import type { Composition } from './composition';
import { EngineService } from './engine-service';
import { addItem, removeItem } from './utils';

/** Owns and schedules the independent runtime compositions. Built into every engine. */
export class SceneService extends EngineService {
  override readonly order: number = 200;

  private readonly scenes: Composition[] = [];
  private disposed = false;

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

  /** Prepare a redraw without advancing scene time. Runs before framebuffer clearing. */
  prepareRender (): void {
    for (const composition of this.compositions) {
      composition.camera.updateMatrix();
      composition.sceneTicking.preRender.tick(0);
    }
  }

  override onDraw (): void {
    for (const composition of this.compositions) {
      composition.renderContent();
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
