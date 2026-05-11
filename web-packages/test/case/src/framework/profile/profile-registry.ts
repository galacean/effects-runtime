import type { FrameSuiteProfile } from '../types/profile';

export type ProfileGroup = '2d' | '3d' | 'spine';

type ProfileGroupMap = Record<ProfileGroup, FrameSuiteProfile[]>;

function parseProfileFilterFromQuery (): Set<string> {
  const query = new URLSearchParams(window.location.search);
  const value = query.get('profiles');

  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  );
}

export class ProfileRegistry {
  constructor (private readonly groups: ProfileGroupMap) {}

  getByGroup (group: ProfileGroup): FrameSuiteProfile[] {
    const profiles = this.groups[group] ?? [];
    const includeIds = parseProfileFilterFromQuery();

    if (includeIds.size === 0) {
      return profiles;
    }

    return profiles.filter(profile => includeIds.has(profile.id));
  }
}
