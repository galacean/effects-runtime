import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { LineEdit } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem } from '../../framework/registry/editor-registry';
import { EditorWindow } from '../../framework/windows/editor-window';
import { append, column, expand, margin } from '../../ui/controls/layout';
import { VirtualList } from '../../ui/controls/virtual-list';
import { EditorSearchField } from '../../ui/controls/search-field';
import { EditorSelectableRow } from '../../ui/controls/selectable-row';
import { editorBox, editorColors } from '../../ui/theme/control-theme';
import { PanelContainer, HSeparator } from '@galacean/effects-plugin-gui';
import { EditorTextField } from '../../ui/controls/text-field';
import { EditorToolbar } from '../../ui/controls/toolbar';
import { sceneWorkspace } from '../scene/scene-workspace';

export interface CompositionSource { url: string, name: string }
let compositionCatalog: readonly CompositionSource[] = [];

export function configureCompositionCatalog (sources: readonly CompositionSource[]): void { compositionCatalog = sources; }

class CompositionRow extends EditorSelectableRow {
  private source?: CompositionSource;
  constructor (engine: Engine) {
    super(engine, 'sequence');
    this.on('pressed', () => { if (this.source && !sceneWorkspace.busy) { void sceneWorkspace.requestOpen(this.source.url); } });
  }
  bind (source: CompositionSource): void { this.source = source; this.text = source.name; }
  override update (dt: number): void {
    this.disabled = sceneWorkspace.busy; this.selected = this.source?.url === sceneWorkspace.sourceURL; super.update(dt);
  }
}

@editorPanel()
export class CompositionBrowserPanel extends EditorWindow {
  private list!: VirtualList<CompositionSource>;
  private url!: LineEdit;
  private sourceURL = '';
  @menuItem('Window/Composition')
  static showWindow (): void { EditorWindow.getWindow(CompositionBrowserPanel).open(); }
  constructor () { super(); this.title = 'Composition'; this.open(); }
  protected override createContent (engine: Engine): Control {
    const root = column(engine, [], 6), search = new EditorSearchField(engine);

    search.placeholderText = 'Search compositions'; append(root, margin(engine, search, 6, 3));
    this.url = new EditorTextField(engine); this.url.placeholderText = 'Composition URL';
    this.url.on('textSubmitted', text => { if (text.trim()) { void sceneWorkspace.requestOpen(text.trim()); } });
    const address = new EditorToolbar(engine, 24);

    address.label('URL'); append(address, expand(this.url, true, false)); append(root, margin(engine, address, 6, 0));
    const divider = append(root, new HSeparator(engine));

    divider.setCustomMinimumSize(0, 1);
    const listPanel = append(root, expand(new PanelContainer(engine)));

    listPanel.setThemeStyleBoxOverride('panel', editorBox(editorColors.recessed, 2, 0, editorColors.outline));
    this.list = append(listPanel, expand(new VirtualList(engine, 22, entry => entry.url, () => new CompositionRow(engine))));
    this.list.emptyText = 'No matching compositions';
    this.list.setRows(compositionCatalog);
    search.on('textChanged', text => this.list.setRows(compositionCatalog.filter(entry => entry.name.toLowerCase().includes(text.toLowerCase()))));

    return root;
  }
  override update (): void {
    if (!this.url) { return; }
    const url = sceneWorkspace.sourceURL ?? '';

    if (url !== this.sourceURL) { this.sourceURL = url; this.url.text = url; }
    this.url.editable = !sceneWorkspace.busy;
  }
}
