import type { Engine, InputEventKey } from '@galacean/effects';
import { VBoxContainer, VerticalAlignment } from '@galacean/effects-plugin-gui';
import type { Label } from '@galacean/effects-plugin-gui';
import { AssetView } from '../../../ui/asset-view/asset-view';
import type { AssetViewItem } from '../../../ui/asset-view/asset-view';
import { append, expand, label, margin } from '../../../ui/controls/layout';
import { EditorSearchField } from '../../../ui/controls/search-field';
import { editorColors, EDITOR_SMALL_FONT_SIZE } from '../../../ui/theme/control-theme';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { ContentAssetSource } from '../../content-browser/content-asset-source';
import { assetLibrary } from '../asset-library';
import { AssetThumbnailCache } from '../preview/asset-thumbnail-cache';
import { resourcePreview } from '../preview/asset-preview-control';
import type { AssetKind } from '../model/asset-types';
import { ASSET_PRESENTATION } from './asset-presentation';

export interface AssetPickerCandidate { id: string, name: string, asset?: object }
export const assetReferenceClipboard: { id?: string, asset?: object, project?: string } = {};

export class AssetPicker extends VBoxContainer {
  readonly search: EditorSearchField;
  readonly view: AssetView;
  private items: AssetViewItem[] = [];
  private filtered: AssetViewItem[] = [];
  private selected = '';
  private readonly count: Label;
  private readonly thumbnails = new AssetThumbnailCache();
  private readonly source = new ContentAssetSource(this.thumbnails, id => assetLibrary.asset(EditorRuntimeSession.player.engine, id));

  constructor (engine: Engine, private readonly accept: (id: string) => void) {
    super(engine); this.setThemeConstantOverride('separation', 0);
    this.search = new EditorSearchField(engine); append(this, margin(engine, this.search, 8, 4));
    this.search.on('textChanged', () => this.filter());
    this.view = append(this, expand(new AssetView(engine, {
      selected: id => id === this.selected,
      choose: id => { this.selected = id; this.accept(id); }, open: id => this.accept(id),
      context: () => {}, rename: () => {}, drag: () => undefined, canDrop: () => false, drop: () => {},
      key: event => { if (this.navigate(event.keycode)) { event.accept(); } },
    })));
    this.view.selectionScope = this; this.view.configure('list', 32); this.view.emptyText = 'No matching assets'; this.view.setCustomMinimumSize(300, 248);
    this.count = label(engine, '', editorColors.muted); this.count.setThemeFontSizeOverride('fontSize', EDITOR_SMALL_FONT_SIZE); this.count.setCustomMinimumSize(0, 20);
    this.count.verticalAlignment = VerticalAlignment.Center; append(this, margin(engine, this.count, 4, 0));
    window.addEventListener('keydown', this.nativeKeyDown, true);
  }
  setCandidates (candidates: AssetPickerCandidate[], kind: Exclude<AssetKind, 'folder' | 'scene'> | undefined, current = ''): void {
    this.selected = current;
    this.items = candidates.map(candidate => {
      const entry = assetLibrary.entry(candidate.id);

      if (entry) { return this.source.describe(entry); }
      const type = kind ? ASSET_PRESENTATION[kind] : ASSET_PRESENTATION.texture;

      return { id: candidate.id, name: candidate.name, type: type.label, icon: type.icon, accent: type.accent,
        preview: candidate.asset ? () => resourcePreview(candidate.asset, 64) : undefined };
    }); this.filter();
  }
  private filter (): void {
    const query = this.search.text.trim().toLocaleLowerCase();

    this.filtered = this.items.filter(item => item.name.toLocaleLowerCase().includes(query));
    this.view.setItems(this.filtered); this.count.text = this.filtered.length + (this.filtered.length === 1 ? ' item' : ' items');
    if (this.selected) { this.view.revealAsset(this.selected, false, false); }
  }
  private navigate (key: string): boolean {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(key)) { return false; }
    if (key === 'Enter') {
      const item = this.filtered.find(item => item.id === this.selected) ?? this.filtered[0];

      if (item) { this.selected = item.id; this.accept(item.id); }

      return true;
    }
    const index = this.filtered.findIndex(item => item.id === this.selected);
    const next = key === 'Home' ? 0 : key === 'End' ? this.filtered.length - 1 : key === 'ArrowDown' ? Math.min(this.filtered.length - 1, index + 1) : index < 0 ? this.filtered.length - 1 : Math.max(0, index - 1);

    this.selected = this.filtered[next]?.id ?? '';
    this.view.revealAsset(this.selected, false, false); this.search.grabFocus();

    return true;
  }
  private readonly nativeKeyDown = (event: KeyboardEvent): void => {
    if (!this.visibleInHierarchy || !this.search.hasFocus() || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) { return; }
    if ((event.key === 'Home' || event.key === 'End') && this.search.text) { return; }
    if (this.navigate(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  override onKeyDown (event: InputEventKey): void { if (this.navigate(event.keycode)) { event.accept(); } }
  override onDestroy (): void { window.removeEventListener('keydown', this.nativeKeyDown, true); this.thumbnails.clear(); super.onDestroy(); }
}
