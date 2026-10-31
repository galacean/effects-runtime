import type { Engine, InputEventKey } from '@galacean/effects';
import { VBoxContainer } from '@galacean/effects-plugin-gui';
import { append, expand, margin } from '../../../ui/controls/layout';
import { EditorSearchField } from '../../../ui/controls/search-field';
import { VirtualList } from '../../../ui/controls/virtual-list';
import { ContentSourceRow, navigateContentSources, type SourceItem } from '../../content-browser/content-sources-view';
import { assetLibrary } from '../asset-library';
import { ASSET_ROOT } from '../model/asset-types';

export class ContentPathPicker extends VBoxContainer {
  private readonly search: EditorSearchField;
  private readonly list: VirtualList<SourceItem>;
  private readonly expanded = new Set([ASSET_ROOT]);
  private rows: SourceItem[] = [];
  private selected = ASSET_ROOT;
  private revision = -1;

  constructor (engine: Engine, private readonly choose: (folder: string) => void) {
    super(engine); this.setThemeConstantOverride('separation', 2);
    this.search = new EditorSearchField(engine, 'Search folders');
    this.search.on('textChanged', () => this.refresh()); append(this, margin(engine, this.search, 6, 4));
    this.list = append(this, expand(new VirtualList(engine, 20, row => row.id, () => new ContentSourceRow(engine, { sourceKey: (row, event) => this.key(row, event) }))));
    this.list.emptyText = 'No matching folders';
  }
  select (folder: string): void {
    this.selected = folder;
    assetLibrary.path(folder).forEach(entry => this.expanded.add(entry.id)); this.refresh(); this.list.reveal(folder);
  }
  private refresh (): void {
    const rows: SourceItem[] = [], query = this.search.text.trim().toLocaleLowerCase();
    const visit = (id: string, name: string, depth: number): void => {
      const children = assetLibrary.children(id).filter(entry => entry.kind === 'folder').sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      if (query && !name.toLocaleLowerCase().includes(query) && !assetLibrary.descendants(id).some(entry => entry.kind === 'folder' && entry.name.toLocaleLowerCase().includes(query))) { return; }
      rows.push({ id, name, icon: 'folder', folder: id, depth, selected: id === this.selected, expanded: this.expanded.has(id) || !!query,
        toggle: children.length ? () => { if (this.expanded.has(id)) { this.expanded.delete(id); } else { this.expanded.add(id); } this.refresh(); } : undefined,
        action: () => { this.selected = id; this.refresh(); this.choose(id); },
      });
      if (this.expanded.has(id) || query) { children.forEach(entry => visit(entry.id, entry.name, depth + 1)); }
    };

    visit(ASSET_ROOT, 'Content', 0); this.rows = rows; this.list.setRows(rows); this.revision = assetLibrary.revision;
  }
  private key (row: SourceItem, event: InputEventKey): boolean {
    return navigateContentSources(this.rows, row, event, target => { this.list.reveal(target.id); this.list.row(target.id)?.grabFocus(); });
  }
  override update (dt: number): void { if (this.revision !== assetLibrary.revision) { this.refresh(); } super.update(dt); }
}
