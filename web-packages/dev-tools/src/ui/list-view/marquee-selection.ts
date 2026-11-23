export type MarqueeSelectionMode = 'replace' | 'add' | 'remove' | 'toggle';
export interface MarqueeModifiers { ctrlPressed: boolean, metaPressed: boolean, shiftPressed: boolean, altPressed: boolean }

export function marqueeSelectionMode (event: MarqueeModifiers): MarqueeSelectionMode {
  return event.ctrlPressed || event.metaPressed ? 'toggle' : event.shiftPressed ? 'add' : event.altPressed ? 'remove' : 'replace';
}

export function applyMarqueeSelection<T> (initial: Iterable<T>, hits: Iterable<T>, mode: MarqueeSelectionMode): T[] {
  const result = new Set(mode === 'replace' ? [] : initial);

  for (const hit of new Set(hits)) {
    if (mode === 'remove' || mode === 'toggle' && result.has(hit)) { result.delete(hit); } else { result.add(hit); }
  }

  return [...result];
}
