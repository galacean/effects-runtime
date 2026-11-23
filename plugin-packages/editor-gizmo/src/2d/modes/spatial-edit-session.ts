import type { SpatialEditModeId, SpatialEditHost, SpatialEditDataMap, SpatialEditEvent, SpatialEditTarget } from './spatial-edit-host';

let sequence = 0;

/** Isolate spatial snapshots from their source data and event listeners. */
function cloneSpatialData<T> (value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A single gesture owns a frozen source revision and cumulative draft. */
export class SpatialEditSession<K extends SpatialEditModeId> {
  readonly id = ++sequence;
  readonly context: string;
  readonly before: SpatialEditDataMap[K];
  after: SpatialEditDataMap[K];
  private active = true;

  constructor (readonly mode: K, readonly target: SpatialEditTarget<K>, private readonly host: SpatialEditHost) {
    this.context = host.contextKey();
    this.before = cloneSpatialData(target.data);
    this.after = cloneSpatialData(target.data);
    if (!this.valid()) { throw new Error('The edit target is unavailable.'); }
    this.emit('start');
  }

  valid (): boolean {
    const current = this.host.read(this.mode);

    return this.active && this.context === this.host.contextKey()
      && this.host.canEdit(this.mode, this.target.id)
      && current?.id === this.target.id && current.revision === this.target.revision;
  }

  update (after: SpatialEditDataMap[K]): boolean {
    if (!this.valid()) {
      this.cancel('context-changed');

      return false;
    }
    this.after = cloneSpatialData(after);
    this.emit('update');

    return true;
  }

  commit (): void {
    if (!this.valid()) {
      this.cancel('context-changed');

      return;
    }
    this.active = false;
    if (JSON.stringify(this.before) === JSON.stringify(this.after)) { this.emit('cancel', 'unchanged'); } else { this.emit('commit'); }
  }

  cancel (reason: string): void {
    if (!this.active) { return; }
    this.active = false;
    this.after = cloneSpatialData(this.before);
    this.emit('cancel', reason);
  }

  private emit (phase: SpatialEditEvent<K>['phase'], reason?: string): void {
    this.host.dispatch({ mode: this.mode, sessionId: this.id, phase, targetId: this.target.id,
      revision: this.target.revision, context: this.context, dimension: 3,
      coordinateSpace: this.mode === 'viewport-3d' ? 'world' : 'local', units: 'document',
      before: cloneSpatialData(this.before), after: cloneSpatialData(this.after), reason });
  }
}
