import { EffectsObject, Material, Shader, Sprite, Texture, VFXItem } from '@galacean/effects';
import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { LineEdit, VBoxContainer, Button } from '@galacean/effects-plugin-gui';
import { Control, HorizontalAlignment, MouseFilter } from '@galacean/effects-plugin-gui';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { append, column, expand, row, screenPosition, place, disposeChildren } from '../../../ui/controls/layout';
import { setTooltip } from '../../../ui/controls/tooltip';
import { EditorMenuButton, MenuHeading, EditorMenuActionButton } from '../../../ui/controls/menu';
import { EditorDropTarget } from '../../../ui/controls/drag-feedback';
import { EditorPopupPanel } from '../../../ui/controls/popup-panel';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import type { ObjectReferenceOptions } from '../../../ui/property-editor/object-reference-field';
import type { ValueBinding } from '../../../ui/property-editor/property-sheet';
import { sceneWorkspace } from '../../scene/scene-workspace';
import { assetLibrary } from '../asset-library';
import { AssetPreviewControl } from '../preview/asset-preview-control';
import { openContentAsset, openRuntimeAsset, openTextureAsset, revealContentAsset, selectedContentAssets } from '../editors/asset-editor-registry';
import type { ContentAssetDrag } from './asset-drag';
import { CONTENT_ASSET_PAYLOAD } from './asset-drag';
import { AssetPicker, assetReferenceClipboard } from './asset-picker';
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
export class AssetReferenceControl extends EditorDropTarget {
  private readonly caption: EditorMenuButton;
  private readonly use: Button;
  private readonly browse: Button;
  private readonly picker: EditorPopupPanel;
  private readonly search: LineEdit;
  private readonly browser: AssetPicker;
  private available: AssetPickerCandidate[] = [];
  private readonly payloadType: string;
  private readonly kind?: typeof assetKinds[keyof typeof assetKinds];
  private readonly thumbnail?: AssetPreviewControl;
  private readonly pickerActions: VBoxContainer;
  private readonly browseHeading: MenuHeading;
  private revision = -1;

  constructor (engine: Engine, private readonly binding: ValueBinding<object | null>, private readonly options: ObjectReferenceOptions = {}) {
    super(engine);
    const reference = binding.read();

    this.payloadType = reference instanceof Texture ? 'Texture' : reference instanceof Material ? 'Material' : reference instanceof Sprite ? 'Sprite' : reference instanceof Shader ? 'Shader' : options.expectedType ?? reference?.constructor.name ?? 'EffectsObject';
    this.kind = assetKinds[this.payloadType as keyof typeof assetKinds];
    if (this.kind === 'texture' || this.kind === 'sprite' || this.kind === 'material') {
      this.thumbnail = append(this, new AssetPreviewControl(engine, () => this.binding.read(), 54, undefined, this.kind)); this.thumbnail.mouseFilter = MouseFilter.Pass;
      this.thumbnail.activated = () => {
        const reference = this.binding.read();

        if (reference) { openReference(reference); }
      };
    }
    this.caption = append(this, expand(new EditorMenuButton(engine, ''), true, false)); this.caption.clipText = true;
    this.caption.mouseFilter = MouseFilter.Pass; this.caption.themeTypeVariation = 'EditorComboButton'; this.caption.textAlignment = HorizontalAlignment.Left; this.caption.showArrow = true;
    this.caption.openMenu = () => this.showPicker();
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
    this.use = append(this, new EditorIconButton(engine, 'useSelected'));
    this.use.on('pressed', () => {
      const id = this.selectedAsset();

      if (id) { this.assignAsset(id); }
    });
    this.browse = append(this, new EditorIconButton(engine, 'browseContent'));
    this.browse.on('pressed', () => {
      const reference = this.binding.read();

      if (reference instanceof EffectsObject) { revealContentAsset(reference.getInstanceId()); }
    });
    this.use.mouseFilter = this.browse.mouseFilter = MouseFilter.Pass;
    this.use.visible = this.browse.visible = !!this.kind;
    this.picker = new EditorPopupPanel(engine); this.picker.themeTypeVariation = 'EditorMenu'; this.picker.setSize(300, 0);
    const body = append(this.picker, column(engine));

    this.pickerActions = append(body, column(engine));
    this.browseHeading = append(body, new MenuHeading(engine, 'Browse'));
    this.browser = append(body, new AssetPicker(engine, id => {
      const candidate = this.available.find(candidate => candidate.id === id);

      if (candidate?.asset) { this.assign(candidate.asset); } else { this.assignAsset(id); }
      this.picker.hidePopup();
    })); this.search = this.browser.search; this.search.placeholderText = 'Search ' + this.payloadType + ' assets';
    this.picker.onPopup('popupOpened', () => this.caption.setPressedNoSignal(true)); this.picker.onPopup('popupClosed', () => this.caption.setPressedNoSignal(false));
    setTooltip(this.use, 'Use selected asset from Content Browser'); setTooltip(this.browse, 'Browse to asset in Content Browser');
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(80, this.thumbnail?.visible ? 54 : this.kind ? 49 : 24); }
  protected override sortChildren (): void {
    const left = this.thumbnail?.visible ? 60 : 0;

    if (this.thumbnail?.visible) { place(this.thumbnail, 0, 0, 54, 54); }
    place(this.caption, left, 0, this.width - left, 24); place(this.use, left, 27, 24, 22); place(this.browse, left + 26, 27, 24, 22);
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
  private showPicker (): void {
    disposeChildren(this.pickerActions);
    append(this.pickerActions, new MenuHeading(this.engine, 'Current Asset'));
    for (const action of this.caption.actions()) {
      append(this.pickerActions, new EditorMenuActionButton(this.engine, { ...action, action: () => { this.picker.hidePopup(); action.action?.(); } }));
    }
    this.browseHeading.visible = this.browser.visible = !this.options.readOnly;
    this.search.text = ''; this.filterCandidates(); this.picker.popup(screenPosition(this, 0, this.height), this.caption);
    if (this.picker.y < screenPosition(this, 0, this.height).y) { this.picker.setPosition(this.picker.x, Math.max(0, screenPosition(this).y - this.picker.height)); }
    if (!this.options.readOnly) { this.search.grabFocus(); }
  }
  private filterCandidates (): void {
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
    this.use.disabled = !!this.options.readOnly || !this.selectedAsset(); this.browse.disabled = !entry || !!entry.deletedAt;
    if (this.picker.visible && this.revision !== assetLibrary.revision) { this.filterCandidates(); }
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
  override onDestroy (): void { this.picker.dispose(); }
}
