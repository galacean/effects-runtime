import { EffectsObject, Material, Shader, Sprite, Texture, VFXItem } from '@galacean/effects';
import type { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import type { ObjectReferenceOptions } from '../../../ui/property-editor/object-reference-field';
import type { ValueBinding } from '../../../ui/property-editor/property-sheet';
import { sceneWorkspace } from '../../scene/scene-workspace';
import { assetLibrary } from '../asset-library';
import { AssetPreviewControl } from '../preview/asset-preview-control';
import { openContentAsset, openRuntimeAsset, openTextureAsset, revealContentAsset, selectedContentAssets } from '../editors/asset-editor-registry';
import type { ContentAssetDrag } from './asset-drag';
import { CONTENT_ASSET_PAYLOAD } from './asset-drag';
import { assetReferenceClipboard } from './asset-picker';
import { AssetReferenceFieldBase } from './asset-reference-field-base';
import { ASSET_PRESENTATION } from './asset-presentation';
import type { AssetPickerCandidate } from './asset-picker';

const assetKinds = { Texture: 'texture', Material: 'material', Shader: 'shader', Sprite: 'sprite' } as const;

interface AssetPayload { type: string, data: unknown }

function openReference (reference: object): void {
  if (reference instanceof VFXItem) {
    EditorSelection.select(reference);

    return;
  }
  if (reference instanceof Texture && assetLibrary.entry(reference.getInstanceId())?.kind === 'texture' && openTextureAsset(reference.getInstanceId())) { return; }
  if (reference instanceof EffectsObject && assetLibrary.entry(reference.getInstanceId()) && openContentAsset(reference.getInstanceId())) { return; }
  openRuntimeAsset(reference);
}

/** A bound reference field owns its picker and assigns resources from Control signals and drops. */
export class AssetReferenceControl extends AssetReferenceFieldBase {
  private available: AssetPickerCandidate[] = [];
  private readonly payloadType: string;
  private readonly kind?: typeof assetKinds[keyof typeof assetKinds];
  private revision = -1;

  constructor (engine: Engine, private readonly binding: ValueBinding<object | null>, private readonly options: ObjectReferenceOptions = {}) {
    super(engine);
    const reference = binding.read();

    this.payloadType = reference instanceof Texture ? 'Texture' : reference instanceof Material ? 'Material' : reference instanceof Sprite ? 'Sprite' : reference instanceof Shader ? 'Shader' : options.expectedType ?? reference?.constructor.name ?? 'EffectsObject';
    this.kind = assetKinds[this.payloadType as keyof typeof assetKinds];
    this.caption.iconName = this.kind === 'shader' ? ASSET_PRESENTATION.shader.menuIcon : undefined;
    if (this.kind === 'texture' || this.kind === 'sprite' || this.kind === 'material') {
      const thumbnail = new AssetPreviewControl(engine, () => this.binding.read(), 54, undefined, this.kind);

      this.setPreview(thumbnail); thumbnail.activated = () => {
        const reference = this.binding.read();

        if (reference) { openReference(reference); }
      };
    }
    this.caption.actions = () => {
      const reference = this.binding.read();
      const entry = reference instanceof EffectsObject ? assetLibrary.entry(reference.getInstanceId()) : undefined;

      return [
        { label: 'Edit', icon: 'edit', enabled: !!reference, action: () => { if (reference) { openReference(reference); } } },
        { label: 'Copy Reference', icon: 'copy', enabled: !!reference, action: () => {
          const text = entry ? assetLibrary.pathText(entry.parentId) + '/' + entry.name : reference instanceof EffectsObject ? reference.getInstanceId() : this.caption.text;

          assetReferenceClipboard.id = entry?.id; assetReferenceClipboard.asset = reference ?? undefined; assetReferenceClipboard.project = assetLibrary.projectId;
          void navigator.clipboard.writeText(text).catch(error => assetLibrary.report(error));
        } },
        { label: 'Paste', icon: 'paste', enabled: !options.readOnly && this.canPaste(), action: () => {
          if (!this.canPaste()) { return; }
          if (assetReferenceClipboard.id) { this.assignAsset(assetReferenceClipboard.id); } else if (assetReferenceClipboard.asset) { this.assign(assetReferenceClipboard.asset); }
        } },
        ...(options.allowEmpty === false ? [] : [{ label: 'Clear', icon: 'delete' as const, enabled: !options.readOnly && !!reference, action: () => this.assign(null) }]),
      ];
    };
    this.useSelected.visible = this.browse.visible = !!this.kind;
    this.browser.search.placeholderText = 'Search ' + this.payloadType + ' assets';
  }
  protected override get canBrowse (): boolean { return !this.options.readOnly; }
  protected override chooseAsset (id: string): void {
    const candidate = this.available.find(candidate => candidate.id === id);

    if (candidate?.asset) { this.assign(candidate.asset); } else { this.assignAsset(id); }
  }
  protected override useCurrentSelection (): void {
    const id = this.selectedAsset();

    if (id) { this.assignAsset(id); }
  }
  protected override browseCurrent (): void {
    const reference = this.binding.read();

    if (reference instanceof EffectsObject) { revealContentAsset(reference.getInstanceId()); }
  }
  private assign (value: object | null): void {
    if (this.options.readOnly || this.isDisposed || value === null && this.options.allowEmpty === false) { return; }
    const action = () => this.binding.write(value);

    if (this.options.changed) { this.options.changed(action); } else { action(); }
  }
  private assignAsset (id: string): void {
    if (this.options.readOnly || !this.kind || assetLibrary.entry(id)?.kind !== this.kind || assetLibrary.entry(id)?.deletedAt) { return; }
    const engine = EditorRuntimeSession.player.engine;
    const cached = assetLibrary.asset(engine, id);

    if (cached?.isRegistered && !(cached instanceof Texture && cached.isDestroyed)) {
      this.assign(cached);

      return;
    }
    const selection = EditorSelection.getSelectedObjects(), document = sceneWorkspace.current, project = assetLibrary.projectId;

    void assetLibrary.loadAsset(engine, id).then(loaded => {
      const current = EditorSelection.getSelectedObjects();

      if (this.isDisposed || document !== sceneWorkspace.current || project !== assetLibrary.projectId || selection.length !== current.length || selection.some((item, index) => item !== current[index])) { return; }
      this.assign(loaded);
    }).catch(error => { if (project === assetLibrary.projectId) { assetLibrary.report(error); } });
  }
  private selectedAsset (): string | undefined { return selectedContentAssets().find(id => assetLibrary.entry(id)?.kind === this.kind && !assetLibrary.entry(id)?.deletedAt); }
  private canPaste (): boolean {
    if (assetReferenceClipboard.project !== assetLibrary.projectId) { return false; }
    if (assetReferenceClipboard.id) { return !!this.kind && assetLibrary.entry(assetReferenceClipboard.id)?.kind === this.kind && !assetLibrary.entry(assetReferenceClipboard.id)?.deletedAt; }
    const type = { Texture, Sprite, Material, Shader }[this.payloadType as 'Texture' | 'Sprite' | 'Material' | 'Shader'];

    return !!type && assetReferenceClipboard.asset instanceof type;
  }
  protected override refreshCandidates (): void {
    const entries: AssetPickerCandidate[] = assetLibrary.entries.filter(entry => entry.kind === this.kind && !entry.deletedAt).map(entry => ({ id: entry.id, name: entry.name }));
    const constructors: Record<string, typeof EffectsObject> = { Texture, Sprite, Material, Shader };
    const type = constructors[this.payloadType];

    if (type) {
      for (const asset of Object.values(EditorRuntimeSession.player.engine.effectsObjectServer.objectInstance)) {
        if (!(asset instanceof type) || assetLibrary.entry(asset.getInstanceId()) || asset instanceof Texture && (asset.isDestroyed || EditorRuntimeSession.device.isSceneTexture(asset))) { continue; }
        const name = (asset as { name?: string }).name || asset.constructor.name;

        entries.push({ id: asset.getInstanceId(), name, asset });
      }
    }
    this.available = entries;
    const reference = this.binding.read();

    this.browser.setCandidates(entries, this.kind, reference instanceof EffectsObject ? reference.getInstanceId() : '');
    this.revision = assetLibrary.revision;
  }
  override update (delta: number): void {
    const reference = this.binding.read();
    const entry = reference instanceof EffectsObject ? assetLibrary.entry(reference.getInstanceId()) : undefined;

    this.caption.text = entry?.name || (reference as { name?: string } | null)?.name || (reference ? this.payloadType : 'None');
    this.useSelected.disabled = !!this.options.readOnly || !this.selectedAsset(); this.browse.disabled = !entry || !!entry.deletedAt;
    if (this.picker.visible && this.revision !== assetLibrary.revision) { this.refreshCandidates(); }
    super.update(delta);
  }
  protected override canDropData (position: math.Vector2, data: unknown): boolean {
    if (this.options.readOnly) { return false; }
    const payload = data as AssetPayload;

    if (payload?.type === this.payloadType && payload.data) { return true; }
    const assets = payload?.type === CONTENT_ASSET_PAYLOAD ? payload.data as ContentAssetDrag : undefined;

    return !!this.kind && assets?.ids.length === 1 && assetLibrary.entry(assets.ids[0])?.kind === this.kind && !assetLibrary.entry(assets.ids[0])?.deletedAt;
  }
  protected override recognizesDrop (data: unknown): boolean { return !this.options.readOnly && super.recognizesDrop(data); }
  protected override dropData (position: math.Vector2, data: unknown): void {
    if (!this.canDropData(position, data)) { return; }
    const payload = data as AssetPayload;

    if (payload.type === CONTENT_ASSET_PAYLOAD) { this.assignAsset((payload.data as ContentAssetDrag).ids[0]); } else { this.assign(payload.data as object); }
  }
}
