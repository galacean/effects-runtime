import type { AssetEntry } from './asset-types';

export function contentAssetName (name: string): string {
  const next = name.trim();

  if (!next || next === '.' || next === '..' || /[/\\:*?"<>|]/.test(next) || Array.from(next).some(character => character.charCodeAt(0) < 32)) {
    throw new Error('Use a name without slashes or special file characters.');
  }

  return next;
}

export function assertUniqueAssetName (entries: readonly AssetEntry[], name: string, exceptId?: string): void {
  if (entries.some(entry => entry.id !== exceptId && !entry.deletedAt && entry.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('An asset named "' + name + '" already exists in this folder.');
  }
}
