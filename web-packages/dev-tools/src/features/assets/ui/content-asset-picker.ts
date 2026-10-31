import { EffectsObject, math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { HorizontalAlignment, MouseFilter } from '@galacean/effects-plugin-gui';
import { append, column, expand, place, screenPosition } from '../../../ui/controls/layout';
import { EditorDropTarget } from '../../../ui/controls/drag-feedback';
import { EditorPopupPanel } from '../../../ui/controls/popup-panel';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import { EditorMenuButton, MenuHeading, EditorMenuActionButton } from '../../../ui/controls/menu';
import { setTooltip } from '../../../ui/controls/tooltip';
import type { ValueBinding } from '../../../ui/property-editor/property-sheet';
import { assetLibrary } from '../asset-library';
import { openContentAsset, openTextureAsset, revealContentAsset, selectedContentAssets } from '../editors/asset-editor-registry';
import type { AssetKind } from '../model/asset-types';
import { CONTENT_ASSET_PAYLOAD } from './asset-drag';
import { ASSET_PRESENTATION } from './asset-presentation';
import { AssetPicker, assetReferenceClipboard } from './asset-picker';
import { AssetPreviewControl } from '../preview/asset-preview-control';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';

/** A resource reference in an asset draft; selecting it does not instantiate a scene object. */
export class ContentAssetPicker extends EditorDropTarget {
  private readonly caption: EditorMenuButton;
  private readonly picker: EditorPopupPanel;
  private readonly browser: AssetPicker;
  private readonly thumbnail?: AssetPreviewControl;
  private readonly actionButtons: { button: EditorMenuActionButton, enabled: () => boolean }[] = [];
  private readonly useSelected: EditorIconButton;
  private readonly browse: EditorIconButton;
  private revision = -1;

  constructor (engine: Engine, readonly kind: Exclude<AssetKind, 'folder' | 'scene'>, private readonly binding: ValueBinding<string | undefined>,
    readonly emptyLabel = 'None', readonly allowEmpty = true) {
    super(engine);
    this.caption = append(this, expand(new EditorMenuButton(engine, ''), true, false));
    this.caption.iconName = kind === 'shader' ? ASSET_PRESENTATION[kind].menuIcon : undefined; this.caption.showArrow = true; this.caption.clipText = true;
    this.caption.mouseFilter = MouseFilter.Pass; this.caption.themeTypeVariation = 'EditorComboButton'; this.caption.textAlignment = HorizontalAlignment.Left;
    if (kind !== 'shader') {
      this.thumbnail = append(this, new AssetPreviewControl(engine, () => assetLibrary.asset(EditorRuntimeSession.player.engine, this.binding.read() ?? ''), 54, () => this.binding.read(), ASSET_PRESENTATION[kind].icon));
      this.thumbnail.mouseFilter = this.caption.mouseFilter;
      this.thumbnail.activated = () => this.openCurrent();
    }
    this.picker = new EditorPopupPanel(engine); this.picker.themeTypeVariation = 'EditorMenu';
    const body = append(this.picker, column(engine));

    append(body, new MenuHeading(engine, 'Current Asset'));
    const action = (icon: 'edit' | 'copy' | 'paste' | 'delete', title: string, enabled: () => boolean, run: () => void): void => {
      const button = append(body, new EditorMenuActionButton(engine, { label: title, icon, action: () => { this.picker.hidePopup(); run(); } }));

      this.actionButtons.push({ button, enabled });
    };

    action('edit', 'Edit', () => !!this.binding.read(), () => this.openCurrent());
    action('copy', 'Copy Reference', () => !!this.binding.read(), () => {
      const id = this.binding.read(), entry = id && assetLibrary.entry(id);

      assetReferenceClipboard.id = id; assetReferenceClipboard.asset = undefined; assetReferenceClipboard.project = assetLibrary.projectId;
      if (entry) { void navigator.clipboard.writeText(assetLibrary.pathText(entry.parentId) + '/' + entry.name).catch(error => assetLibrary.report(error)); }
    });
    action('paste', 'Paste', () => assetReferenceClipboard.project === assetLibrary.projectId && this.compatible(assetReferenceClipboard.id ?? ''), () => { if (assetReferenceClipboard.project === assetLibrary.projectId && assetReferenceClipboard.id && this.compatible(assetReferenceClipboard.id)) { this.binding.write(assetReferenceClipboard.id); } });
    if (allowEmpty) { action('delete', 'Clear', () => !!this.binding.read(), () => this.binding.write(undefined)); }
    append(body, new MenuHeading(engine, 'Browse'));
    this.browser = append(body, new AssetPicker(engine, id => { this.binding.write(id); this.picker.hidePopup(); }));
    this.browser.search.placeholderText = 'Search ' + ASSET_PRESENTATION[kind].label + ' assets';
    this.caption.openMenu = () => {
      this.browser.search.text = ''; this.refresh();
      this.actionButtons.forEach(({ button, enabled }) => button.disabled = !enabled());
      const position = screenPosition(this, 0, this.height);

      this.picker.popup(position, this.caption);
      if (this.picker.y < position.y) { this.picker.setPosition(this.picker.x, Math.max(0, screenPosition(this).y - this.picker.height)); }
      this.browser.search.grabFocus();
    };
    this.picker.onPopup('popupOpened', () => this.caption.setPressedNoSignal(true)); this.picker.onPopup('popupClosed', () => this.caption.setPressedNoSignal(false));
    this.useSelected = append(this, new EditorIconButton(engine, 'useSelected')); this.useSelected.mouseFilter = MouseFilter.Pass;
    this.useSelected.on('pressed', () => {
      const id = selectedContentAssets().find(id => this.compatible(id));

      if (id) { this.binding.write(id); }
    });
    this.browse = append(this, new EditorIconButton(engine, 'browseContent')); this.browse.mouseFilter = MouseFilter.Pass;
    this.browse.on('pressed', () => {
      const id = this.binding.read();

      if (id) { revealContentAsset(id); }
    });
    setTooltip(this.useSelected, 'Use selected asset from Content Browser'); setTooltip(this.browse, 'Browse to asset in Content Browser');
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(80, this.thumbnail ? 54 : 49); }
  protected override sortChildren (): void {
    const left = this.thumbnail ? 60 : 0;

    if (this.thumbnail) { place(this.thumbnail, 0, 0, 54, 54); }
    place(this.caption, left, 0, this.width - left, 24); place(this.useSelected, left, 27, 24, 22); place(this.browse, left + 26, 27, 24, 22);
  }
  private openCurrent (): void {
    const id = this.binding.read();

    if (id) { if (this.kind === 'texture') { openTextureAsset(id); } else { openContentAsset(id); } }
  }
  private compatible (id: string): boolean {
    const entry = assetLibrary.entry(id);

    return entry?.kind === this.kind && !entry.deletedAt;
  }
  private refresh (): void {
    this.browser.setCandidates(assetLibrary.entries.filter(entry => this.compatible(entry.id)), this.kind, this.binding.read()); this.revision = assetLibrary.revision;
  }
  override update (dt: number): void {
    const id = this.binding.read(), entry = id ? assetLibrary.entry(id) : undefined;

    this.caption.text = entry?.name ?? (id ? 'Missing ' + ASSET_PRESENTATION[this.kind].label : this.emptyLabel);
    this.useSelected.disabled = !selectedContentAssets().some(id => this.compatible(id)); this.browse.disabled = !entry || !!entry.deletedAt;
    if (this.picker.visible && this.revision !== assetLibrary.revision) { this.refresh(); }
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
  override onDestroy (): void { this.picker.dispose(); super.onDestroy(); }
}
