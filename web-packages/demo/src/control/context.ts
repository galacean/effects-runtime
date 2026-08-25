import type { DemoState } from './state';

export interface AppContext {
  readonly state: DemoState,
  requestRebuild(): void,
}
