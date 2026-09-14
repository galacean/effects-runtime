import type { Engine } from './engine';

/**
 * Engine-owned service. Register subclasses with `@effectsClass` before creating
 * an engine. Each engine creates and initializes its own instances in the Engine
 * constructor, before rendering backend constructors have completed.
 */
export abstract class EngineService {
  /** Lower orders initialize and tick first; shutdown runs in reverse order. */
  readonly order: number = 0;

  constructor (readonly engine: Engine) {}

  /** Initialize synchronously. Throw an error to abort engine creation. */
  onInit (): void {}

  /** Called before compositions update. deltaTime is in milliseconds. */
  onUpdate (deltaTime: number): void {}

  /** Called after compositions update and before rendering. */
  onLateUpdate (deltaTime: number): void {}

  /** Called after clearing the framebuffer and before compositions render. */
  onDraw (): void {}

  /** Called before any service or engine resources are released. */
  onBeforeExit (): void {}

  /** Release service resources. */
  onDispose (): void {}
}
