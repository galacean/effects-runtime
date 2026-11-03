import type { RuntimeBridge, RuntimeCommand, RuntimeField, RuntimeSnapshot, RuntimeValue } from './protocol';
import { emptyRuntimeSnapshot, RUNTIME_PROTOCOL_VERSION } from './protocol';

export class RuntimeConnection {
  snapshot = emptyRuntimeSnapshot();
  error = '';
  changed?: () => void;
  private readonly fields = new Map<string, RuntimeField>();
  private readonly edits = new Map<object, string>();
  private commands: RuntimeCommand[] = [];
  private pending?: Promise<void>;
  private nextRequest = 0;
  private transactionId = 0;
  private playerId?: string;
  private previewId?: string;
  private visible = true;
  private disposed = false;
  private generation = 0;

  constructor (private readonly bridge: RuntimeBridge) {}

  update (time: number): void {
    if (!this.visible || this.disposed || this.pending || time < this.nextRequest) { return; }
    this.nextRequest = time + 100;
    void this.refresh().catch(console.error);
  }
  command (command: RuntimeCommand): void {
    if (command.type === 'pick') { this.snapshot.picking = command.value; }
    if (command.type === 'highlight') { this.snapshot.highlighting = command.value; }
    this.commands.push(command); this.nextRequest = 0;
  }
  select (id?: string): void { this.finishEdits(); this.previewId = id; this.command({ type: 'select', id }); }
  selectPlayer (id: string): void { this.finishEdits(); this.playerId = id; this.previewId = undefined; this.nextRequest = 0; }
  field (id: string): RuntimeField | undefined { return this.fields.get(id); }
  write (owner: object, id: string, value: RuntimeValue): void {
    const field = this.fields.get(id);

    if (!field?.writable) { return; }
    let transaction = this.edits.get(owner);

    if (!transaction) { transaction = 'edit-' + ++this.transactionId; this.edits.set(owner, transaction); }
    field.value = value;
    const last = this.commands.at(-1);

    if (last?.type === 'write' && last.id === id && last.transaction === transaction) { last.value = value; } else { this.command({ type: 'write', id, value, transaction }); }
    this.nextRequest = 0;
  }
  finish (owner: object): void {
    const transaction = this.edits.get(owner);

    if (transaction) { this.command({ type: 'finish', transaction }); this.edits.delete(owner); }
  }
  finishEdits (): void { for (const owner of this.edits.keys()) { this.finish(owner); } }
  refreshPreview (): void { this.previewId = this.snapshot.selectedId; this.nextRequest = 0; }
  reconnect (): void {
    this.generation++; this.commands = []; this.edits.clear(); this.playerId = undefined;
    this.snapshot = emptyRuntimeSnapshot(); this.fields.clear(); this.error = ''; this.nextRequest = 0; this.changed?.();
  }
  setVisible (visible: boolean): void {
    this.visible = visible;
    if (visible) { this.nextRequest = 0; } else {
      this.finishEdits();
      void this.suspend().catch(error => { this.error = String(error); });
    }
  }
  private async suspend (): Promise<void> {
    await this.pending;
    if (this.visible || this.disposed) { return; }
    if (this.commands.length) { await this.refresh(); }
    if (!this.visible && !this.disposed) {
      await this.bridge.suspend(); this.snapshot.picking = this.snapshot.highlighting = false;
    }
  }
  refresh (): Promise<void> {
    if (this.disposed) { return Promise.resolve(); }
    if (this.pending) { return this.pending; }
    this.pending = this.request().then(() => { this.pending = undefined; }, error => { this.pending = undefined; throw error; });

    return this.pending;
  }
  private async request (): Promise<void> {
    const generation = this.generation, commands = this.commands.splice(0), previewId = this.previewId;
    const playerId = commands.length ? this.snapshot.playerId ?? this.playerId : this.playerId;

    this.previewId = undefined;
    try {
      const snapshot = await this.bridge.request({ version: RUNTIME_PROTOCOL_VERSION, sessionId: this.snapshot.sessionId, playerId, commands, previewId });

      if (generation !== this.generation || this.disposed) {
        return;
      }
      const previous = this.snapshot;

      if (snapshot.playerId !== previous.playerId || snapshot.sessionId !== previous.sessionId) { this.commands = []; this.edits.clear(); }
      if (this.playerId === playerId || !this.playerId) { this.playerId = snapshot.playerId; }
      if (!snapshot.preview && snapshot.selectedId === previous.selectedId && snapshot.playerId === previous.playerId && snapshot.sessionId === previous.sessionId) { snapshot.preview = previous.preview; }
      this.snapshot = snapshot; this.error = snapshot.errors.join('\n'); this.fields.clear();
      const visit = (fields: RuntimeField[]): void => { fields.forEach(field => { this.fields.set(field.id, field); if (field.children) { visit(field.children); } }); };

      snapshot.sections.forEach(section => visit(section.fields));
      for (const command of this.commands) {
        if (command.type === 'write') {
          const field = this.fields.get(command.id);

          if (field) { field.value = command.value; }
        }
      }
      this.changed?.();
    } catch (error) {
      if (generation === this.generation && !this.disposed) { this.error = error instanceof Error ? error.message : String(error); this.changed?.(); }
    }
  }
  dispose (): void {
    this.disposed = true; this.generation++; this.commands = []; this.edits.clear(); this.fields.clear();
    void this.bridge.suspend().catch(console.error); this.bridge.dispose();
  }
}
