import type { FrameCompareScene, FrameSuiteProfile } from '../../framework/types/profile';

export type ProfileBase = Omit<FrameSuiteProfile, 'scenes'>;

export function buildProfile (base: ProfileBase, scenes: FrameCompareScene[]): FrameSuiteProfile {
  return {
    ...base,
    scenes,
  };
}
