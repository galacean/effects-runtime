import type { Engine, InputEventKey, InputEventMouseButton, math } from '@galacean/effects';
import { MouseButton } from '@galacean/effects';
import { VBoxContainer, ButtonDrawMode } from '@galacean/effects-plugin-gui';
import type { ContentInsets, Control } from '@galacean/effects-plugin-gui';
import { EditorCollapsiblePanel } from '../../ui/controls/section-header';
import { withDragPresentation } from '../../ui/controls/drag-feedback';
import { EditorSelectableRow } from '../../ui/controls/selectable-row';
import { EditorSearchField } from '../../ui/controls/search-field';
import { VirtualList } from '../../ui/controls/virtual-list';
import { append, expand, margin, place, screenPosition } from '../../ui/controls/layout';
import { EditorIconButton, paintIcon, type EditorIcon } from '../../ui/icons/control-icons';
import { ASSET_ICON_COLORS } from '../../ui/icons/asset-icons';
import { editorBox, editorColors, EDITOR_FONT_SIZE } from '../../ui/theme/control-theme';
import { ASSET_ROOT } from '../assets/model/asset-types';
import { CONTENT_ASSET_PAYLOAD } from '../assets/ui/asset-drag';
import type { ContentBrowserPanel } from './content-browser-panel';

export interface SourceItem {
  id: string, name: string, icon: EditorIcon, depth: number, selected: boolean,
  folder?: string, expanded?: boolean, toggle?: () => void, action: () => void, context?: (position: math.Vector2) => void,
}
export function navigateContentSources (rows: readonly SourceItem[], source: SourceItem, event: InputEventKey, focus: (target: SourceItem) => void): boolean {
  const index = rows.indexOf(source); let next = index;

  if (event.keycode === 'Home') { next = 0; } else if (event.keycode === 'End') { next = rows.length - 1; } else if (event.keycode === 'ArrowDown') { next = Math.min(rows.length - 1, index + 1); } else if (event.keycode === 'ArrowUp') { next = Math.max(0, index - 1); } else if (event.keycode === 'ArrowRight' && source.toggle && !source.expanded || event.keycode === 'ArrowLeft' && source.toggle && source.expanded) {
    source.toggle();

    return true;
  } else if (event.keycode === 'ArrowRight' && source.folder && source.expanded) {
    if (rows[index + 1]?.depth > source.depth) { next = index + 1; } else { return false; }
  } else if (event.keycode === 'ArrowLeft' && source.folder) {
    for (next = index - 1; next >= 0 && rows[next].depth >= source.depth; next--) { /* Find the visible parent. */ }
  } else if (event.keycode === 'Enter') {
    source.action();

    return true;
  } else { return false; }
  const target = rows[next];

  target?.action(); if (target) { focus(target); }

  return true;
}
export interface ContentSourceActions {
  sourceKey?: (source: SourceItem, event: InputEventKey) => boolean,
  validDrop?: (folder: string, data: unknown) => boolean,
  dropInFolder?: (folder: string, data: unknown, position: math.Vector2) => void,
}
export class ContentSourceRow extends EditorSelectableRow {
  private entry?: SourceItem;
  constructor (engine: Engine, private readonly panel: ContentSourceActions) {
    super(engine, 'folder'); this.clipText = true; this.on('pressed', () => this.entry?.action());
  }
  bind (value: SourceItem): void {
    this.entry = value; this.text = value.name;
    this.iconName = value.icon; this.selected = value.selected;
  }
  protected override getContentInsets (): ContentInsets { return { left: 38 + (this.entry?.depth ?? 0) * 12, top: 0, right: 6, bottom: 0 }; }
  protected override drawDecoration (mode: ButtonDrawMode): void {
    if (!this.entry) { return; }
    const x = 4 + this.entry.depth * 12, tint = this.selected || mode === ButtonDrawMode.Hover ? editorColors.foregroundHover : editorColors.foreground;

    if (this.entry.toggle) { paintIcon(this, this.entry.expanded ? 'caretDown' : 'caretRight', x, (this.height - 16) / 2, 16, tint); }
    paintIcon(this, this.entry.expanded && this.iconName === 'folder' ? 'folderOpen' : this.iconName, x + 16, (this.height - 16) / 2, 16, this.entry.folder ? ASSET_ICON_COLORS.folder : tint);
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Right) { this.entry?.context?.(event.globalPosition); event.accept(); } else if (event.buttonIndex === MouseButton.Left && event.doubleClick && this.entry?.toggle) { this.entry.action(); this.entry.toggle(); event.accept(); } else if (event.buttonIndex === MouseButton.Left && this.entry?.toggle && event.position.x < 20 + this.entry.depth * 12) { this.entry.toggle(); event.accept(); } else { super.onMouseDown(event); }
  }
  override onKeyDown (event: InputEventKey): void { if (this.entry && this.panel.sourceKey?.(this.entry, event)) { event.accept(); } else { super.onKeyDown(event); } }
  protected override getDragData (): unknown { return this.entry?.folder && this.entry.folder !== ASSET_ROOT ? withDragPresentation({ type: CONTENT_ASSET_PAYLOAD, data: { ids: [this.entry.folder] } }, { label: this.entry.name, icon: 'folder' }) : undefined; }
  protected override canDropData (_position: math.Vector2, data: unknown): boolean { return !!this.entry?.folder && !!this.panel.validDrop?.(this.entry.folder, data); }
  protected override dropData (_position: math.Vector2, data: unknown): void {
    if (this.entry?.folder) { this.panel.dropInFolder?.(this.entry.folder, data, screenPosition(this)); }
  }
}

export type ContentSourceGroup = 'favorites' | 'project' | 'collections';

export class ContentSourcesView extends VBoxContainer {
  private readonly groups = new Map<ContentSourceGroup, { panel: EditorCollapsiblePanel, list: VirtualList<SourceItem>, search: EditorSearchField }>();
  private headings = new Map<string, SourceItem>();
  private rows: Record<ContentSourceGroup, SourceItem[]> = { favorites: [], project: [], collections: [] };
  constructor (engine: Engine, panel: ContentBrowserPanel, filter: (group: ContentSourceGroup, query: string) => void, createCollection: () => void) {
    super(engine); this.clipContents = true; this.setThemeConstantOverride('separation', 1);
    for (const id of ['favorites', 'project', 'collections'] as const) {
      const group = append(this, new EditorCollapsiblePanel(engine, id));
      const heading = group.heading, search = new EditorSearchField(engine, id === 'collections' ? 'Search collections' : 'Search folders');
      const searchContainer = append(group.body, margin(engine, search, 6, 3));
      const list = append(group.body, expand(new VirtualList(engine, 20, entry => entry.id, () => new ContentSourceRow(engine, panel))));
      const searchButton = append(heading, new EditorIconButton(engine, 'search'));
      const add = id === 'collections' ? append(heading, new EditorIconButton(engine, 'addCollection')) : undefined;

      heading.rowHeight = 24; heading.trailingWidth = add ? 46 : 24; heading.setThemeFontSizeOverride('fontSize', EDITOR_FONT_SIZE);
      for (const state of ['normal', 'hover', 'pressed', 'hoverPressed']) { heading.setThemeStyleBoxOverride(state, editorBox(state === 'normal' ? editorColors.panel : editorColors.header)); }
      searchContainer.visible = false;
      search.on('textChanged', query => filter(id, query));
      searchButton.on('pressed', () => {
        searchContainer.visible = !searchContainer.visible;
        if (searchContainer.visible) { group.expanded = true; search.grabFocus(); } else { search.text = ''; filter(id, ''); }
      });
      searchButton.iconSize = 14; searchButton.setCustomMaximumSize(22, 22);
      if (add) { add.iconSize = 14; add.setCustomMaximumSize(22, 22); add.on('pressed', createCollection); }
      heading.on('sizeChanged', () => {
        place(searchButton, heading.width - 24, 1, 22, 22);
        if (add) { place(add, heading.width - 46, 1, 22, 22); }
      });
      heading.on('pressed', () => this.headings.get(id)?.toggle?.());
      if (id === 'project') { expand(group); expand(group.body); }
      this.groups.set(id, { panel: group, list, search });
    }
  }
  setRows (values: SourceItem[]): void {
    this.headings = new Map(values.filter(entry => entry.depth === 0 && ['favorites', 'project', 'collections'].includes(entry.id)).map(entry => [entry.id, entry]));
    let group: ContentSourceGroup = 'favorites';
    const rows = { favorites: [] as SourceItem[], project: [] as SourceItem[], collections: [] as SourceItem[] };

    for (const entry of values) {
      if (this.headings.has(entry.id)) { group = entry.id as ContentSourceGroup; } else { rows[group].push(entry); }
    }
    this.rows = rows;
    for (const [id, view] of this.groups) {
      const heading = this.headings.get(id);

      view.panel.heading.text = heading?.name ?? id; view.panel.expanded = !!heading?.expanded || !!view.search.text;
      view.list.setRows(rows[id]);
      if (id !== 'project') { view.list.setCustomMinimumSize(0, id === 'collections' ? 60 : Math.max(20, Math.min(3, rows[id].length) * 20)); }
    }
  }
  rowsFor (id: string): readonly SourceItem[] { return Object.values(this.rows).find(rows => rows.some(entry => entry.id === id)) ?? []; }
  resetFilters (): void { for (const group of this.groups.values()) { group.search.text = ''; } }
  row (id: string): Control | undefined {
    for (const [key, group] of this.groups) {
      if (id === key) { return group.panel.heading; } const row = group.list.row(id);

      if (row) { return row; }
    }
  }
  reveal (id: string): void { for (const group of this.groups.values()) { group.list.reveal(id); } }
  folderRects (values: SourceItem[]): { x: number, y: number, width: number, height: number, folder: string }[] {
    return values.flatMap(source => {
      if (!source.folder) { return []; }
      for (const group of this.groups.values()) {
        const control = group.list.row(source.id);

        if (!control?.visibleInHierarchy) { continue; }
        const origin = screenPosition(group.list), position = screenPosition(control);
        const top = Math.max(origin.y, position.y), bottom = Math.min(origin.y + group.list.height, position.y + control.height);

        return bottom > top ? [{ x: position.x, y: top, width: control.width, height: bottom - top, folder: source.folder }] : [];
      }

      return [];
    });
  }
}
