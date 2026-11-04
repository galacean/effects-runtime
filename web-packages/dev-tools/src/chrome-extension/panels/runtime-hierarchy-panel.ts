import type { Engine, InputEventKey } from '@galacean/effects';
import type { Control, Label } from '@galacean/effects-plugin-gui';
import { VerticalAlignment } from '@galacean/effects-plugin-gui';
import { EditorWindow } from '../../framework/windows/editor-window';
import type { RuntimeConnection } from '../bridge/runtime-connection';
import { append, column, expand, label, margin } from '../../ui/controls/layout';
import { EditorSearchField } from '../../ui/controls/search-field';
import { EditorMenu } from '../../ui/controls/menu';
import { RuntimeHierarchyTree } from './runtime-hierarchy-tree';
import type { RuntimeHierarchyNode, RuntimeHierarchyOptions } from './runtime-hierarchy-tree';
import { SCENE_ITEM_DESCRIPTORS } from '../../features/scene/ui/scene-item-palette';

export class RuntimeHierarchyPanel extends EditorWindow {
  private tree!: RuntimeHierarchyTree;
  private search!: EditorSearchField;
  private status!: Label;
  private context!: EditorMenu;
  private readonly expanded = new Set<string>();
  private readonly nodes = new Map<string, RuntimeHierarchyNode>();
  private readonly options: RuntimeHierarchyOptions = { showVisibility: true, showType: true, sort: 'hierarchy', descending: false };

  constructor (private readonly connection: RuntimeConnection) { super(); this.title = 'Hierarchy'; this.open(); }
  protected override createContent (engine: Engine): Control {
    const content = column(engine);

    this.search = new EditorSearchField(engine, 'Search…'); this.search.on('textChanged', () => this.refresh());
    append(content, margin(engine, this.search, 8, 6));
    this.context = new EditorMenu(engine);
    this.tree = append(content, expand(new RuntimeHierarchyTree(engine, this.options, {
      select: node => this.connection.select(node?.id),
      toggle: (node, recursive) => {
        const open = !this.expanded.has(node.id);
        const visit = (target: RuntimeHierarchyNode): void => { if (open) { this.expanded.add(target.id); } else { this.expanded.delete(target.id); } if (recursive) { target.children.forEach(visit); } };

        visit(node); this.refresh();
      },
      activate: node => { this.connection.select(node.id); this.connection.command({ type: 'log' }); },
      context: (node, point) => {
        if (node) { this.connection.select(node.id); }
        this.context.setActions([{ label: 'Object', heading: true }, { label: 'Log to Console', enabled: !!node, action: () => this.connection.command({ type: 'log' }) },
          { label: 'Visibility', heading: true }, { label: 'Visible', checked: node?.visible, enabled: node?.kind === 'item', action: () => { if (node) { this.connection.command({ type: 'visible', id: node.id, value: !node.visible }); } } }]);
        this.context.show(this.tree, point);
      },
      visibility: node => this.connection.command({ type: 'visible', id: node.id, value: !node.visible }), finishVisibility: () => {},
      key: event => this.key(event),
      sort: sort => { if (this.options.sort === sort && this.options.descending) { this.options.sort = 'hierarchy'; this.options.descending = false; } else { this.options.descending = this.options.sort === sort; this.options.sort = sort; } this.refresh(); },
    })));
    this.tree.list.emptyText = 'No scene items';
    this.status = label(engine, ''); append(content, margin(engine, this.status, 12, 4));
    this.status.verticalAlignment = VerticalAlignment.Center;

    return content;
  }
  refresh (): void {
    if (!this.tree) { return; }
    const previous = new Set(this.nodes.keys());

    this.nodes.clear();
    const roots: RuntimeHierarchyNode[] = [];
    const entries = this.connection.snapshot.nodes;

    for (const entry of entries) {
      const descriptor = SCENE_ITEM_DESCRIPTORS.find(descriptor => String(descriptor.type) === entry.itemType);
      const node: RuntimeHierarchyNode = { id: entry.id, label: entry.name, type: entry.parent ? descriptor?.label ?? entry.type : 'Scene',
        icon: entry.parent ? descriptor?.icon ?? 'cube' : 'scene', kind: entry.parent ? 'item' : 'level', children: [], visible: entry.visible, active: entry.active, depth: 0 };

      this.nodes.set(entry.id, node);
      if (!previous.has(entry.id)) { this.expanded.add(entry.id); }
    }
    for (const id of this.expanded) { if (!this.nodes.has(id)) { this.expanded.delete(id); } }
    entries.forEach(entry => {
      const node = this.nodes.get(entry.id)!, parent = entry.parent && this.nodes.get(entry.parent);

      if (parent) { node.parent = parent; parent.children.push(node); } else { roots.push(node); }
    });
    const query = this.search.text.trim().toLocaleLowerCase(), rows: RuntimeHierarchyNode[] = [];
    const matches = (node: RuntimeHierarchyNode): boolean => !query || (node.label + ' ' + node.type).toLocaleLowerCase().includes(query) || node.children.some(matches);
    const visit = (siblings: RuntimeHierarchyNode[], depth: number): void => {
      const sorted = [...siblings];

      if (this.options.sort !== 'hierarchy') { sorted.sort((a, b) => this.options.sort === 'visibility' ? Number(a.visible) - Number(b.visible) : (this.options.sort === 'type' ? a.type : a.label).localeCompare(this.options.sort === 'type' ? b.type : b.label)); if (this.options.descending) { sorted.reverse(); } }
      sorted.forEach(node => { if (!matches(node)) { return; } node.depth = depth; rows.push(node); if (query || this.expanded.has(node.id)) { visit(node.children, depth + 1); } });
    };

    visit(roots, 0);
    this.tree.highlight = this.search.text;
    this.tree.setRows(rows, new Set(this.connection.snapshot.selectedId ? [this.connection.snapshot.selectedId] : []), this.expanded);
    this.status.text = entries.filter(entry => !!entry.parent).length + ' items';
  }
  private key (event: InputEventKey): void {
    const selected = this.connection.snapshot.selectedId && this.nodes.get(this.connection.snapshot.selectedId);

    if (event.keycode === 'Escape') { this.connection.select(); } else if (event.keycode === 'ArrowRight' && selected) { this.expanded.add(selected.id); this.refresh(); } else if (event.keycode === 'ArrowLeft' && selected) { this.expanded.delete(selected.id); this.refresh(); } else { return; }
    event.accept();
  }
  override dispose (): void { this.context?.dispose(); super.dispose(); }
}
