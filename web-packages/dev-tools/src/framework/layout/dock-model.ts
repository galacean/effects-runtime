export type DockNode = { kind: 'tabs', id: string, tabs: string[], active: string, hidden?: boolean } |
{ kind: 'split', id: string, vertical: boolean, ratio: number, first: DockNode, second: DockNode };
export interface DockBounds { x: number, y: number, width: number, height: number }
export interface FloatingDock { id: string, bounds: DockBounds, node?: DockNode }
export interface DockSnapshot { root: DockNode, floating: FloatingDock[] }
export type DockEdge = 'center' | 'left' | 'right' | 'top' | 'bottom';

export function validDockSnapshot (value: unknown): value is DockSnapshot {
  const seen = new Set<string>();
  const nodeIds = new Set<string>();
  const unique = (id: unknown): boolean => {
    if (typeof id !== 'string' || seen.has(id)) { return false; }
    seen.add(id);

    return true;
  };
  const node = (n: DockNode, depth = 0): boolean => {
    if (!n || depth > 20 || typeof n.id !== 'string' || nodeIds.has(n.id)) { return false; }
    nodeIds.add(n.id);
    if (n.kind === 'tabs') { return Array.isArray(n.tabs) && n.tabs.every(unique) && typeof n.active === 'string' && (n.hidden === undefined || typeof n.hidden === 'boolean'); }

    return n.kind === 'split' && typeof n.vertical === 'boolean' && Number.isFinite(n.ratio) && n.ratio > 0 && n.ratio < 1 && node(n.first, depth + 1) && node(n.second, depth + 1);
  };
  const snapshot = value as DockSnapshot;

  const frames = new Set<string>();

  return !!snapshot && node(snapshot.root) && Array.isArray(snapshot.floating) && snapshot.floating.every(entry => {
    if (!entry || typeof entry.id !== 'string' || frames.has(entry.id)) { return false; }
    frames.add(entry.id);

    return (entry.node ? node(entry.node) : unique(entry.id)) && entry.bounds && Object.values(entry.bounds).length === 4 && Object.values(entry.bounds).every(Number.isFinite) && entry.bounds.width > 0 && entry.bounds.height > 0;
  });
}

export class DockModel {
  changed?: () => void;
  activated?: (id: string) => void;
  constructor (public snapshot: DockSnapshot) {}
  floatingNode (entry: FloatingDock): DockNode { return entry.node ??= { kind: 'tabs', id: 'floating:' + entry.id, tabs: [entry.id], active: entry.id }; }
  floatingFor (id: string): FloatingDock | undefined {
    const contains = (node: DockNode): boolean => node.kind === 'tabs' ? node.tabs.includes(id) : contains(node.first) || contains(node.second);

    return this.snapshot.floating.find(entry => contains(this.floatingNode(entry)));
  }

  groups (): Extract<DockNode, { kind: 'tabs' }>[] {
    const result: Extract<DockNode, { kind: 'tabs' }>[] = [];
    const visit = (node: DockNode): void => {
      if (node.kind === 'tabs') { result.push(node); } else { visit(node.first); visit(node.second); }
    };

    visit(this.snapshot.root);
    this.snapshot.floating.forEach(entry => visit(this.floatingNode(entry)));

    return result;
  }
  groupFor (id: string): Extract<DockNode, { kind: 'tabs' }> | undefined { return this.groups().find(group => group.tabs.includes(id)); }
  activate (id: string): void {
    const group = this.groupFor(id);

    if (group && group.active !== id) { group.active = id; this.activated?.(id); }
    const floating = this.floatingFor(id), index = floating ? this.snapshot.floating.indexOf(floating) : -1;

    if (index >= 0) {
      this.snapshot.floating.push(this.snapshot.floating.splice(index, 1)[0]); this.activated?.(id);
    }
  }
  float (id: string, bounds: DockBounds): void {
    this.remove(id); this.snapshot.floating.push({ id, bounds }); this.changed?.();
  }
  dock (id: string, groupId: string, edge: DockEdge, before?: string): void {
    const group = this.groups().find(group => group.id === groupId);

    if (!group || group.tabs.length === 1 && group.tabs[0] === id) { return; }
    this.remove(id);
    if (edge === 'center') {
      const index = before ? group.tabs.indexOf(before) : -1;

      if (index >= 0) { group.tabs.splice(index, 0, id); } else { group.tabs.push(id); }
      group.active = id;
    } else {
      const suffix = String(Date.now());
      const old: DockNode = { ...group, id: group.id + '-old-' + suffix, tabs: [...group.tabs] };
      const added: DockNode = { kind: 'tabs', id: group.id + '-new-' + suffix, tabs: [id], active: id };
      const leading = edge === 'left' || edge === 'top';
      const replacement: DockNode = { kind: 'split', id: group.id, vertical: edge === 'top' || edge === 'bottom', ratio: .5, first: leading ? added : old, second: leading ? old : added };
      const replace = (node: DockNode): DockNode => {
        if (node === group) { return replacement; }
        if (node.kind === 'split') { node.first = replace(node.first); node.second = replace(node.second); }

        return node;
      };

      this.snapshot.root = replace(this.snapshot.root);
      for (const entry of this.snapshot.floating) { entry.node = replace(this.floatingNode(entry)); }
    }
    this.changed?.();
  }
  private remove (id: string): void {
    for (const group of this.groups()) {
      group.tabs = group.tabs.filter(tab => tab !== id);
      if (group.active === id) { group.active = group.tabs[0] ?? ''; }
    }
    const hasPanels = (node: DockNode): boolean => node.kind === 'tabs' ? !!node.tabs.length : hasPanels(node.first) || hasPanels(node.second);

    this.snapshot.floating = this.snapshot.floating.filter(entry => hasPanels(this.floatingNode(entry)));
  }
}
