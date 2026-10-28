import { EffectsObject } from '@galacean/effects';

export type Data = Record<string, any>;

export function jsonData<T> (value: T): T {
  const visited = new Set<object>();
  const convert = (entry: any): any => {
    if (entry instanceof EffectsObject) { return { id: entry.getInstanceId() }; }
    if (entry === null || typeof entry === 'string' || typeof entry === 'boolean') { return entry; }
    if (typeof entry === 'number') {
      if (!Number.isFinite(entry)) { throw new Error('Scene properties must contain finite numbers.'); }

      return entry;
    }
    if (!entry || typeof entry !== 'object') { return undefined; }
    if (visited.has(entry)) { throw new Error('A scene property contains a circular reference.'); }
    if (ArrayBuffer.isView(entry)) { return Array.from(entry as unknown as ArrayLike<number>); }
    if (entry instanceof ArrayBuffer || typeof Element !== 'undefined' && entry instanceof Element) { return undefined; }
    visited.add(entry);
    const result = Array.isArray(entry) ? entry.map(convert) : Object.fromEntries(Object.entries(entry)
      .map(([key, item]) => [key, convert(item)]).filter(([, item]) => item !== undefined));

    visited.delete(entry);

    return result;
  };

  return convert(value) as T;
}

export function sameData (a: unknown, b: unknown): boolean {
  if (a === b) { return true; }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') { return false; }
  if (Array.isArray(a) !== Array.isArray(b)) { return false; }
  const left = Object.keys(a), right = Object.keys(b);

  return left.length === right.length && left.every(key => key in b && sameData((a as Data)[key], (b as Data)[key]));
}

/** Apply only edited fields, leaving sampled animation values in other fields out of the document. */
export function patchData (target: Data, before: Data, after: Data): void {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (sameData(before[key], after[key])) { continue; }
    if (!(key in after)) { delete target[key]; } else if (before[key] && after[key] && !Array.isArray(before[key]) && !Array.isArray(after[key]) &&
      typeof before[key] === 'object' && typeof after[key] === 'object') {
      if (!target[key] || typeof target[key] !== 'object') { target[key] = {}; }
      patchData(target[key], before[key], after[key]);
    } else { target[key] = jsonData(after[key]); }
  }
}

export function resolveSceneURLs<T> (data: T, baseURL: string): T {
  const result = jsonData(data);
  const visit = (value: any): void => {
    if (!value || typeof value !== 'object') { return; }
    for (const [key, child] of Object.entries(value)) {
      if (['url', 'fontURL', 'webp', 'avif', 'ktx2'].includes(key) && child) {
        if (typeof child === 'string') { value[key] = new URL(child, baseURL).href; } else if (Array.isArray(child)) {
          value[key] = child.map(entry => typeof entry === 'string' ? new URL(entry, baseURL).href : entry);
        } else { visit(child); }
      } else { visit(child); }
    }
  };

  visit(result);

  return result;
}
