import type { Composition, VFXItem, spec } from '@galacean/effects';
import type { EditorIcon } from '../../ui/icons/control-icons';
import type { SceneDocument } from '../scene/document/scene-document';
import type { SceneFolder, SceneHierarchyData } from '../scene/document/scene-types';
import { SCENE_ITEM_DESCRIPTORS } from '../scene/ui/scene-item-palette';

export interface HierarchyOptions {
  autoFrame: boolean,
  showInternal: boolean,
  onlySelected: boolean,
  hideInvisible: boolean,
  showVisibility: boolean,
  showType: boolean,
  typeFilter: string,
  sort: 'hierarchy' | 'label' | 'type' | 'visibility',
  descending: boolean,
}

export interface HierarchyNode {
  id: string,
  label: string,
  type: string,
  icon: EditorIcon,
  kind: 'level' | 'folder' | 'item',
  item?: VFXItem,
  folder?: SceneFolder,
  parent?: HierarchyNode,
  children: HierarchyNode[],
  editable: boolean,
  matched: boolean,
  retained: boolean,
  visible: boolean,
  highlighted: boolean,
  depth: number,
}

const ITEM_TYPES = Object.fromEntries(SCENE_ITEM_DESCRIPTORS.map(entry => [entry.type, [entry.label, entry.icon]])) as Partial<Record<spec.ItemType, [string, EditorIcon]>>;

export function hierarchyData (document: SceneDocument): SceneHierarchyData {
  return document.editor.hierarchy ?? { folders: [], itemFolders: {} };
}

export function itemKey (document: SceneDocument, item: VFXItem): string { return 'item:' + document.serializer.id(item); }
export function folderKey (id: string): string { return 'folder:' + id; }

export function matchHierarchySearch (query: string, label: string, type: string): boolean {
  const terms = query.matchAll(/([+-]?)(?:(name|label|type|class):)?(?:"([^"]*)"|([^\s]+))/gi);

  for (const term of terms) {
    const text = (term[3] ?? term[4] ?? '').toLocaleLowerCase();
    const fields = term[2] ? [(['name', 'label'].includes(term[2].toLowerCase()) ? label : type).toLocaleLowerCase()] : [label.toLocaleLowerCase(), type.toLocaleLowerCase()];
    const match = fields.some(field => term[1] === '+' ? field === text : field.includes(text));

    if (term[1] === '-' ? match : !match) { return false; }
  }

  return true;
}

export class HierarchyModel {
  readonly nodes = new Map<string, HierarchyNode>();
  readonly rows: HierarchyNode[] = [];
  readonly items: VFXItem[] = [];
  readonly level: HierarchyNode;
  readonly filtering: boolean;
  matchedCount = 0;

  constructor (readonly document: SceneDocument, readonly composition: Composition, query: string,
    options: HierarchyOptions, expanded: Set<string>, selected: Set<string>) {
    this.filtering = !!query.trim() || options.onlySelected || options.hideInvisible || !!options.typeFilter;
    this.level = this.add({ id: 'level', label: document.name || composition.name, type: 'Scene', icon: 'scene', kind: 'level', editable: false });
    const data = hierarchyData(document);
    const folders = new Map(data.folders.map(folder => [folder.id, this.add({ id: folderKey(folder.id), label: folder.name,
      type: 'Folder', icon: 'folder', kind: 'folder', folder, editable: true })]));

    for (const folder of data.folders) {
      const node = folders.get(folder.id)!;
      let parent = folders.get(folder.parentId ?? '');
      const seen = new Set([folder.id]);
      let ancestor = parent;

      while (ancestor) {
        if (seen.has(ancestor.folder!.id)) {
          parent = undefined;

          break;
        }
        seen.add(ancestor.folder!.id); ancestor = folders.get(ancestor.folder!.parentId ?? '');
      }
      this.attach(node, parent ?? this.level);
    }
    const visit = (item: VFXItem, parent: HierarchyNode): void => {
      const editable = !!item.definition.id && item !== composition.sceneRoot && item !== composition.root;

      if (!editable && !options.showInternal) {
        item.children.forEach(child => visit(child, parent));

        return;
      }
      const [type, icon] = ITEM_TYPES[item.type] ?? ['VFXItem', 'cube'];
      const node = this.add({ id: itemKey(document, item), label: item.name, type: editable ? type : 'Runtime Object', icon, kind: 'item', item, editable });

      if (editable) { this.items.push(item); }
      const folder = parent === this.level ? folders.get(data.itemFolders[document.serializer.id(item)]) : undefined;

      this.attach(node, folder ?? parent);
      item.children.forEach(child => visit(child, node));
    };

    composition.sceneRoot.children.forEach(item => visit(item, this.level));
    if (options.showInternal) {
      for (const item of composition.root.children) { if (item !== composition.sceneRoot) { visit(item, this.level); } }
    }
    const filter = (node: HierarchyNode): boolean => {
      const childMatches = node.children.map(filter).some(Boolean);
      const isItem = node.kind === 'item';

      node.visible = node.item ? node.item.isVisible : !node.children.length || node.children.some(child => child.visible);
      node.matched = matchHierarchySearch(query, node.label, node.type) && (!options.onlySelected || selected.has(node.id)) &&
        (!options.hideInvisible || !isItem || !!node.item?.isVisible) && (!options.typeFilter || node.type === options.typeFilter);
      if (isItem && node.editable && node.matched) { this.matchedCount++; }
      node.retained = node.matched || childMatches;
      node.highlighted = node.children.some(child => selected.has(child.id) || child.highlighted);

      return node.retained;
    };
    const compare = (a: HierarchyNode, b: HierarchyNode): number => {
      const priority = (a.kind === 'folder' ? 0 : 1) - (b.kind === 'folder' ? 0 : 1);
      const result = options.sort === 'visibility' ? priority || Number(a.visible) - Number(b.visible) :
        priority || (options.sort === 'type' ? a.type.localeCompare(b.type) : 0) || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });

      return options.descending ? -result : result;
    };
    const flatten = (node: HierarchyNode, depth: number): void => {
      if (this.filtering && !node.retained) { return; }
      node.depth = depth; this.rows.push(node);
      if (options.sort !== 'hierarchy') { node.children.sort(compare); }
      if (expanded.has(node.id) || this.filtering) { node.children.forEach(child => flatten(child, depth + 1)); }
    };

    filter(this.level);
    if (!this.filtering || this.level.children.some(node => node.retained)) { flatten(this.level, 0); }
  }

  descendants (node: HierarchyNode): HierarchyNode[] { return node.children.flatMap(child => [child, ...this.descendants(child)]); }

  elements (nodes: HierarchyNode[], recursive = false): VFXItem[] {
    return [...new Set(nodes.flatMap(node => node.kind === 'level' ? this.items :
      node.kind === 'folder' || recursive ? [node, ...this.descendants(node)].flatMap(child => child.item && child.editable ? [child.item] : []) :
        node.item && node.editable ? [node.item] : []))];
  }

  private add (data: Omit<HierarchyNode, 'children' | 'depth' | 'matched' | 'retained' | 'visible' | 'highlighted'>): HierarchyNode {
    const node = { ...data, children: [], depth: 0, matched: true, retained: true, visible: true, highlighted: false };

    this.nodes.set(node.id, node);

    return node;
  }

  private attach (node: HierarchyNode, parent: HierarchyNode): void { node.parent = parent; parent.children.push(node); }
}
