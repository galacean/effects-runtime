import type { Component, Composition, Player, Region, RendererComponent, Texture, Transform, VFXItem } from '@galacean/effects';
import { reflectProperties } from '../../ui/property-editor/property-handle';
import { emptyRuntimeSnapshot, RUNTIME_DISCONNECT, RUNTIME_PROTOCOL_VERSION } from './protocol';
import type { RuntimeAsset, RuntimeCommand, RuntimeField, RuntimeNode, RuntimePreview, RuntimeRequest, RuntimeSection, RuntimeSnapshot, RuntimeValue } from './protocol';

interface Binding { owner: object, read(): RuntimeValue, write(value: RuntimeValue): void }
interface Edit { binding: Binding, before: RuntimeValue, after: RuntimeValue }
interface Transaction { id: string, edits: Map<string, Edit> }
interface RuntimeObject { object: object, item?: VFXItem, composition?: Composition }

const HIDDEN = new Set(['engine', 'item', 'guid', 'definition', 'props', 'parent', 'children', 'components', 'transform', 'composition',
  'eventEmitter', 'eventProcessor', 'isRegistered', 'isAwakeCalled', 'isStartCalled', 'isEnableCalled', 'isDuringPlay', 'isEndCalled',
  'renderer', 'canvas', 'context', 'boundingBoxInfo', 'frameClipMasks', 'maskManager', 'gpuTexture', 'disposed', 'destroyed', 'offloaded']);
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function objectName (object: object): string {
  const value = object as { name?: unknown, definition?: { dataType?: unknown } };

  return typeof value.name === 'string' && value.name ? value.name : typeName(object);
}
function typeName (object: object): string {
  const definition = (object as { definition?: { dataType?: string } }).definition;

  return definition?.dataType || object.constructor.name || 'Object';
}
function cloneValue (value: RuntimeValue): RuntimeValue { return Array.isArray(value) ? value.map(cloneValue) : value; }
function sameValue (a: RuntimeValue, b: RuntimeValue): boolean { return JSON.stringify(a) === JSON.stringify(b); }

/** This agent only uses the inspected page's runtime instances and public methods. */
export class RuntimeAgent {
  readonly version = RUNTIME_PROTOCOL_VERSION;
  private readonly sessionId = crypto.getRandomValues(new Uint32Array(4)).join('-');
  private nextId = 0;
  private readonly ids = new WeakMap<object, string>();
  private readonly objects = new Map<string, RuntimeObject>();
  private readonly bindings = new Map<string, Binding>();
  private player?: Player;
  private selectedId?: string;
  private transaction?: Transaction;
  private history: Edit[][] = [];
  private historyIndex = 0;
  private overlay?: HTMLDivElement;
  private highlight?: HTMLDivElement;
  private picking = false;
  private highlighting = false;
  private pickedId?: string;
  private readonly mutations = new Set<Player>();
  private readonly errors: string[] = [];

  constructor () { window.addEventListener('message', this.disconnect); }

  request (request: RuntimeRequest): RuntimeSnapshot {
    if (request.version !== this.version) { throw new Error('The runtime debugging protocol does not match this extension.'); }
    const globalRuntime = window.ge as { getActivePlayers?: () => readonly Player[] } | undefined;
    const getPlayers = typeof globalRuntime?.getActivePlayers === 'function' ? globalRuntime.getActivePlayers : undefined;

    const players = [...new Set(getPlayers?.() ?? [])].filter(player => !player.engine.disposed);
    const next = players.find(player => this.id(player) === request.playerId) ?? players[0];

    if (next !== this.player) {
      this.suspend(); this.player = next; this.selectedId = undefined; this.pickedId = undefined;
      this.transaction = undefined; this.history = []; this.historyIndex = 0; this.bindings.clear();
    }
    const snapshot = emptyRuntimeSnapshot();

    snapshot.sessionId = this.sessionId;
    snapshot.registered = !!getPlayers;
    snapshot.players = players.map(player => ({ id: this.id(player), name: player.name || 'Player', canvas: player.canvas.id ? '#' + player.canvas.id : 'canvas', width: player.canvas.width, height: player.canvas.height }));
    if (!next) {
      this.objects.clear(); this.bindings.clear();

      return snapshot;
    }
    snapshot.playerId = this.id(next);
    this.index(next, snapshot.nodes, snapshot.assets);
    const commands = !request.sessionId || request.sessionId === this.sessionId ? request.commands : [];

    if (commands.some(command => command.type === 'write')) {
      const selected = this.selectedId && this.objects.get(this.selectedId);

      this.bindings.clear();
      if (selected) { this.describe(selected); }
    }
    for (const command of commands) {
      try { this.command(command, next); } catch (error) { snapshot.errors.push(error instanceof Error ? error.message : String(error)); }
    }
    for (const player of this.mutations) { if (!player.ticker || player.ticker.getPaused()) { player.tick(0); } }
    this.mutations.clear();
    if (commands.length) { snapshot.nodes.length = snapshot.assets.length = 0; this.index(next, snapshot.nodes, snapshot.assets); }
    snapshot.errors.push(...this.errors.splice(0));
    if (this.pickedId) { this.selectedId = this.pickedId; this.pickedId = undefined; }
    const selected = this.selectedId && this.objects.get(this.selectedId);

    if (!selected) { this.selectedId = undefined; }
    this.bindings.clear();
    snapshot.selectedId = this.selectedId;
    snapshot.selectedName = selected ? objectName(selected.object) : undefined;
    snapshot.sections = selected ? this.describe(selected) : [];
    snapshot.paused = next.getCompositions().every(composition => composition.getPaused());
    const composition = next.getCompositions()[0];

    snapshot.time = composition ? composition.time - composition.startTime : 0;
    snapshot.duration = Math.max(0, ...next.getCompositions().map(composition => composition.getDuration()));
    snapshot.speed = next.getSpeed(); snapshot.canUndo = this.historyIndex > 0; snapshot.canRedo = this.historyIndex < this.history.length;
    snapshot.picking = this.picking; snapshot.highlighting = this.highlighting;
    if (request.previewId && request.previewId === this.selectedId) {
      try { snapshot.preview = this.preview(request.previewId); } catch (error) { snapshot.errors.push('Preview: ' + (error instanceof Error ? error.message : String(error))); }
    }
    this.updateOverlay();

    return snapshot;
  }

  suspend (): void {
    this.picking = false; this.highlighting = false;
    this.overlay?.remove(); this.overlay = undefined; this.highlight = undefined;
    window.removeEventListener('keydown', this.cancelPick, true);
  }

  dispose (): void { this.release(); window.removeEventListener('message', this.disconnect); }

  private release (): void {
    this.suspend(); this.player = undefined; this.selectedId = this.pickedId = undefined; this.transaction = undefined;
    this.objects.clear(); this.bindings.clear(); this.history = []; this.historyIndex = 0; this.mutations.clear(); this.errors.length = 0;
  }

  private id (object: object): string {
    let id = this.ids.get(object);

    if (!id) { id = 'object-' + ++this.nextId; this.ids.set(object, id); }

    return id;
  }

  private index (player: Player, nodes: RuntimeNode[], assets: RuntimeAsset[]): void {
    this.objects.clear();
    const addItem = (item: VFXItem, composition: Composition, parent: string): void => {
      const id = this.id(item);

      if (this.objects.has(id)) { return; }
      this.objects.set(id, { object: item, item, composition });
      nodes.push({ id, name: item.name, type: typeName(item), itemType: String(item.type), parent, composition: this.id(composition), active: item.isActive, visible: item.isVisible });
      item.components.forEach(component => this.objects.set(this.id(component), { object: component, item, composition }));
      item.children.forEach(child => addItem(child, composition, id));
    };

    for (const composition of player.getCompositions()) {
      const id = this.id(composition);

      this.objects.set(id, { object: composition, item: composition.sceneRoot, composition });
      nodes.push({ id, name: composition.name, type: 'Scene', composition: id, active: true, visible: composition.sceneRoot.isVisible });
      addItem(composition.sceneRoot, composition, id);
    }
    for (const object of Object.values(player.engine.effectsObjectServer.objectInstance)) {
      if (this.objects.has(this.id(object)) || 'item' in object || 'children' in object) { continue; }
      this.objects.set(this.id(object), { object });
      const texture = object as Texture;
      const summary = typeof texture.width === 'number' && typeof texture.height === 'number' ? texture.width + ' × ' + texture.height : typeName(object);

      assets.push({ id: this.id(object), name: objectName(object), type: typeName(object), summary });
    }
  }

  private describe (entry: RuntimeObject): RuntimeSection[] {
    const sections: RuntimeSection[] = [];
    const object = entry.object;
    const first: RuntimeSection = { id: this.id(object), name: entry.item === object ? 'Item' : typeName(object), fields: [] };

    if (entry.composition === object) {
      const composition = entry.composition;

      first.fields.push(this.field(object, 'name', 'Name', 'string', () => composition.name));
      first.fields.push(this.field(object, 'duration', 'Duration', 'number', () => composition.getDuration()));
      first.fields.push(this.field(object, 'time', 'Time', 'number', () => composition.time));
    } else if (entry.item === object) {
      const item = entry.item;

      for (const key of ['name', 'duration', 'endBehavior'] as const) {
        first.fields.push(this.field(item, key, key, key === 'name' ? 'string' : 'number', () => item[key], value => { Reflect.set(item, key, value); }));
      }
      first.fields.push(this.field(item, 'isActive', 'Active', 'boolean', () => item.isActive, value => item.setActive(value as boolean)));
      first.fields.push(this.field(item, 'isVisible', 'Visible', 'boolean', () => item.isVisible, value => item.setVisible(value as boolean)));
      first.fields.push(this.field(item, 'time', 'Time', 'number', () => item.time));
    } else { first.fields = this.properties(object, object, [], new Set(), 0); }
    sections.push(first);
    const item = entry.item;

    if (item && (item === object || entry.composition === object)) {
      sections.push({ id: this.id(item) + '/transform', name: 'Transform', fields: this.transform(item.transform) });
      for (const component of item.components) { sections.push(this.component(component)); }
    }

    return sections;
  }

  private component (component: Component): RuntimeSection {
    const enabled = this.field(component, 'enabled', 'Enabled', 'boolean', () => component.enabled, value => { component.enabled = value as boolean; });

    return { id: this.id(component), name: typeName(component), fields: [enabled, ...this.properties(component, component, [], new Set(), 0).filter(field => field.name !== 'enabled')] };
  }

  private transform (transform: Transform): RuntimeField[] {
    return ([['position', 'Location', 'setPosition'], ['rotation', 'Rotation', 'setRotation'], ['scale', 'Scale', 'setScale'], ['size', 'Size', 'setSize'], ['anchor', 'Anchor', 'setAnchor']] as const).map(([key, name, setter]) =>
      this.field(transform, key, name, 'vector', () => key === 'size' || key === 'anchor' ? [transform[key].x, transform[key].y] : [transform[key].x, transform[key].y, transform[key].z], value => {
        const numbers = value as number[];

        if (key === 'size' || key === 'anchor') { (transform[setter] as (x: number, y: number) => void).call(transform, numbers[0], numbers[1]); } else { (transform[setter] as (x: number, y: number, z: number) => void).call(transform, numbers[0], numbers[1], numbers[2]); }
      }));
  }

  private properties (root: object, object: object, path: string[], ancestors: Set<object>, depth: number): RuntimeField[] {
    if (ancestors.has(object) || depth > 4) { return []; }
    const visited = new Set(ancestors).add(object);

    return reflectProperties(object, true).flatMap(property => {
      const key = String(property.key), value = property.value;

      if (typeof property.key !== 'string' || key.startsWith('_') || HIDDEN.has(key) || BLOCKED_KEYS.has(key)) { return []; }
      const keys = [...path, key], id = JSON.stringify(keys);
      const read = () => Reflect.get(object, key) as RuntimeValue;
      const write = property.writable ? (next: RuntimeValue) => { if (!Reflect.set(object, key, next)) { throw new Error('The property is read-only.'); } } : undefined;

      if (property.error) { return [this.field(root, id, key, 'readonly', () => property.error!)]; }
      if (value === undefined) { return []; }
      if (typeof value === 'number') { return [this.field(root, id, key, 'number', read, Number.isFinite(value) ? write : undefined)]; }
      if (typeof value === 'boolean' || typeof value === 'string') { return [this.field(root, id, key, typeof value === 'boolean' ? 'boolean' : 'string', read, write)]; }
      if (value === null) { return [this.field(root, id, key, 'readonly', () => 'None')]; }
      if (typeof value !== 'object') { return []; }
      const reference = this.objects.has(this.id(value)) ? this.id(value) : undefined;

      if (reference) { return [{ ...this.field(root, id, key, 'reference', () => objectName(value)), reference }]; }
      const vector = value as Record<string, unknown>;
      const axes = ['r', 'g', 'b', 'a'].every(axis => typeof vector[axis] === 'number') ? ['r', 'g', 'b', 'a'] :
        ['x', 'y'].every(axis => typeof vector[axis] === 'number') ? ['x', 'y', ...('z' in vector ? ['z'] : []), ...('w' in vector ? ['w'] : [])] : undefined;

      if (axes) {
        if (axes.some(axis => !Number.isFinite(vector[axis]))) { return [this.field(root, id, key, 'readonly', () => axes.map(axis => String(vector[axis])).join(', '))]; }
        const read = () => axes.map(axis => Reflect.get(object, key)[axis] as number);
        const write = (next: RuntimeValue) => {
          const current = Reflect.get(object, key);
          const result = property.writable && typeof current.clone === 'function' ? current.clone() : current;

          axes.forEach((axis, i) => Reflect.set(result, axis, (next as number[])[i]));
          if (property.writable && !Reflect.set(object, key, result)) { throw new Error('The property is read-only.'); }
        };

        return [this.field(root, id, key, axes[0] === 'r' ? 'color' : 'vector', read, property.writable ? write : undefined)];
      }
      if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) { return [this.field(root, id, key, 'readonly', () => value.constructor.name + ' (' + value.byteLength + ' bytes)')]; }
      if (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype) {
        return [{ id: this.id(root) + '/' + id, name: key, kind: 'group', value: null, writable: false, children: this.properties(root, value, keys, visited, depth + 1) }];
      }

      return [this.field(root, id, key, 'readonly', () => typeName(value))];
    });
  }

  private field (owner: object, key: string, name: string, kind: RuntimeField['kind'], read: () => RuntimeValue, write?: (value: RuntimeValue) => void): RuntimeField {
    const id = this.id(owner) + '/' + key, value = read();

    if (write) { this.bindings.set(id, { owner, read, write }); }

    return { id, name, kind, value: typeof value === 'number' && !Number.isFinite(value) ? String(value) : value, writable: !!write };
  }

  private command (command: RuntimeCommand, player: Player): void {
    if (command.type === 'select') {
      this.finish(); this.selectedId = command.id;

      return;
    }
    if (command.type === 'finish') {
      if (this.transaction?.id === command.transaction) { this.finish(); }

      return;
    }
    if (command.type === 'write') {
      const binding = this.bindings.get(command.id);

      if (!binding || !this.alive(binding.owner)) { throw new Error('The edited object or property is no longer available.'); }
      const before = binding.read(), value = command.value;

      if (!this.validValue(before, value)) { throw new Error('The property value has an incompatible type.'); }
      if (this.transaction?.id !== command.transaction) { this.finish(); this.transaction = { id: command.transaction, edits: new Map() }; }
      const edit = this.transaction.edits.get(command.id) ?? { binding, before: cloneValue(before), after: cloneValue(value) };

      binding.write(value); edit.after = cloneValue(binding.read()); this.transaction.edits.set(command.id, edit); this.mutations.add(player);
    } else if (command.type === 'visible') {
      const item = this.objects.get(command.id)?.item;

      if (!item) { throw new Error('The scene item is no longer available.'); }
      this.finish();
      const before = item.isVisible;

      item.setVisible(command.value); this.record([{ binding: { owner: item, read: () => item.isVisible, write: value => item.setVisible(value as boolean) }, before, after: command.value }]); this.mutations.add(player);
    } else if (command.type === 'undo' || command.type === 'redo') {
      this.finish();
      const index = command.type === 'undo' ? this.historyIndex - 1 : this.historyIndex;
      const edits = this.history[index];

      if (edits) { for (const edit of edits) { if (this.alive(edit.binding.owner)) { edit.binding.write(cloneValue(command.type === 'undo' ? edit.before : edit.after)); } } this.historyIndex += command.type === 'undo' ? -1 : 1; this.mutations.add(player); }
    } else if (command.type === 'pause') { player.pause(); } else if (command.type === 'resume') {
      void player.resume().catch(error => this.errors.push(error instanceof Error ? error.message : String(error)));
    } else if (command.type === 'restart') { player.gotoAndStop(0); } else if (command.type === 'seek') {
      if (!Number.isFinite(command.time)) { throw new Error('Time must be finite.'); } player.gotoAndStop(Math.max(0, command.time));
    } else if (command.type === 'speed') {
      if (!Number.isFinite(command.value) || command.value <= 0) { throw new Error('Speed must be positive.'); } player.setSpeed(command.value);
    } else if (command.type === 'pick') { this.picking = command.value; } else if (command.type === 'highlight') { this.highlighting = command.value; } else if (command.type === 'log') {
      const selected = this.selectedId && this.objects.get(this.selectedId);

      if (selected) { console.info(selected.object); }
    }
  }

  private alive (object: object): boolean {
    for (const entry of this.objects.values()) { if (entry.object === object || entry.item?.transform === object) { return true; } }

    return false;
  }
  private validValue (before: RuntimeValue, next: RuntimeValue): boolean {
    if (Array.isArray(before)) { return Array.isArray(next) && before.length === next.length && before.every((value, i) => this.validValue(value, next[i])); }

    return typeof before === typeof next && (typeof next !== 'number' || Number.isFinite(next));
  }
  private finish (): void {
    if (!this.transaction) { return; }
    const edits = [...this.transaction.edits.values()].filter(edit => !sameValue(edit.before, edit.after));

    this.transaction = undefined;
    if (edits.length) { this.record(edits); }
  }
  private record (edits: Edit[]): void { this.history.splice(this.historyIndex); this.history.push(edits); this.historyIndex = this.history.length; }

  private updateOverlay (): void {
    const player = this.player;

    if (!player || !this.picking && !this.highlighting) {
      this.suspend();

      return;
    }
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      Object.assign(this.overlay.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483647', overflow: 'hidden' });
      this.highlight = document.createElement('div');
      Object.assign(this.highlight.style, { position: 'absolute', pointerEvents: 'none', border: '1px solid #26bbff', background: 'rgba(38,187,255,.12)', boxSizing: 'border-box' });
      this.overlay.appendChild(this.highlight); document.documentElement.appendChild(this.overlay);
      this.overlay.addEventListener('click', this.pick);
      window.addEventListener('keydown', this.cancelPick, true);
    }
    const bounds = player.canvas.getBoundingClientRect();

    Object.assign(this.overlay.style, { left: bounds.left + 'px', top: bounds.top + 'px', width: bounds.width + 'px', height: bounds.height + 'px', pointerEvents: this.picking ? 'auto' : 'none', cursor: this.picking ? 'crosshair' : '' });
    const entry = this.selectedId && this.objects.get(this.selectedId);
    const points = entry && entry.item && entry.composition && this.highlighting ? entry.item.components.flatMap(component => {
      if (!('getBoundingBoxInfo' in component)) { return []; }
      const box = (component as RendererComponent).getBoundingBoxInfo().boundingBox;

      return box.vectorsWorld.map(point => entry.composition!.camera.worldToScreenPoint(point));
    }) : [];

    this.highlight!.style.display = points.length ? 'block' : 'none';
    if (points.length) {
      const left = Math.min(...points.map(point => point.x)), right = Math.max(...points.map(point => point.x));
      const bottom = Math.min(...points.map(point => point.y)), top = Math.max(...points.map(point => point.y));

      Object.assign(this.highlight!.style, { left: left + 'px', top: bounds.height - top + 'px', width: right - left + 'px', height: top - bottom + 'px' });
    }
  }
  private readonly cancelPick = (event: KeyboardEvent): void => {
    if (this.picking && event.key === 'Escape') { this.picking = false; this.updateOverlay(); event.preventDefault(); event.stopImmediatePropagation(); }
  };
  private readonly disconnect = (event: MessageEvent): void => {
    if (event.source === window && event.data?.type === RUNTIME_DISCONNECT) { this.release(); }
  };
  private readonly pick = (event: MouseEvent): void => {
    if (!this.player || !this.picking) { return; }
    const bounds = this.player.canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 2 - 1, y = 1 - (event.clientY - bounds.top) / bounds.height * 2;
    const hits = this.player.getCompositions().flatMap(composition => {
      const regions: Region[] = [];

      composition.sceneRoot.hitTest(composition.getHitTestRay(x, y), x, y, regions, [], true, { skip: item => !item.isVisible });

      return regions;
    });
    const item = hits.at(-1)?.item;

    if (item) { this.pickedId = this.id(item); }
    this.picking = false; this.updateOverlay(); event.preventDefault(); event.stopPropagation();
  };

  private preview (id: string): RuntimePreview | undefined {
    const object = this.objects.get(id)?.object as Texture | undefined;

    if (!object || !('source' in object)) { return; }
    const source = object.source;
    const image = 'image' in source ? source.image : 'video' in source ? source.video : undefined;
    const data = 'data' in source ? source.data : undefined;
    const width = object.width || data?.width || (image && ('videoWidth' in image ? image.videoWidth : 'naturalWidth' in image ? image.naturalWidth : image.width));
    const height = object.height || data?.height || (image && ('videoHeight' in image ? image.videoHeight : 'naturalHeight' in image ? image.naturalHeight : image.height));

    if (!width || !height) { return; }
    const canvas = document.createElement('canvas'), scale = Math.min(1, 512 / Math.max(width, height));

    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');

    if (!context) { return; }
    if (image) { context.drawImage(image, 0, 0, canvas.width, canvas.height); } else {
      const bytes = data && 'data' in data ? data.data : undefined;

      if (!(bytes instanceof Uint8Array || bytes instanceof Uint8ClampedArray) || bytes.byteLength !== width * height * 4) { return; }
      const original = document.createElement('canvas');

      original.width = width; original.height = height;
      const pixels = original.getContext('2d');

      if (!pixels) { return; }
      pixels.putImageData(new ImageData(new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength), width, height), 0, 0);
      context.drawImage(original, 0, 0, canvas.width, canvas.height);
    }

    return { id, url: canvas.toDataURL(), width, height };
  }
}

declare global { interface Window { __EFFECTS_DEVTOOLS_AGENT__?: RuntimeAgent } }
if (typeof window !== 'undefined' && window.__EFFECTS_DEVTOOLS_AGENT__?.version !== RUNTIME_PROTOCOL_VERSION) {
  window.__EFFECTS_DEVTOOLS_AGENT__?.dispose(); window.__EFFECTS_DEVTOOLS_AGENT__ = new RuntimeAgent();
}
