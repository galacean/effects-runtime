import { EffectsObject } from '@galacean/effects';
import type { Engine, math } from '@galacean/effects';
import type { ValueBinding } from '../../../ui/property-editor/property-sheet';
import { assetLibrary } from '../asset-library';
import { openContentAsset, openTextureAsset, revealContentAsset, selectedContentAssets } from '../editors/asset-editor-registry';
import type { AssetKind } from '../model/asset-types';
import { CONTENT_ASSET_PAYLOAD } from './asset-drag';
import { ASSET_PRESENTATION } from './asset-presentation';
import { assetReferenceClipboard } from './asset-picker';
import { AssetReferenceFieldBase } from './asset-reference-field-base';
import { AssetPreviewControl } from '../preview/asset-preview-control';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';

/** A resource reference in an asset draft; selecting it does not instantiate a scene object. */
export class ContentAssetPicker extends AssetReferenceFieldBase {
  private revision = -1;

  constructor (engine: Engine, readonly kind: Exclude<AssetKind, 'folder' | 'scene'>, private readonly binding: ValueBinding<string | undefined>,
    readonly emptyLabel = 'None', readonly allowEmpty = true) {
    super(engine);
    this.caption.iconName = kind === 'shader' ? ASSET_PRESENTATION[kind].menuIcon : undefined;
    if (kind !== 'shader') {
      const thumbnail = new AssetPreviewControl(engine, () => assetLibrary.asset(EditorRuntimeSession.player.engine, this.binding.read() ?? ''), 54, () => this.binding.read(), ASSET_PRESENTATION[kind].icon);

      this.setPreview(thumbnail); thumbnail.activated = () => this.openCurrent();
    }
    this.caption.actions = () => [
      { label: 'Edit', icon: 'edit', enabled: !!this.binding.read(), action: () => this.openCurrent() },
      { label: 'Copy Reference', icon: 'copy', enabled: !!this.binding.read(), action: () => {
        const id = this.binding.read(), entry = id && assetLibrary.entry(id);

        assetReferenceClipboard.id = id; assetReferenceClipboard.asset = undefined; assetReferenceClipboard.project = assetLibrary.projectId;
        if (entry) { void navigator.clipboard.writeText(assetLibrary.pathText(entry.parentId) + '/' + entry.name).catch(error => assetLibrary.report(error)); }
      } },
      { label: 'Paste', icon: 'paste', enabled: this.canPaste(), action: () => { if (this.canPaste()) { this.binding.write(assetReferenceClipboard.id); } } },
      ...(allowEmpty ? [{ label: 'Clear', icon: 'delete' as const, enabled: !!this.binding.read(), action: () => this.binding.write(undefined) }] : []),
    ];
    this.browser.search.placeholderText = 'Search ' + ASSET_PRESENTATION[kind].label + ' assets';
  }
  private canPaste (): boolean { return assetReferenceClipboard.project === assetLibrary.projectId && this.compatible(assetReferenceClipboard.id ?? ''); }
  protected override chooseAsset (id: string): void { this.binding.write(id); }
  protected override useCurrentSelection (): void {
    const id = selectedContentAssets().find(id => this.compatible(id));

    if (id) { this.binding.write(id); }
  }
  protected override browseCurrent (): void {
    const id = this.binding.read();

    if (id) { revealContentAsset(id); }
  }
  private openCurrent (): void {
    const id = this.binding.read();

    if (id) { if (this.kind === 'texture') { openTextureAsset(id); } else { openContentAsset(id); } }
  }
  private compatible (id: string): boolean {
    const entry = assetLibrary.entry(id);

    return entry?.kind === this.kind && !entry.deletedAt;
  }
  protected override refreshCandidates (): void {
    this.browser.setCandidates(assetLibrary.entries.filter(entry => this.compatible(entry.id)), this.kind, this.binding.read()); this.revision = assetLibrary.revision;
  }
  override update (dt: number): void {
    const id = this.binding.read(), entry = id ? assetLibrary.entry(id) : undefined;

    this.caption.text = entry?.name ?? (id ? 'Missing ' + ASSET_PRESENTATION[this.kind].label : this.emptyLabel);
    this.useSelected.disabled = !selectedContentAssets().some(id => this.compatible(id)); this.browse.disabled = !entry || !!entry.deletedAt;
    if (this.picker.visible && this.revision !== assetLibrary.revision) { this.refreshCandidates(); }
    super.update(dt);
  }
  private dropped (data: unknown): string | undefined {
    const payload = data as { type?: string, data?: { ids?: string[] } | EffectsObject };
    const id = payload.type === CONTENT_ASSET_PAYLOAD && payload.data && !(payload.data instanceof EffectsObject)
      ? payload.data.ids?.length === 1 ? payload.data.ids[0] : undefined : payload.data instanceof EffectsObject ? payload.data.getInstanceId() : undefined;

    return id && this.compatible(id) ? id : undefined;
  }
  protected override canDropData (_position: math.Vector2, data: unknown): boolean { return !!this.dropped(data); }
  protected override dropData (_position: math.Vector2, data: unknown): void {
    const id = this.dropped(data);

    if (id) { this.binding.write(id); }
  }
}
