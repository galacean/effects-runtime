import { EditorSearchField } from '../../ui/controls/search-field';
import { VFXItem } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventKey, math } from '@galacean/effects';
import type { Control, Label } from '@galacean/effects-plugin-gui';
import { LineEdit, PanelContainer, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem } from '../../framework/registry/editor-registry';
import { EditorSelection } from '../../framework/selection/editor-selection';
import { EditorWindow } from '../../framework/windows/editor-window';
import { append, column, row, margin, expand, label } from '../../ui/controls/layout';
import { EditorMenu, EditorMenuButton } from '../../ui/controls/menu';
import type { MenuAction } from '../../ui/controls/menu';
import { EditorIconButton } from '../../ui/icons/control-icons';
import { ListSelection } from '../../ui/list-view/list-selection';
import { editorColors, editorBox } from '../../ui/theme/control-theme';
import { projectWorkspace } from '../projects/project-workspace';
import type { SceneDocument } from '../scene/document/scene-document';
import { sceneWorkspace } from '../scene/scene-workspace';
import { SceneItemOperations } from '../scene/operations/scene-item-operations';
import { SCENE_ITEM_DESCRIPTORS } from '../scene/ui/scene-item-palette';
import { SceneViewportPanel } from '../scene/viewport/scene-viewport-panel';
import { HierarchyActions } from './hierarchy-actions';
import type { HierarchyNode, HierarchyOptions } from './hierarchy-model';
import { HierarchyModel, itemKey } from './hierarchy-model';
import { HierarchyTree } from './hierarchy-tree';
import type { DropZone } from './hierarchy-tree';

const PREFERENCES = 'effects-editor.hierarchy.v2';

interface ItemPayload { kind: 'hierarchy-items', document: SceneDocument, ids: string[] }

@editorPanel()
export class HierarchyPanel extends EditorWindow {
  private document?: SceneDocument;
  private actions?: HierarchyActions;
  private model?: HierarchyModel;
  private releaseState?: () => void;
  private unsubscribe?: () => void;
  private unsubscribeWorkspace?: () => void;
  private expanded = new Set(['level']);
  private selectedFolders = new Set<string>();
  private readonly selection = new ListSelection<string>();
  private applyingSelection = false;
  private tree?: HierarchyTree;
  private search?: LineEdit;
  private status?: Label;
  private context?: EditorMenu;
  private visibilityDrag?: { visible: boolean, visited: Set<string> };
  private options: HierarchyOptions = {
    autoFrame: true, showInternal: false, onlySelected: false, hideInvisible: false,
    showVisibility: true, showType: true, typeFilter: '', sort: 'hierarchy', descending: false,
  };

  @menuItem('Window/Hierarchy')
  static showWindow (): void { EditorWindow.getWindow(HierarchyPanel).open(); }

  constructor () {
    super(); this.title = 'Hierarchy'; this.open();
    try {
      const data = JSON.parse(window.localStorage.getItem(PREFERENCES) ?? '{}');

      for (const key of ['autoFrame', 'showInternal', 'onlySelected', 'hideInvisible', 'showVisibility', 'showType', 'descending'] as const) {
        if (typeof data[key] === 'boolean') { this.options[key] = data[key]; }
      }
      if (['hierarchy', 'label', 'type', 'visibility'].includes(data.sort)) { this.options.sort = data.sort; }
    } catch (error) { console.warn('Unable to read hierarchy preferences.', error); }
  }

  protected override createContent (engine: Engine): Control {
    const content = column(engine);
    const search = this.search = expand(new EditorSearchField(engine, 'Search…'), true, false);

    search.placeholderText = 'Search...'; search.on('textChanged', () => this.refresh());
    const folder = new EditorIconButton(engine, 'newFolder');

    folder.on('pressed', () => this.newFolder());
    const options = new EditorMenuButton(engine, '');

    options.iconName = 'settings'; options.setCustomMinimumSize(24, 24);
    options.actions = () => this.settingsMenu();
    append(content, margin(engine, row(engine, [search, folder, options]), 8, 6));
    this.context = new EditorMenu(engine);
    this.tree = append(content, expand(new HierarchyTree(engine, this.options, {
      select: (node, event) => this.clickRow(node, event), toggle: (node, recursive) => this.toggle(node, recursive),
      context: (node, position) => this.showContext(node, position), activate: node => node.kind === 'folder' ? this.toggle(node, false) : this.focusScene(),
      rename: (node, name) => { this.actions?.rename(node, name); this.refresh(); },
      visibility: (node, begin) => this.changeVisibility(node, begin), finishVisibility: () => this.finishVisibility(),
      dragData: node => node.editable ? { kind: 'hierarchy-items', document: this.document!, ids: (this.selectedKeys().has(node.id) ? this.selectedRows() : [node]).filter(row => row.editable).map(row => row.id) } satisfies ItemPayload : null,
      canDrop: (node, data, zone) => this.canDrop(node, data, zone), drop: (node, data, zone) => this.drop(node, data, zone),
      key: event => this.keyboard(event), sort: column => {
        if (this.options.sort === column && this.options.descending) { this.options.sort = 'hierarchy'; this.options.descending = false; } else { this.options.descending = this.options.sort === column; this.options.sort = column; }
        this.saveOptions(); this.refresh();
      },
    })));
    this.status = label(engine, '', editorColors.foreground); this.status.verticalAlignment = VerticalAlignment.Center;
    const status = append(content, new PanelContainer(engine));

    status.setThemeStyleBoxOverride('panel', editorBox(editorColors.header));
    append(status, margin(engine, this.status, 14, 9));
    this.unsubscribeWorkspace = sceneWorkspace.subscribeDocument(document => this.bind(document));
    this.bind(sceneWorkspace.current);

    return content;
  }

  private bind (document?: SceneDocument): void {
    if (!this.tree) { return; }
    if (document === this.document) {
      this.refresh();

      return;
    }
    this.finishVisibility(); this.releaseState?.(); this.unsubscribe?.(); this.document = document;
    this.actions = document ? new HierarchyActions(document) : undefined;
    this.expanded = new Set(['level']); this.selectedFolders.clear(); this.selection.replace([]); this.search!.text = '';
    if (document) {
      try {
        const saved = JSON.parse(window.localStorage.getItem(this.expansionKey()) ?? 'null');

        if (Array.isArray(saved) && saved.every(id => typeof id === 'string')) { this.expanded = new Set(saved.map(id => id === 'world' ? 'level' : id)); }
      } catch (error) { console.warn('Unable to read hierarchy expansion.', error); }
      this.releaseState = document.registerEditorState({
        read: () => ({ folders: [...this.selectedFolders], anchor: this.selection.anchor, focused: this.selection.focused }),
        restore: state => { this.selectedFolders = new Set(state.folders); this.selection.anchor = state.anchor; this.selection.focused = state.focused; },
      });
      this.unsubscribe = document.subscribe(() => this.refresh());
    }
    this.refresh();
  }

  private refresh (): void {
    if (!this.tree) { return; }
    const document = this.document;

    if (!document) {
      this.model = undefined; this.tree.setRows([], new Set(), this.expanded); this.status!.text = 'Open a scene to view its items.';

      return;
    }
    this.model = new HierarchyModel(document, document.composition, this.search!.text, this.options, this.expanded, this.selectedKeys());
    this.tree.highlight = this.search!.text;
    for (const id of this.selectedFolders) { if (!this.model.nodes.has(id)) { this.selectedFolders.delete(id); } }
    this.tree.setRows(this.model.rows, this.selectedKeys(), this.expanded);
    const count = this.model.items.length, selected = this.selectedRows().filter(node => node.kind !== 'level').length;

    this.status!.text = (this.model.filtering ? `${this.model.matchedCount} of ${count} items` : `${count} ${count === 1 ? 'item' : 'items'}`) + (selected ? ` (${selected} selected)` : '');
  }

  override onSelectionChange (): void {
    if (this.applyingSelection) { return; }
    if (EditorSelection.changeSource !== 'history') { this.selectedFolders.clear(); }
    this.refresh();
    if (this.options.autoFrame) { this.revealSelection(); }
  }
  override onUndoRedo (): void { this.bind(sceneWorkspace.current); this.revealSelection(); }
  override flushEdits (): void { this.finishVisibility(); }
  override dispose (): void {
    this.unsubscribeWorkspace?.(); this.unsubscribe?.(); this.releaseState?.(); this.context?.dispose(); super.dispose();
  }

  private selectedKeys (): Set<string> {
    const keys = new Set(this.selectedFolders), document = this.document;

    if (document) {
      for (const object of EditorSelection.getSelectedObjects()) {
        if (object === document.composition) { keys.add('level'); } else if (object instanceof VFXItem && object.composition === document.composition) { keys.add(itemKey(document, object)); }
      }
    }

    return keys;
  }
  private selectedRows (): HierarchyNode[] { return [...this.selectedKeys()].flatMap(id => this.model?.nodes.get(id) ? [this.model.nodes.get(id)!] : []); }
  private select (ids: string[]): void {
    const model = this.model, document = this.document;

    if (!model || !document) { return; }
    document.observeEditor('Select objects', () => {
      this.applyingSelection = true;
      this.selectedFolders = new Set(ids.filter(id => model.nodes.get(id)?.kind === 'folder'));
      this.selection.focused = ids.at(-1);
      EditorSelection.setObjects(ids.flatMap<object>(id => {
        const node = model.nodes.get(id);

        return node?.item ? [node.item] : node?.kind === 'level' ? [document.composition] : [];
      }));
      this.applyingSelection = false;
    });
    document.commit(); this.refresh();
  }
  private clickRow (node: HierarchyNode | undefined, event: InputEventMouseButton): void {
    if (!node) {
      if (!event.ctrlPressed && !event.metaPressed) { this.select([]); }

      return;
    }
    this.selection.replace(this.selectedKeys());
    this.selection.choose(node.id, this.model?.rows.map(row => row.id) ?? [], { additive: event.ctrlPressed || event.metaPressed, range: event.shiftPressed });
    this.select([...this.selection.selected]);
  }
  private toggle (node: HierarchyNode, recursive: boolean): void {
    const open = !this.expanded.has(node.id);

    for (const target of recursive ? [node, ...this.model!.descendants(node)] : [node]) {
      if (open && target.children.length) { this.expanded.add(target.id); } else { this.expanded.delete(target.id); }
    }
    this.saveExpanded(); this.refresh();
  }
  private revealSelection (): void {
    const item = EditorSelection.getSelectedObjects().filter((object): object is VFXItem => object instanceof VFXItem).at(-1);
    const id = item && this.document && item.composition === this.document.composition ? itemKey(this.document, item) : this.selection.focused;

    if (!id) { return; }
    for (let node = this.model?.nodes.get(id)?.parent; node; node = node.parent) { this.expanded.add(node.id); }
    this.refresh(); this.tree?.reveal(id);
  }
  private changeVisibility (node: HierarchyNode, begin: boolean): void {
    if (!this.model || !this.document) { return; }
    if (begin) { this.visibilityDrag = { visible: !node.visible, visited: new Set() }; }
    const drag = this.visibilityDrag;

    if (!drag || drag.visited.has(node.id)) { return; }
    drag.visited.add(node.id);
    this.actions?.setVisible(this.model.elements(begin && this.selectedKeys().has(node.id) ? this.selectedRows() : [node]), drag.visible);
    this.document.setScopeActive(this, true); this.refresh();
  }
  private finishVisibility (): void {
    if (!this.visibilityDrag) { return; }
    this.visibilityDrag = undefined; this.document?.setScopeActive(this, false);
  }
  private payloadRows (data: unknown): HierarchyNode[] {
    const payload = data as ItemPayload;

    return payload?.kind === 'hierarchy-items' && payload.document === this.document ? payload.ids.flatMap(id => this.model?.nodes.get(id) ? [this.model.nodes.get(id)!] : []) : [];
  }
  private canDrop (node: HierarchyNode | undefined, data: unknown, zone: DropZone): boolean {
    const target = node ?? this.model?.level;
    const rows = this.payloadRows(data);

    return !!target && !!rows.length && !!(zone === 'inside' ? this.actions?.canMove(rows, target) : this.actions?.canReorder(rows, target));
  }
  private drop (node: HierarchyNode | undefined, data: unknown, zone: DropZone): void {
    const target = node ?? this.model?.level, rows = this.payloadRows(data);

    if (!target || !this.model || !this.canDrop(target, data, zone)) { return; }
    if (zone === 'inside') { this.actions?.move(this.model, rows, target); this.expanded.add(target.id); this.saveExpanded(); } else { this.actions?.reorder(this.model, rows, target, zone); this.options.sort = 'hierarchy'; this.options.descending = false; this.saveOptions(); }
    this.refresh(); if (rows[0]) { this.tree?.reveal(rows[0].id); }
  }
  private newFolder (): void {
    if (!this.model || !this.actions) { return; }
    const id = this.actions.createFolder(this.model, this.selectedRows(), id => {
      this.applyingSelection = true; this.selectedFolders = new Set([id]); this.selection.anchor = this.selection.focused = id;
      EditorSelection.clear(); this.applyingSelection = false;
    });

    this.refresh(); if (id) { this.tree?.rename(id); }
  }
  private focusScene (): void {
    const scene = EditorWindow.getWindow(SceneViewportPanel);

    scene?.open();
    if (this.selectedRows().some(node => node.kind === 'level')) { scene?.frameAll(); } else { scene?.frameSelection(); }
  }
  private keyboard (event: InputEventKey): void {
    if (!this.model || this.tree?.root?.guiGetFocusOwner() instanceof LineEdit) { return; }
    const modifier = event.ctrlPressed || event.metaPressed, code = event.physicalKeycode || event.keycode;
    const rows = this.model.rows, selected = this.selectedRows();
    const index = Math.max(0, rows.findIndex(node => node.id === this.selection.focused));
    const node = rows[index];
    let handled = true, next = -1;

    if (modifier && code === 'KeyA') { this.select(rows.filter(row => row.kind !== 'level').map(row => row.id)); } else if (modifier && code === 'KeyF') { this.search?.grabFocus(); } else if (modifier && code === 'KeyD') { this.actions?.duplicate(this.model, selected); } else if (code === 'F2' && selected.length === 1 && selected[0].editable) { this.tree?.rename(selected[0].id); } else if (!modifier && code === 'KeyF') { this.focusScene(); } else if (code === 'Delete') { this.actions?.remove(this.model, selected.filter(node => node.editable)); } else if (code === 'Escape') { this.select([]); } else if (code === 'ArrowDown') { next = Math.min(rows.length - 1, index + 1); } else if (code === 'ArrowUp') { next = Math.max(0, index - 1); } else if (code === 'Home') { next = 0; } else if (code === 'End') { next = rows.length - 1; } else if (code === 'ArrowLeft' && node) {
      if (this.expanded.has(node.id) && node.children.length) { this.toggle(node, event.shiftPressed); } else if (node.parent) { this.select([node.parent.id]); this.tree?.reveal(node.parent.id); }
    } else if (code === 'ArrowRight' && node?.children.length) {
      if (!this.expanded.has(node.id)) { this.toggle(node, event.shiftPressed); } else { this.select([node.children[0].id]); this.tree?.reveal(node.children[0].id); }
    } else { handled = false; }
    if (rows[next]) {
      this.selection.replace(this.selectedKeys()); this.selection.choose(rows[next].id, rows.map(row => row.id), { range: event.shiftPressed, additive: modifier });
      this.select([...this.selection.selected]); this.tree?.reveal(rows[next].id);
    }
    if (handled) { event.accept(); }
  }
  private showContext (node: HierarchyNode | undefined, position: math.Vector2): void {
    if (!this.context || !this.tree || !this.model) { return; }
    if (node && !this.selectedKeys().has(node.id)) { this.select([node.id]); }
    const rows = node ? this.selectedRows() : [], editable = rows.filter(row => row.editable);
    const model = this.model, actions = this.actions!, document = this.document!;
    const items = model.elements(rows);
    const path = (node: HierarchyNode): string => node.parent?.folder ? path(node.parent) + '/' + node.label : node.label;

    this.context.setActions([
      { label: 'Outliner', heading: true },
      { label: 'Create', children: [...new Set(SCENE_ITEM_DESCRIPTORS.map(item => item.group))].map(group => ({ label: group, children: SCENE_ITEM_DESCRIPTORS.filter(item => item.group === group && item.creatable !== false).map(item => ({ label: item.label, action: () => { new SceneItemOperations(document).create(item, node?.kind === 'folder' ? { folderId: node.folder!.id } : { parent: node?.item }); } })) })) },
      { label: 'Rename', shortcut: 'F2', enabled: editable.length === 1, action: () => this.tree?.rename(editable[0].id) },
      { label: 'Duplicate', shortcut: 'Ctrl+D', enabled: editable.some(node => !!node.item), action: () => { actions.duplicate(model, editable); } },
      { label: 'Delete', shortcut: 'Delete', enabled: !!editable.length, action: () => actions.remove(model, editable) },
      { label: 'Frame Selection', shortcut: 'F', enabled: !!rows.length, action: () => this.focusScene() },
      { label: 'Select Descendants', enabled: rows.some(row => row.children.length > 0), action: () => this.select([...new Set(rows.flatMap(row => model.descendants(row).map(child => child.id)))]) },
      { label: 'Hierarchy', heading: true },
      { label: 'Create Folder', action: () => this.newFolder() },
      { label: 'Move To', enabled: !!editable.length, children: [...model.nodes.values()].filter(target => target.kind === 'level' || target.kind === 'folder').map(target => ({ label: target.kind === 'level' ? 'Scene Root' : path(target), enabled: actions.canMove(editable, target), action: () => actions.move(model, editable, target) })) },
      { label: 'Detach', enabled: editable.some(node => node.item && node.item.parent !== document.composition.sceneRoot), action: () => actions.move(model, editable, model.level) },
      { label: 'Show', heading: true },
      { label: 'Show', enabled: !!items.length, action: () => actions.setVisible(items, true) },
      { label: 'Hide', enabled: !!items.length, action: () => actions.setVisible(items, false) },
      { label: 'Show All', action: () => actions.setVisible(model.items, true) },
    ]);
    this.context.show(this.tree, position);
  }
  private settingsMenu (): MenuAction[] {
    const toggle = (key: keyof HierarchyOptions, title: string): MenuAction => ({ label: title, checked: !!this.options[key], action: () => {
      Reflect.set(this.options, key, !this.options[key]); this.saveOptions(); this.refresh();
    } });
    const types = [...new Set([...this.model?.nodes.values() ?? []].filter(node => node.editable && node.kind === 'item').map(node => node.type))].sort();

    return [
      { label: 'Hierarchy', heading: true },
      { label: 'Expand All', action: () => { this.model?.nodes.forEach(node => { if (node.children.length) { this.expanded.add(node.id); } }); this.saveExpanded(); this.refresh(); } },
      { label: 'Collapse All', action: () => { this.expanded.clear(); this.saveExpanded(); this.refresh(); } },
      toggle('autoFrame', 'Always Frame Selection'), { label: '', separator: true },
      ...([['hierarchy', 'Hierarchy Order'], ['label', 'Item Label'], ['type', 'Type'], ['visibility', 'Visibility']] as const).map(([sort, label]) => ({ label, checked: this.options.sort === sort, action: () => { this.options.sort = sort; this.options.descending = false; this.saveOptions(); this.refresh(); } })),
      toggle('descending', 'Descending'), { label: 'Show', heading: true },
      toggle('onlySelected', 'Only Selected'), toggle('hideInvisible', 'Hide Invisible Items'), toggle('showInternal', 'Show Runtime Objects'),
      { label: 'Filter by Type', children: ['', ...types].map(type => ({ label: type || 'All Types', checked: this.options.typeFilter === type, action: () => { this.options.typeFilter = type; this.refresh(); } })) },
      { label: '', separator: true }, toggle('showVisibility', 'Visibility Column'), toggle('showType', 'Type Column'),
    ];
  }
  private expansionKey (): string { return 'effects-editor.outliner.expanded.' + projectWorkspace.current?.id + ':' + this.document?.composition.id; }
  private saveExpanded (): void {
    if (!this.document) { return; }
    try { window.localStorage.setItem(this.expansionKey(), JSON.stringify([...this.expanded])); } catch (error) { console.warn('Unable to save hierarchy expansion.', error); }
  }
  private saveOptions (): void {
    try { window.localStorage.setItem(PREFERENCES, JSON.stringify(this.options)); } catch (error) { console.warn('Unable to save hierarchy preferences.', error); }
  }
}
