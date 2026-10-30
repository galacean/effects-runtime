let textureOpener: ((id: string) => void) | undefined;
let contentOpener: ((id: string) => void) | undefined;
let focusedSave: (() => Promise<void>) | undefined;
let runtimeOpener: ((asset: object) => void) | undefined;
let browserActions: { reveal: (id: string) => void, selected: () => string[] } | undefined;

export function setTextureAssetOpener (opener: (id: string) => void): void { textureOpener = opener; }

export function setContentAssetOpener (opener: (id: string) => void): void { contentOpener = opener; }
export function openContentAsset (id: string): boolean {
  if (!contentOpener) { return false; }
  contentOpener(id);

  return true;
}

export function setFocusedAssetSave (save?: () => Promise<void>): void { focusedSave = save; }
export function saveFocusedAsset (): boolean {
  if (!focusedSave) { return false; }
  void focusedSave();

  return true;
}

export function openTextureAsset (id: string): boolean {
  if (!textureOpener) { return false; }
  textureOpener(id);

  return true;
}

export function setRuntimeAssetOpener (opener: (asset: object) => void): void { runtimeOpener = opener; }

export function openRuntimeAsset (asset: object): boolean {
  if (!runtimeOpener) { return false; }
  runtimeOpener(asset);

  return true;
}

export function setContentBrowserActions (actions: NonNullable<typeof browserActions>): void { browserActions = actions; }
export function revealContentAsset (id: string): void { browserActions?.reveal(id); }
export function selectedContentAssets (): string[] { return browserActions?.selected() ?? []; }
