import type { FrameSuiteProfile } from '../framework/types/profile';
import { ProfileRegistry } from '../framework/profile/profile-registry';
import { dynamic2DProfile } from './2d/dynamic.profile';
import { inspire2DProfile } from './2d/inspire.profile';
import { interact2DProfile } from './2d/interact.profile';
import { case3DProfile } from './3d/case.profile';
import { gltf3DProfile } from './3d/gltf.profile';
import { spineProfile } from './spine/spine.profile';

const groupedProfiles: Record<'2d' | '3d' | 'spine', FrameSuiteProfile[]> = {
  '2d': [interact2DProfile, dynamic2DProfile, inspire2DProfile],
  '3d': [gltf3DProfile, case3DProfile],
  spine: [spineProfile],
};

export const profileRegistry = new ProfileRegistry(groupedProfiles);
