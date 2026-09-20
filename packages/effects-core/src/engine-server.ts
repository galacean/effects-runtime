import type { Engine } from './engine';

/**
 * Engine-owned server. Register subclasses with `@effectsClass` before creating
 * an engine. Each engine creates and initializes its own instances in the Engine
 * constructor. GraphicsServer initializes the device, then RenderingServer creates the renderer
 * before other built-in servers initialize.
 */
export abstract class EngineServer {
  /** Lower orders initialize and tick first; shutdown runs in reverse order. */
  constructor (
    readonly engine: Engine,
    readonly order: number = 0,
  ) {}

  /** Initialize synchronously. Throw an error to abort engine creation. */
  onInit (): void {}

  /** Called in server order. deltaTime is in milliseconds. */
  onUpdate (deltaTime: number): void {}

  /** Called in server order after all updates and before rendering. */
  onLateUpdate (deltaTime: number): void {}

  /** Called in server order before scene preparation, framebuffer clearing and rendering. */
  onDraw (): void {}

  /** Prepare shutdown before server disposal. Scene servers unload their compositions here. */
  onBeforeExit (): void {}

  /** Release server resources. */
  onDispose (): void {}
}
