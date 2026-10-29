let textureOpener: ((id: string) => void) | undefined;

export function setTextureAssetOpener (opener: (id: string) => void): void { textureOpener = opener; }

export function openTextureAsset (id: string): boolean {
  if (!textureOpener) { return false; }
  textureOpener(id);

  return true;
}
