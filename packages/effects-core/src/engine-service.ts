import type { Engine } from './engine';

/**
 * Engine-owned service. Register subclasses with `@effectsClass` before creating
 * an engine. Each engine creates and initializes its own instances in the Engine
 * constructor, before rendering backend constructors have completed.
 */
export abstract class EngineService {
  /** Lower orders initialize and tick first; shutdown runs in reverse order. */
  constructor (
    readonly engine: Engine,
    readonly order: number = 0,
  ) {}

  /** Initialize synchronously. Throw an error to abort engine creation. */
  onInit (): void {}

  /** Called in service order. deltaTime is in milliseconds. */
  onUpdate (deltaTime: number): void {}

  /** Called in service order after all updates and before rendering. */
  onLateUpdate (deltaTime: number): void {}

  /** Called in service order before scene preparation, framebuffer clearing and rendering. */
  onDraw (): void {}

  /** Prepare shutdown before service disposal. Scene services unload their compositions here. */
  onBeforeExit (): void {}

  /** Release service resources. */
  onDispose (): void {}
}
