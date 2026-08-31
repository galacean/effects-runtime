import type { DemoState, PageID } from './state';

export interface AppContext {
  readonly state: DemoState,
  navigate(page: PageID): void,
  requestRebuild(): void,
}
