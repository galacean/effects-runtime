import type { Composition } from '@galacean/effects';
import { EffectsObject, VFXItem, spec } from '@galacean/effects';
import { EditorHistory, historyBytes } from '../../../framework/history/editor-history';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import type { ObjectState } from '../serialization/scene-serializer';
import { SceneSerializer } from '../serialization/scene-serializer';
import { jsonData, sameData } from '../serialization/scene-values';
import type { SceneEditorData, SequenceEditorData } from './scene-types';

interface Snapshot { scene: spec.JSONScene, editor: SceneEditorData }
interface Mutation { undo: () => void, redo: () => void, valid?: () => boolean, bytes?: number }
export interface EditorState<T = any> {
  read: () => T,
  restore: (state: T) => void,
  valid?: () => boolean,
  equal?: (a: T, b: T) => boolean,
}
type EditorStates = Map<EditorState, any>;
interface Transaction {
  label: string,
  editorLabel?: string,
  before?: Snapshot,
  version: number,
  states: EditorStates,
  mutations: Map<unknown, Mutation>,
}
interface SequenceEditor {
  component: EffectsObject,
  timeline: EffectsObject,
  exportData: () => any,
  exportEditorData: () => SequenceEditorData,
  snapshot: () => any,
  restore: (snapshot: any) => void,
  isValidSnapshot: (snapshot: any) => boolean,
}

export class SceneDocument {
  readonly serializer: SceneSerializer;
  scene: spec.JSONScene;
  editor: SceneEditorData;
  storageId?: string;
  name: string;
  restoring = false;
  readonly history = new EditorHistory();
  onRestored: () => void = () => {};
  beforeSelectionChange: () => void = () => {};
  autoKeyTarget: (item: VFXItem) => boolean = () => false;
  private version = 0;
  private nextVersion = 1;
  private savedVersion?: number;
  private transaction?: Transaction;
  private readonly editorStates = new Map<EditorState, any>();
  private readonly scopes = new Set<object>();
  private editorObservation?: EditorStates;
  private commitDeferred = false;
  private replay = 0;
  private disposed = false;
  private selectionSerial = 0;
  private readonly selectionKeys = new WeakMap<object, string>();
  private readonly selectionObjects = new Map<string, WeakRef<object>>();
  private sequenceStates = new Map<SequenceEditor, any>();
  private runtimeEdits = new Map<EffectsObject, { before: ObjectState, after: ObjectState }>();

  constructor (readonly composition: Composition, source: spec.JSONScene, editor: SceneEditorData = { objects: {} }) {
    this.scene = jsonData(source); this.editor = jsonData(editor); this.name = composition.name;
    for (const key of ['items', 'components', 'miscs', 'materials', 'geometries', 'shaders', 'textures', 'animations'] as const) { this.scene[key] ??= []; }
    this.serializer = new SceneSerializer(composition);
    this.serializer.bootstrap(this.scene);
    this.serializer.stabilizeRenderOrder(this.scene);
    this.serializer.restoreEditor(this.editor);
    this.serializer.stabilizeRenderOrder(this.scene);
    this.registerEditorState({
      read: () => EditorSelection.getSelectedObjects().map(object => this.selectionKey(object)),
      restore: (keys: string[]) => EditorSelection.setObjects(keys.map(key => this.selectionObject(key)).filter((object): object is object => !!object), 'history'),
    });
  }

  get dirty (): boolean { return this.savedVersion !== this.version || !!this.transaction?.before && !sameData(this.transaction.before, this.snapshot()); }
  get canUndo (): boolean { return this.history.canUndo || !!this.transaction && this.transactionChanged(); }
  get canRedo (): boolean { return !this.transactionChanged() && this.history.canRedo; }
  get undoLabel (): string { return this.transaction?.label ?? this.history.undoLabel; }
  get redoLabel (): string { return this.history.redoLabel; }
  get revision (): number { return this.version; }

  registerEditorState<T> (state: EditorState<T>): () => void {
    const initial = state.read();

    this.editorStates.set(state, initial);
    this.transaction?.states.set(state, initial);

    return () => { this.editorStates.delete(state); };
  }

  /** Observe UI selection changes without creating an entry for every rendered frame. */
  observeEditor (label: string, action: () => void): void {
    if (this.restoring || this.editorObservation) {
      action();

      return;
    }
    const before = this.readEditorStates();
    const replay = this.replay;

    this.editorObservation = before;
    try {
      action();
      if (this.replay === replay && this.statesChanged(before)) { this.begin(label, false); }
    } catch (error) {
      if (this.replay === replay) {
        if (this.transaction) { this.cancel(); } else { this.restore(undefined, [], false, before); }
      }
      throw error;
    } finally {
      this.editorObservation = undefined;
      if (this.commitDeferred) { this.commitDeferred = false; this.commit(); }
    }
  }

  changeSelection (apply: () => void): void {
    if (this.restoring) {
      apply();

      return;
    }
    // A pending text/property edit belongs to the old selection.
    if (!this.editorObservation) {
      this.beforeSelectionChange(); this.commit(true);
    }
    if (this.editorObservation) {
      apply();

      return;
    }
    this.begin('Select objects', false);
    try { apply(); } catch (error) { this.cancel(); throw error; }
  }

  setScopeActive (owner: object, active: boolean): void {
    if (active && this.transaction) { this.scopes.add(owner); } else {
      this.scopes.delete(owner);
      if (!this.scopes.size) { this.commit(); }
    }
  }

  dispose (): void {
    this.disposed = true; this.transaction = undefined; this.scopes.clear();
    this.history.clear('The document was closed.');
    this.editorStates.clear(); this.sequenceStates.clear(); this.runtimeEdits.clear(); this.selectionObjects.clear();
  }

  snapshot (): Snapshot { return { scene: jsonData(this.scene), editor: jsonData(this.editor) }; }

  markSaved (revision?: number): void {
    if (revision === undefined) { this.commit(true); }
    this.savedVersion = revision ?? this.version;
  }

  markUnsaved (): void { this.savedVersion = undefined; }

  begin (label: string, affectsContent = true): void {
    if (!this.restoring && !this.transaction) {
      this.transaction = { label, before: affectsContent ? this.snapshot() : undefined, version: this.version,
        states: this.editorObservation ?? this.readEditorStates(), mutations: new Map() };
    } else if (!this.restoring && affectsContent && this.transaction && !this.transaction.before) {
      // A click followed by a drag is one operation, including its initial selection.
      this.transaction.editorLabel ??= this.transaction.label;
      this.transaction.before = this.snapshot(); this.transaction.label = label;
    } else if (!this.restoring && !affectsContent && this.transaction) {
      this.transaction.editorLabel = label;
    }
  }

  observe (label: string, action: () => void, targets?: unknown[]): boolean {
    if (this.restoring) {
      action();

      return false;
    }
    const before = this.serializer.capture(targets);
    const states = this.readEditorStates();
    const transaction = this.transaction;

    let changed = false;

    try { action(); } catch (error) {
      for (const state of before.values()) { this.serializer.apply(state); }
      this.cancel();
      throw error;
    }
    for (const [object, state] of this.serializer.capture(targets)) {
      const old = before.get(object);

      if (!old) { continue; }
      if (object instanceof VFXItem && this.autoKeyTarget(object)) {
        for (const key of ['position', 'eulerHint', 'scale']) { state.data.transform[key] = old.data.transform[key]; }
      }
      changed = this.recordObject(label, old, state) || changed;
    }
    if (this.transaction && this.transaction !== transaction) { this.transaction.states = states; }

    return changed;
  }

  recordObject (label: string, before: ObjectState, after: ObjectState): boolean {
    if (this.restoring || sameData(before.data, after.data) && sameData(before.extras, after.extras)) { return false; }
    this.begin(label);
    this.serializer.patch(this.scene, this.editor, before, after);
    let edit = this.runtimeEdits.get(after.object);

    if (edit) { edit.after = after; } else {
      edit = { before, after }; this.runtimeEdits.set(after.object, edit);
      this.transaction!.mutations.set(after.object, {
        undo: () => this.serializer.applyResolved(edit!.before, edit!.after),
        redo: () => this.serializer.applyResolved(edit!.after, edit!.before),
        valid: () => !!this.serializer.object(after.data.id),
      });
    }
    this.transaction!.mutations.get(after.object)!.bytes = historyBytes([edit.before.data, edit.before.extras, edit.after.data, edit.after.extras]);

    return true;
  }

  recordMutation (key: object, mutation: Mutation): void {
    if (!this.restoring && this.transaction) { this.transaction.mutations.set(key, mutation); }
  }

  beginSequence (document: SequenceEditor, label: string, before: any, affectsContent = true): void {
    if (this.restoring) { return; }
    this.begin(label, affectsContent); this.scopes.add(document);
    if (!this.sequenceStates.has(document)) {
      this.sequenceStates.set(document, before);
    }
    if (affectsContent && !this.transaction!.mutations.has(document)) {
      const original = this.sequenceStates.get(document);

      this.transaction!.mutations.set(document, {
        undo: () => document.restore(original), redo: () => document.restore(original),
        valid: () => document.isValidSnapshot(original), bytes: historyBytes(original),
      });
    }
  }

  changedSequence (document: SequenceEditor, affectsContent = true): void {
    if (this.restoring) { return; }
    if (affectsContent) { this.writeSequence(document); }
    const before = this.sequenceStates.get(document);

    if (before && this.transaction) {
      const after = document.snapshot();

      this.transaction.mutations.set(document, { undo: () => document.restore(before), redo: () => document.restore(after),
        valid: () => document.isValidSnapshot(before) && document.isValidSnapshot(after), bytes: historyBytes([before, after]) });
    }
  }

  private writeSequence (document: SequenceEditor): void {
    const data = this.serializer.normalize(document.exportData());
    const componentId = this.serializer.id(document.component);
    const component = this.scene.components.find(entry => entry.id === componentId) as any;

    if (!component) { throw new Error('The edited timeline has no owning scene component.'); }
    const oldIds = new Set<string>();
    const collect = (id: string): void => {
      if (oldIds.has(id)) { return; }
      oldIds.add(id);
      const asset = this.scene.miscs.find(entry => entry.id === id) as any;

      for (const ref of [...asset?.tracks ?? [], ...asset?.children ?? [], ...asset?.clips ?? []]) { collect(ref.id); }
    };

    if (component.timelineAsset) { collect(component.timelineAsset.id); }
    const newIds = new Set(data.miscs.map((entry: any) => entry.id));

    this.scene.miscs = this.scene.miscs.filter(entry => !oldIds.has(entry.id) || newIds.has(entry.id));
    for (const asset of data.miscs) { this.serializer.put(this.scene, asset); }
    component.timelineAsset = data.timelineAsset; component.sceneBindings = data.sceneBindings;
    this.editor.sequences ??= {};
    const authored = document.exportEditorData();

    this.editor.sequences[authored.timelineId] = jsonData(authored);
  }

  commit (force = false): void {
    const transaction = this.transaction;

    if (this.editorObservation && !force) {
      this.commitDeferred = true;

      return;
    }
    if (!transaction || this.restoring || !force && this.scopes.size) { return; }
    const after = transaction.before ? this.snapshot() : undefined;
    const states = this.readEditorStates();
    const contentChanged = !!transaction.before && !sameData(transaction.before, after);
    const editorChanged = this.statesChanged(transaction.states, states);

    this.transaction = undefined; this.scopes.clear(); this.runtimeEdits.clear(); this.sequenceStates.clear();
    if (!contentChanged && !editorChanged) { return; }
    if (contentChanged) { this.version = this.nextVersion++; }
    const version = this.version;
    const mutations = contentChanged ? Array.from(transaction.mutations.values()) : [];
    const beforeSnapshot = contentChanged ? transaction.before : undefined;
    const afterSnapshot = contentChanged ? after : undefined;
    const beforeStates = transaction.states;
    const beforeVersion = transaction.version;

    this.history.push({ label: contentChanged ? transaction.label : transaction.editorLabel ?? transaction.label,
      bytes: historyBytes([beforeSnapshot, afterSnapshot, Array.from(beforeStates.values()), Array.from(states.values())]) + mutations.reduce((total, mutation) => total + (mutation.bytes ?? 0), 0),
      valid: () => !this.disposed && !this.composition.isDestroyed && mutations.every(mutation => !mutation.valid || mutation.valid()),
      undo: () => { this.restore(beforeSnapshot, mutations, false, beforeStates); this.version = beforeVersion; },
      redo: () => { this.restore(afterSnapshot, mutations, true, states); this.version = version; },
    });
  }

  undo (): void {
    this.commit(true); this.history.undo();
  }

  redo (): void {
    this.commit(true); this.history.redo();
  }

  cancel (): void {
    const transaction = this.transaction;

    if (!transaction || this.restoring) { return; }
    this.transaction = undefined; this.scopes.clear(); this.runtimeEdits.clear(); this.sequenceStates.clear();
    this.restore(transaction.before, Array.from(transaction.mutations.values()), false, transaction.states);
    this.version = transaction.version;
  }

  cancelSequence (document: SequenceEditor): void {
    if (this.sequenceStates.has(document)) { this.cancel(); }
  }

  validate (): void {
    const ids = new Set<string>();
    const data = this.scene;

    for (const entry of [...data.compositions, ...data.items, ...data.components, ...data.miscs,
      ...data.materials ?? [], ...data.geometries ?? [], ...data.shaders ?? [], ...data.animations ?? [], ...data.textures ?? []]) {
      if (!entry.id || ids.has(entry.id)) { throw new Error('The scene contains a missing or duplicate object ID: ' + entry.id); }
      ids.add(entry.id);
    }
    for (const entry of [...data.compositions, ...data.items, ...data.components, ...data.miscs] as any[]) {
      for (const key of ['children', 'components', 'items', 'tracks', 'clips']) {
        for (const reference of entry[key] ?? []) {
          if (reference && typeof reference.id === 'string' && !ids.has(reference.id)) { throw new Error('Missing scene reference ' + reference.id + ' in ' + key + ' of ' + entry.id); }
        }
      }
    }
    for (const component of data.components as any[]) {
      if (component.dataType !== spec.DataType.CompositionComponent) { continue; }
      for (const binding of component.sceneBindings ?? []) {
        if (!ids.has(binding.key.id) || !ids.has(binding.value.id)) { throw new Error('A timeline binding refers to an object outside this scene.'); }
      }
    }
  }

  private readEditorStates (): EditorStates { return new Map(Array.from(this.editorStates.keys(), state => [state, state.read()])); }

  private statesChanged (before: EditorStates, after = this.readEditorStates()): boolean {
    return Array.from(before).some(([state, value]) => after.has(state) && !(state.equal ?? sameData)(value, after.get(state)));
  }

  private transactionChanged (): boolean {
    return !!this.transaction && (!!this.transaction.before && !sameData(this.transaction.before, this.snapshot()) || this.statesChanged(this.transaction.states));
  }

  private selectionKey (object: object): string {
    let key = this.selectionKeys.get(object);

    if (!key) {
      key = object === this.composition ? 'composition' : object instanceof EffectsObject ? 'object:' + this.serializer.id(object) : 'editor:' + ++this.selectionSerial;
      this.selectionKeys.set(object, key); this.selectionObjects.set(key, new WeakRef(object));
    }

    return key;
  }

  private selectionObject (key: string): object | undefined {
    if (key === 'composition') { return this.composition.isDestroyed ? undefined : this.composition; }
    if (key.startsWith('object:')) { return this.serializer.object(key.slice(7)); }

    return this.selectionObjects.get(key)?.deref();
  }

  private restore (snapshot: Snapshot | undefined, mutations: Mutation[], redo: boolean, states: EditorStates): void {
    this.restoring = true; this.replay++;
    const current = snapshot ? this.snapshot() : undefined;
    const previousStates = this.readEditorStates();
    const applied: Mutation[] = [];

    try {
      EditorSelection.batch(() => {
        if (snapshot) { this.scene = jsonData(snapshot.scene); this.editor = jsonData(snapshot.editor); }
        for (const mutation of redo ? mutations : [...mutations].reverse()) {
          applied.push(mutation);
          if (redo) { mutation.redo(); } else { mutation.undo(); }
        }
        this.serializer.restoreEditor(this.editor);
        for (const [state, initial] of this.editorStates) {
          if (!state.valid || state.valid()) { state.restore(states.has(state) ? states.get(state) : initial); }
        }
      }, 'history');
      this.serializer.stabilizeRenderOrder(this.scene);
      this.onRestored();
    } catch (error) {
      EditorSelection.batch(() => {
        for (const mutation of applied.reverse()) {
          try { if (redo) { mutation.undo(); } else { mutation.redo(); } } catch (restoreError) { console.error('Failed to restore an edited object.', restoreError); }
        }
        if (current) { this.scene = current.scene; this.editor = current.editor; }
        for (const [state, value] of previousStates) { if (!state.valid || state.valid()) { state.restore(value); } }
      }, 'history');
      throw error;
    } finally { this.restoring = false; }
  }
}
