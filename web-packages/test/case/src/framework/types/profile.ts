import type { GLType, SceneLoadOptions } from '@galacean/effects';
import type { TestController } from '../../common/player/test-controller';

export type FrameSceneContext = {
  controller: TestController,
  renderFramework: GLType,
  scene: FrameCompareScene,
};

export type FrameSceneFrameContext = FrameSceneContext & {
  time: number,
  timeIndex: number,
};

export type FrameCompareScene = {
  id: string,
  name: string,
  url?: string,
  threshold?: number,
  timePoints?: number[],
  breakWhenTimeGteDuration?: boolean,
  loadOptions?: SceneLoadOptions,
  beforeScene?: (context: FrameSceneContext) => Promise<void> | void,
  beforeEachFrame?: (context: FrameSceneFrameContext) => Promise<void> | void,
  afterScene?: (context: FrameSceneContext) => Promise<void> | void,
  setupPlayers?: (context: FrameSceneContext) => Promise<void>,
};

export type FrameSuiteProfile = {
  id: string,
  title: string,
  frameworkIndexOffset?: number,
  frameworks: GLType[],
  canvas: {
    width: number,
    height: number,
  },
  timeoutMs: number,
  pixelDiffThreshold: number,
  defaultAccumRatioThreshold: number,
  timePoints: number[],
  breakWhenTimeGteDuration?: boolean,
  withGpuCheck?: boolean,
  withPerfStats?: boolean,
  is3DCase?: boolean,
  scenes: FrameCompareScene[],
};
