export interface EditorHistoryEntry {
  label: string,
  bytes: number,
  valid: () => boolean,
  undo: () => void,
  redo: () => void,
}

/** A document owns its history; loading another document never replays old instances. */
export class EditorHistory {
  memoryLimit = 64 * 1024 * 1024;
  entryLimit = 100;
  resetReason = '';
  private entries: EditorHistoryEntry[] = [];
  private cursor = 0;
  private bytes = 0;
  private applying = false;

  get canUndo (): boolean { return !this.applying && this.cursor > 0; }
  get canRedo (): boolean { return !this.applying && this.cursor < this.entries.length; }
  get undoLabel (): string { return this.entries[this.cursor - 1]?.label ?? ''; }
  get redoLabel (): string { return this.entries[this.cursor]?.label ?? ''; }
  get size (): number { return this.bytes; }
  get length (): number { return this.entries.length; }

  push (entry: EditorHistoryEntry): void {
    if (this.applying) { return; }
    this.resetReason = '';
    this.entries.splice(this.cursor).forEach(removed => { this.bytes -= removed.bytes; });
    this.entries.push(entry); this.bytes += entry.bytes;
    // Keep the latest operation undoable even if it alone exceeds the soft memory budget.
    while (this.entries.length > 1 && (this.entries.length > this.entryLimit || this.bytes > this.memoryLimit)) {
      this.bytes -= this.entries.shift()!.bytes;
    }
    this.cursor = this.entries.length;
  }

  clear (reason: string): void {
    this.entries = []; this.cursor = 0; this.bytes = 0; this.resetReason = reason;
  }

  undo (): boolean { return this.apply(false); }
  redo (): boolean { return this.apply(true); }

  private apply (redo: boolean): boolean {
    if (redo ? !this.canRedo : !this.canUndo) { return false; }
    const entry = this.entries[redo ? this.cursor : this.cursor - 1];

    if (!entry.valid()) {
      this.clear('An edited object or editor context is no longer available.');

      return false;
    }
    this.applying = true;
    try {
      if (redo) { entry.redo(); } else { entry.undo(); }
      this.cursor += redo ? 1 : -1;

      return true;
    } catch (error) {
      this.clear('The editor could not restore an operation.');
      throw error;
    } finally { this.applying = false; }
  }
}

/** Estimate retained CPU data without walking the engine/GPU object graph. */
export function historyBytes (value: unknown, visited = new Set<object>()): number {
  if (typeof value === 'string') { return value.length * 2; }
  if (value === null || typeof value !== 'object') { return 8; }
  if (visited.has(value)) { return 0; }
  visited.add(value);
  if (Array.isArray(value)) { return value.reduce((total, entry) => total + historyBytes(entry, visited), 24); }
  if (value instanceof Map) { return historyBytes(Array.from(value.entries()), visited); }
  if (value instanceof Set) { return historyBytes(Array.from(value), visited); }
  if (Object.getPrototypeOf(value) !== Object.prototype) { return 32; }

  return Object.entries(value).reduce((total, [key, entry]) => total + key.length * 2 + historyBytes(entry, visited), 24);
}
