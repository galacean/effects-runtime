import type { DockBounds, DockNode, DockSnapshot } from './dock-model';
import { validDockSnapshot } from './dock-model';

interface LegacyWindow { id: string, name: string, dock?: string, order: number, bounds: DockBounds }
interface LegacyNode { id: string, parent?: string, split?: string, selected?: number, width: number, height: number, bounds?: DockBounds }

export function legacyWindowId (name: string): string {
  const id = name.includes('###') ? name.split('###').at(-1)! : name;

  return ({ Outliner: 'Hierarchy', ContentTextureEditor: 'Texture Editor', ContentObjectAssetEditor: 'Content Asset Editor', Project: 'Content Browser' } as Record<string, string>)[id] ?? id;
}

function titleHash (name: string): number {
  let hash = 0xffffffff;

  for (let index = 0; index < name.length; index++) {
    if (name.startsWith('###', index)) { hash = 0xffffffff; }
    for (const byte of new TextEncoder().encode(name[index])) {
      hash ^= byte;
      for (let bit = 0; bit < 8; bit++) { hash = hash >>> 1 ^ (hash & 1 ? 0xedb88320 : 0); }
    }
  }

  return (hash ^ 0xffffffff) >>> 0;
}

/** Reads saved window geometry once when upgrading an existing workspace. */
export function readLegacyLayout (source: string): DockSnapshot | undefined {
  const windows: LegacyWindow[] = [];

  for (const match of source.matchAll(/\[Window\]\[([^\n]+)\]\r?\n([\s\S]*?)(?=\n\[|$)/g)) {
    const [, name, body] = match, position = body.match(/(?:^|\n)Pos=(-?[\d.]+),(-?[\d.]+)/), size = body.match(/(?:^|\n)Size=([\d.]+),([\d.]+)/), dock = body.match(/DockId=(0x[\da-f]+)(?:,(\d+))?/i);
    const id = legacyWindowId(name);

    if (!position || !size || id === 'Preview' || id.startsWith('##')) { continue; }
    windows.push({ id, name, dock: dock?.[1], order: Number(dock?.[2] ?? 0), bounds: { x: Number(position[1]), y: Number(position[2]), width: Number(size[1]), height: Number(size[2]) } });
  }
  const nodes: LegacyNode[] = [], roots: string[] = [];

  for (const line of source.split(/\r?\n/)) {
    const match = line.trim().match(/^(DockSpace|DockNode)\s+ID=(0x[\da-f]+)(.*)$/i);

    if (!match) { continue; }
    const values = Object.fromEntries([...match[3].matchAll(/(\w+)=([^\s]+)/g)].map(value => [value[1], value[2]])), size = (values.SizeRef ?? values.Size ?? '1,1').split(',').map(Number);
    const position = values.Pos?.split(',').map(Number), frameSize = values.Size?.split(',').map(Number);

    nodes.push({ id: match[2], parent: values.Parent, split: values.Split, selected: values.Selected ? Number(values.Selected) : undefined, width: size[0], height: size[1],
      bounds: position && frameSize ? { x: position[0], y: position[1], width: frameSize[0], height: frameSize[1] } : undefined });
    if (match[1] === 'DockSpace') { roots.push(match[2]); }
  }
  if (!roots.length) { return; }
  const used = new Set<string>(), visited = new Set<string>();
  const build = (id: string, depth = 0): DockNode | undefined => {
    if (visited.has(id) || depth > 20) { return; }
    visited.add(id);
    const node = nodes.find(node => node.id === id), children = nodes.filter(child => child.parent === id);

    if (node?.split && children.length === 2) {
      const first = build(children[0].id, depth + 1), second = build(children[1].id, depth + 1), vertical = node.split === 'Y';
      const a = vertical ? children[0].height : children[0].width, b = vertical ? children[1].height : children[1].width;

      if (first && second) { return { kind: 'split', id, vertical, ratio: Math.max(.05, Math.min(.95, a / Math.max(1, a + b))), first, second }; }

      return first ?? second;
    }
    const entries = windows.filter(window => window.dock === id && !used.has(window.id)).sort((a, b) => a.order - b.order);

    entries.forEach(window => used.add(window.id));

    return { kind: 'tabs', id, tabs: entries.map(window => window.id), active: entries.find(window => titleHash(window.name) === node?.selected)?.id ?? entries[0]?.id ?? '' };
  };
  const root = build(roots[0]);

  if (!root) { return; }
  const floating: DockSnapshot['floating'] = [];

  for (const window of windows) {
    if (used.has(window.id)) { continue; }
    let frame = nodes.find(node => node.id === window.dock);

    for (let depth = 0; frame?.parent && depth < 20; depth++) {
      const parent = nodes.find(node => node.id === frame?.parent);

      if (!parent || roots.includes(parent.id)) { break; }
      frame = parent;
    }
    const node = frame ? build(frame.id) : undefined;

    used.add(window.id); floating.push({ id: window.id, bounds: frame?.bounds ?? window.bounds, node: node ?? { kind: 'tabs', id: 'floating:' + window.id, tabs: [window.id], active: window.id } });
  }
  const snapshot = { root, floating };

  return validDockSnapshot(snapshot) ? snapshot : undefined;
}
