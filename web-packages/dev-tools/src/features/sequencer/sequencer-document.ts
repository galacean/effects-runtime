import type { Composition, EffectsObject, TimelineAsset, TimelineClip, TrackAsset } from '@galacean/effects';
import {
  ActivationPlayableAsset, ActivationTrack, Component, CompositionComponent,
  FloatPropertyPlayableAsset,
  InterpolationMode,
  MaterialTrack,
  ObjectBindingTrack, ObjectReferencePropertyPlayableAsset,
  REFERENCE_CURVE,
  SpriteColorPlayableAsset, SpriteColorTrack, SubCompositionTrack, SubCompositionPlayableAsset, TransformPlayableAsset, TransformTrack,
  VFXItem,
  effectsClassStore, spec,
} from '@galacean/effects';
import { EditorHistory, historyBytes } from '../../framework/history/editor-history';
import type { SequenceChannelEditorData, SequenceEditorData } from '../scene/document/scene-types';
import { getEditorRotation } from '../scene/operations/editor-transform';
import { sceneWorkspace } from '../scene/scene-workspace';
import type { SequenceKey } from './curve-data';
import { curveSourceSignature, decodeCurve, encodeCurve, insertBoundary, makeKey, sampleCurve, trimKeys, updateAutoTangents } from './curve-data';
import type { PositionAnimationData, PositionPathSnapshot, SpatialKey } from './spatial-position';
import { encodePositionAxes, PositionPathModel } from './spatial-position';
import { findSequenceTimeline, sampleSequencePreview } from './sequencer-preview';
import type { SequenceProperty } from './sequencer-properties';
import { createPropertyClip, createPropertyTrack, initialPropertyCurve, initializeProperty, propertyClipKind, propertyTrackKind, propertyValue, resolvePropertyTarget, sequenceProperties, vectorValues } from './sequencer-properties';

type Payload = Record<string, unknown>;
type TransformData = Omit<TransformPlayableAsset['transformAnimationData'], 'positionOverLifetime'> & {
  positionOverLifetime?: PositionAnimationData,
};

export interface SequenceChannel {
  id: string,
  group: string,
  label: string,
  keys: SequenceKey[],
  defaultValue: number,
  axis: number,
  kind: 'number' | 'reference',
  references?: Map<string, EffectsObject | null>,
  pathView?: 'point' | 'timing',
  minimum?: number,
  maximum?: number,
  integer?: boolean,
  referenceType?: string,
}
export interface SequenceSection {
  clip: TimelineClip,
  track: TrackAsset,
  payload: Payload,
  channels: SequenceChannel[],
  channelState: Map<string, string>,
  position?: PositionPathModel,
}
export interface KeySelection {
  section: SequenceSection,
  channel: SequenceChannel,
  key: SequenceKey,
}
interface TrackSnapshot {
  track: TrackAsset,
  definition: Payload,
  name: string,
  label: string,
  children: TrackAsset[],
  clips: TimelineClip[],
  binding?: EffectsObject,
  muted: boolean,
}
interface SectionSnapshot {
  section: SequenceSection,
  start: number,
  duration: number,
  endBehavior: spec.EndBehavior,
  name: string,
  payload: Payload,
  channelState: Map<string, string>,
  position?: PositionPathSnapshot,
  channels: { channel: SequenceChannel, keys: SequenceKey[], defaultValue: number, references?: Map<string, EffectsObject | null> }[],
}
export interface SequenceSnapshot {
  roots: TrackAsset[],
  tracks: TrackSnapshot[],
  sections: SectionSnapshot[],
  locked: string[],
  selection: SequenceSelection,
  transforms: { item: VFXItem, position: number[], rotation: number[], scale: number[] }[],
}
interface SequenceSelection { tracks: string[], sections: string[], keys: string[], activeChannel: string, curveTracks: string[] }
interface SequenceEditorState extends SequenceSelection { locked: string[], muted: string[] }
interface KeyClipboard {
  offset: number,
  channel: string,
  track: string,
  key: SequenceKey,
  reference?: EffectsObject | null,
  spatial?: SpatialKey,
}
interface SectionClipboard {
  source: SequenceSection,
  offset: number,
  state: SectionSnapshot,
}
interface TrackClipboard {
  source: TrackAsset,
  snapshot: SequenceSnapshot,
}

function copy<T> (value: T): T {
  if (Array.isArray(value)) { return value.map(item => copy(item)) as T; }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as T;
  }

  return value;
}

export class SequencerDocument {
  readonly sections = new Map<TimelineClip, SequenceSection>();
  readonly locked = new Set<string>();
  readonly muted = new Set<string>();
  readonly selectedTracks = new Set<string>();
  readonly selectedSections = new Set<string>();
  readonly selectedKeys = new Set<string>();
  activeChannel = '';
  readonly curveTracks = new Set<string>();
  readonly history = new EditorHistory();
  private transaction?: { label: string, before: SequenceSnapshot, changed: boolean, affectsContent: boolean };
  private unregisterEditorState?: () => void;
  private keyClipboard: KeyClipboard[] = [];
  private sectionClipboard: SectionClipboard[] = [];
  private trackClipboard: TrackClipboard[] = [];
  private classNames = new Map<Function, string>();
  private previewDirty = false;
  private readonly onTimelineChanged = () => { this.previewDirty = true; };
  readonly timeline: TimelineAsset;
  revision = 0;

  constructor (readonly composition: Composition, readonly component: CompositionComponent) {
    const timeline = findSequenceTimeline(component);

    if (!timeline) { throw new Error('The composition has no timeline asset.'); }
    this.timeline = timeline;
    timeline.on('changed', this.onTimelineChanged);
    this.sync();
    this.unregisterEditorState = this.sceneDocument?.registerEditorState<SequenceEditorState>({
      read: () => ({ ...this.selection(), locked: Array.from(this.locked), muted: Array.from(this.muted) }),
      restore: state => {
        this.transaction = undefined;
        this.restoreSelection(state);
        this.locked.clear(); state.locked.forEach(id => this.locked.add(id));
        this.muted.clear(); state.muted.forEach(id => this.muted.add(id));
        this.sync();
        // Object defaults have been restored; evaluate the timeline after them.
        this.changed();
      },
      valid: () => !this.composition.isDestroyed && this.component.isRegistered,
    });
  }

  get tracks (): TrackAsset[] { return this.timeline.flattenedTracks; }
  get currentTime (): number { return this.component.getTime() - this.component.startTime; }
  get duration (): number { return Math.max(1 / 30, this.component.item.duration); }
  private get sceneDocument () { return sceneWorkspace.current?.composition === this.composition ? sceneWorkspace.current : undefined; }
  get canUndo (): boolean { return this.sceneDocument?.canUndo ?? this.history.canUndo; }
  get canRedo (): boolean { return this.sceneDocument?.canRedo ?? this.history.canRedo; }
  get hasClipboard (): boolean { return this.keyClipboard.length > 0 || this.sectionClipboard.length > 0 || this.trackClipboard.length > 0; }

  sync (): void {
    for (const track of this.tracks) {
      for (const clip of track.getClips()) {
        if (!this.sections.has(clip)) { this.sections.set(clip, this.readSection(clip, track)); }
      }
    }
    const sections = this.allSections();
    const live = new Set(sections.map(section => section.clip.getInstanceId()));
    const keys = new Set(sections.flatMap(section => section.channels.flatMap(channel => channel.keys.map(key => key.id))));
    const tracks = new Set(this.tracks.map(track => track.getInstanceId()));

    for (const id of this.selectedSections) { if (!live.has(id)) { this.selectedSections.delete(id); } }
    for (const id of this.selectedKeys) { if (!keys.has(id)) { this.selectedKeys.delete(id); } }
    for (const id of this.selectedTracks) { if (!tracks.has(id)) { this.selectedTracks.delete(id); } }
    for (const id of this.muted) { if (!tracks.has(id)) { this.muted.delete(id); } }
    if (this.previewDirty && this.muted.size) { sampleSequencePreview(this.component, this.timeline, this.muted); }
    this.previewDirty = false;
  }

  dispose (): void {
    this.unregisterEditorState?.();
    this.history.clear('The timeline editor was closed.');
    this.timeline.off('changed', this.onTimelineChanged);
    if (this.muted.size && this.component.isRegistered) { sampleSequencePreview(this.component, this.timeline, new Set()); }
  }

  allSections (): SequenceSection[] {
    return this.tracks.flatMap(track => track.getClips().map(clip => this.sections.get(clip)!)).filter(Boolean);
  }

  selectedKeyItems (): KeySelection[] {
    return this.allSections().flatMap(section => section.channels.flatMap(channel =>
      channel.keys.filter(key => this.selectedKeys.has(key.id)).map(key => ({ section, channel, key })),
    ));
  }

  get selectedSectionItems (): SequenceSection[] {
    return this.allSections().filter(section => this.selectedSections.has(section.clip.getInstanceId()));
  }

  boundItem (track: TrackAsset): VFXItem | undefined {
    let node: TrackAsset | undefined = track;

    while (node) {
      const target = this.component.getBinding(node);

      if (target instanceof VFXItem) { return target; }
      if (target instanceof Component) { return target.item; }
      node = node.parent;
    }

    return undefined;
  }

  boundObject (track: TrackAsset): object | undefined {
    const own = this.component.getBinding(track);

    if (own) { return own; }
    const parent = track.parent && this.boundObject(track.parent);

    if (!parent) { return; }

    return track.resolveBoundObject(parent);
  }

  properties (track: TrackAsset): SequenceProperty[] {
    const item = this.boundItem(track);

    return item ? sequenceProperties(item) : [];
  }

  addPropertyTrack (parent: TrackAsset, property: SequenceProperty): TrackAsset | undefined {
    if (this.isLocked(parent)) { return; }
    const item = this.boundItem(parent);

    if (!item) { return; }
    let root: TrackAsset = parent;

    while (root.parent && this.component.getBinding(root) !== item) { root = root.parent; }
    const target = resolvePropertyTarget(property.target, property.materialIndex);
    const existingTrack = this.tracks.find(track => this.boundItem(track) === item && propertyTrackKind(track) === property.kind &&
      track.definition.path === property.path && this.boundObject(track) === target);

    if (existingTrack) { return existingTrack; }
    let binding = root.getChildTracks().find(track => track instanceof ObjectBindingTrack && this.component.getBinding(track) === property.target);

    if (!binding) {
      binding = new ObjectBindingTrack(this.composition.engine);
      binding.setData({ id: binding.getInstanceId(), dataType: spec.DataType.ObjectBindingTrack,
        name: this.assetType(property.target).replace(/Component$/, ''), clips: [], children: [] });
      root.addChild(binding); this.timeline.markAsChanged(); this.component.setBinding(binding, property.target);
    }
    let owner = binding;

    if (property.materialIndex !== undefined) {
      let material = binding.getChildTracks().find((track): track is MaterialTrack => track instanceof MaterialTrack && track.index === property.materialIndex);

      if (!material) {
        material = new MaterialTrack(this.composition.engine);
        material.setData({ id: material.getInstanceId(), dataType: 'MaterialTrack', name: 'Material ' + (property.materialIndex + 1), index: property.materialIndex, clips: [], children: [] } as unknown as spec.EffectsObjectData);
        binding.addChild(material);
      }
      owner = material;
    }
    if (this.sceneDocument && property.materialIndex !== undefined && propertyValue(target, property.path) === undefined) {
      this.sceneDocument.observe('Initialize material property', () => initializeProperty(property), [target]);
    } else { initializeProperty(property); }
    const track = createPropertyTrack(property);

    owner.addChild(track); this.timeline.markAsChanged();
    const reference = root.getChildTracks().flatMap(track => track.getClips())[0];

    this.createSection(track, reference?.start ?? 0, reference?.duration ?? this.duration);

    return track;
  }

  trackLabel (track: TrackAsset): string {
    return track instanceof ObjectBindingTrack ? track.name || this.boundItem(track)?.name || 'Unbound object' : track.name || this.assetType(track).replace(/Track$/, '');
  }

  assetType (asset: EffectsObject): string {
    let name = this.classNames.get(asset.constructor);

    if (!name) {
      name = Object.keys(effectsClassStore).find(key => effectsClassStore[key] === asset.constructor) ?? asset.definition.dataType ?? asset.constructor.name;
      this.classNames.set(asset.constructor, name!);
    }

    return name!;
  }

  isLocked (track: TrackAsset): boolean {
    let node: TrackAsset | undefined = track;

    while (node) {
      if (this.locked.has(node.getInstanceId())) { return true; }
      node = node.parent;
    }

    return false;
  }

  isMuted (track: TrackAsset): boolean {
    let node: TrackAsset | undefined = track;

    while (node) {
      if (this.muted.has(node.getInstanceId())) { return true; }
      node = node.parent;
    }

    return false;
  }

  toggleMute (track: TrackAsset): void {
    this.edit('Toggle track mute', () => {
      const id = track.getInstanceId();

      if (this.muted.has(id)) { this.muted.delete(id); } else { this.muted.add(id); }
    }, false);
  }

  channelValue (section: SequenceSection, channel: SequenceChannel, time = this.currentTime): number {
    if (channel.pathView !== 'timing' && Math.abs(time - this.currentTime) < 1e-7) {
      const item = this.boundItem(section.track);

      if (item && section.clip instanceof TransformPlayableAsset) {
        const vector = channel.group === 'Location' ? item.transform.position : channel.group === 'Rotation' ? getEditorRotation(item.transform) : item.transform.scale;

        return vector.toArray()[channel.axis];
      }
      const kind = propertyClipKind(section.clip);

      if (kind) {
        const target = propertyValue(this.boundObject(section.track), String(section.track.definition.path ?? ''));

        if (typeof target === 'number') { return target; }
        if (target && kind !== 'reference') { return vectorValues(target, kind)[channel.axis]; }
      }
    }

    if (section.position && channel.pathView) {
      return section.position.evaluate((time - section.clip.start) / section.clip.duration, channel.axis);
    }

    return channel.keys.length ? sampleCurve(channel.keys, (time - section.clip.start) / section.clip.duration) : channel.defaultValue;
  }

  referenceValue (section: SequenceSection, time = this.currentTime): EffectsObject | null {
    return section.clip instanceof ObjectReferencePropertyPlayableAsset ? section.clip.curve.getValue((time - section.clip.start) / section.clip.duration) ?? null : null;
  }

  setReference (section: SequenceSection, channel: SequenceChannel, value: EffectsObject | null): void {
    if (channel.kind !== 'reference' || section.clip.duration <= 0 || this.isLocked(section.track) || this.currentTime < section.clip.start || this.currentTime > section.clip.start + section.clip.duration) { return; }
    if (!value && channel.referenceType) { return; }
    this.edit('Set reference key', () => {
      const time = (this.currentTime - section.clip.start) / section.clip.duration;
      let key = channel.keys.find(key => Math.abs(key.time - time) < 1e-7);

      if (!key) { key = makeKey(time, 0); channel.keys.push(key); channel.keys.sort((a, b) => a.time - b.time); }
      this.selectedKeys.add(key.id);
      channel.references!.set(key.id, value); this.write(section);
    });
  }

  /** Convert explicitly, preparing every result before changing any scene data. */
  separateDimensions (sections: SequenceSection[]): void {
    const conversions = Array.from(new Set(sections)).filter(section => section.position && !this.isLocked(section.track))
      .map(section => ({ section, keys: section.position!.separate() }));

    if (!conversions.length) { return; }
    this.edit('Separate position dimensions', () => {
      this.selectedKeys.clear();
      for (const { section, keys } of conversions) {
        section.channels = section.channels.filter(channel => channel.pathView !== 'timing').map(channel => {
          if (channel.pathView !== 'point') { return channel; }
          const { pathView: _view, ...axis } = channel;

          return { ...axis, keys: keys[channel.axis] };
        });
        section.position = undefined; section.channelState.delete('Location');
        this.write(section);
      }
    });
  }

  temporalKeys (items: KeySelection[]): KeySelection[] {
    const result = new Map<string, KeySelection>();

    for (const item of items) {
      if (!item.channel.pathView) { result.set(item.key.id, item); continue; }
      const channel = item.section.channels.find(channel => channel.pathView === 'timing')!;
      const key = channel.keys.find(key => key.pathKeyId === item.key.pathKeyId);

      if (key) { result.set(key.id, { section: item.section, channel, key }); }
    }

    return Array.from(result.values());
  }

  duplicateKey (item: KeySelection, spatialCopies: Map<string, string>): KeySelection {
    if (item.section.position && item.key.pathKeyId) {
      let id = spatialCopies.get(item.key.pathKeyId);

      if (!id) { id = item.section.position.duplicate(item.key.pathKeyId)!.id; spatialCopies.set(item.key.pathKeyId, id); }
      item.section.position.project(item.section.channels.filter(channel => channel.pathView));

      return { ...item, key: item.channel.keys.find(key => key.pathKeyId === id)! };
    }
    const key = { ...item.key, id: makeKey(0, 0).id };

    item.channel.keys.push(key);
    if (item.channel.references) { item.channel.references.set(key.id, item.channel.references.get(item.key.id) ?? null); }

    return { ...item, key };
  }

  begin (label: string, affectsContent = true, initialTransforms?: ReadonlyMap<VFXItem, number[]>): void {
    if (!this.transaction) {
      this.transaction = { label, before: this.snapshot(), changed: false, affectsContent };
      for (const transform of this.transaction.before.transforms) {
        const values = initialTransforms?.get(transform.item);

        if (values) { transform.position = values.slice(0, 3); transform.rotation = values.slice(3, 6); transform.scale = values.slice(6, 9); }
      }
      this.sceneDocument?.beginSequence(this, label, this.transaction.before, affectsContent);
    } else if (affectsContent && !this.transaction.affectsContent) {
      this.transaction.affectsContent = true;
      this.sceneDocument?.beginSequence(this, label, this.transaction.before, true);
    }
  }

  changed (): void {
    if (this.transaction) { this.transaction.changed = true; }
    this.revision++;
    if (this.transaction?.affectsContent) { this.sceneDocument?.changedSequence(this); }
    sampleSequencePreview(this.component, this.timeline, this.muted);
    this.previewDirty = false;
  }

  commit (): void {
    const transaction = this.transaction;

    this.transaction = undefined;
    if (this.sceneDocument) {
      if (transaction?.changed && transaction.affectsContent) { this.sceneDocument.changedSequence(this); }
      this.sceneDocument.setScopeActive(this, false);

      return;
    }
    if (!transaction?.changed) { return; }
    const before = transaction.before, after = this.snapshot();

    this.history.push({ label: transaction.label, bytes: historyBytes([before, after]),
      valid: () => !this.composition.isDestroyed && this.isValidSnapshot(before) && this.isValidSnapshot(after),
      undo: () => this.restore(before), redo: () => this.restore(after) });
  }

  cancel (): void {
    const before = this.transaction?.before;

    this.transaction = undefined;
    if (before) {
      if (this.sceneDocument) { this.sceneDocument.cancelSequence(this); } else { this.restore(before); }
    }
  }

  edit (label: string, action: () => void, affectsContent = true): void {
    const nested = !!this.transaction;

    this.begin(label, affectsContent);
    try { action(); this.changed(); if (!nested) { this.commit(); } } catch (error) { this.cancel(); throw error; }
  }

  undo (): void {
    this.commit();
    if (this.sceneDocument) {
      sceneWorkspace.undo();

      return;
    }
    this.history.undo();
  }

  redo (): void {
    if (this.sceneDocument) {
      sceneWorkspace.redo();

      return;
    }
    this.commit(); this.history.redo();
  }

  setTime (time: number): void {
    this.composition.pause();
    if (this.component === this.composition.sceneRoot.getComponent(CompositionComponent)) { this.composition.setTime(Math.max(0, time)); } else { this.component.setTime(Math.max(0, time) + this.component.startTime); }
  }

  clearSelection (): void {
    this.selectedTracks.clear(); this.selectedSections.clear(); this.selectedKeys.clear();
  }

  private selection (): SequenceSelection {
    return { tracks: Array.from(this.selectedTracks), sections: Array.from(this.selectedSections), keys: Array.from(this.selectedKeys),
      activeChannel: this.activeChannel, curveTracks: Array.from(this.curveTracks) };
  }

  private restoreSelection (state: SequenceSelection): void {
    this.clearSelection();
    state.tracks.forEach(id => this.selectedTracks.add(id));
    state.sections.forEach(id => this.selectedSections.add(id));
    state.keys.forEach(id => this.selectedKeys.add(id));
    this.activeChannel = state.activeChannel;
    this.curveTracks.clear(); state.curveTracks.forEach(id => this.curveTracks.add(id));
  }

  addBinding (item: VFXItem): ObjectBindingTrack {
    const existing = this.timeline.tracks.find(track => this.component.getBinding(track) === item);

    if (existing instanceof ObjectBindingTrack) { return existing; }
    const track = new ObjectBindingTrack(this.composition.engine);

    track.setData({ id: track.getInstanceId(), dataType: spec.DataType.ObjectBindingTrack, name: item.name, clips: [], children: [] });
    this.timeline.tracks.push(track);
    this.timeline.markAsChanged();
    this.component.setBinding(track, item);

    return track;
  }

  addTrack (parent: TrackAsset, kind: 'transform' | 'activation' | 'opacity' | 'composition'): TrackAsset | undefined {
    if (this.isLocked(parent)) { return; }
    const Constructor = kind === 'transform' ? TransformTrack : kind === 'activation' ? ActivationTrack : kind === 'composition' ? SubCompositionTrack : SpriteColorTrack;
    const existing = parent.getChildTracks().find(child => child.constructor === Constructor);

    if (existing) { return existing; }
    const track = new Constructor(this.composition.engine);

    track.setData({ id: track.getInstanceId(), dataType: this.assetType(track) as spec.DataType,
      name: kind[0].toUpperCase() + kind.slice(1), clips: [], children: [] });
    parent.addChild(track);
    this.createSection(track, 0, this.duration);
    this.timeline.markAsChanged();

    return track;
  }

  canCreateSection (track: TrackAsset): boolean {
    return !this.isLocked(track) && (track instanceof TransformTrack || track instanceof ActivationTrack || track instanceof SpriteColorTrack ||
      track instanceof SubCompositionTrack || !!propertyTrackKind(track) || track.getClips().length > 0);
  }

  createSection (track: TrackAsset, start = this.currentTime, duration = Math.min(1, this.duration)): SequenceSection | undefined {
    if (!this.canCreateSection(track)) { return; }
    let clip: TimelineClip;

    if (track instanceof TransformTrack) {
      clip = track.createClip(TransformPlayableAsset, 'Transform');
      clip.fromData({ id: clip.getInstanceId() } as unknown as spec.EffectsObjectData);
    } else if (track instanceof ActivationTrack) {
      clip = track.createClip(ActivationPlayableAsset, 'Active');
    } else if (track instanceof SpriteColorTrack) {
      clip = track.createClip(SpriteColorPlayableAsset, 'Opacity');
      clip.fromData({ id: clip.getInstanceId(), colorOverLifetime: { opacity: 1 } } as unknown as spec.EffectsObjectData);
    } else if (track instanceof SubCompositionTrack) {
      clip = track.createClip(SubCompositionPlayableAsset, 'Composition');
    } else if (propertyTrackKind(track)) {
      const property = createPropertyClip(track)!;

      property.setData({ id: property.getInstanceId(), dataType: this.assetType(property), name: track.name,
        curveData: initialPropertyCurve(propertyTrackKind(track)!, propertyValue(this.boundObject(track), String(track.definition.path ?? ''))) } as unknown as spec.EffectsObjectData);
      clip = property;
    } else {
      const source = track.getClips()[0];

      if (!source) { return; }

      return this.duplicateSection(this.sections.get(source)!, start);
    }
    clip.start = Math.max(0, start);
    clip.duration = Math.max(1 / 30, duration);
    clip.endBehavior = spec.EndBehavior.destroy;
    const section = this.readSection(clip, track);

    this.sections.set(clip, section);
    this.write(section);

    return section;
  }

  write (section: SequenceSection): void {
    const clip = section.clip;
    const payload = copy(section.payload);
    const changed = (group: string) => this.channelSignature(section, group) !== section.channelState.get(group);
    const expression = (group: string, axis: number) => {
      const channel = section.channels.find(item => item.group === group && item.axis === axis);

      return channel?.keys.length ? encodeCurve(channel.keys) : undefined;
    };

    if (clip instanceof TransformPlayableAsset) {
      const data = payload as unknown as TransformData;

      if (section.position) {
        section.position.update(section.channels.filter(channel => channel.pathView));
        const path = section.position.runtimeExpression();

        if (path) {
          data.positionOverLifetime = { path };
        } else { delete data.positionOverLifetime; }
      } else if (changed('Location')) {
        const path = encodePositionAxes(section.channels.filter(channel => channel.group === 'Location'));

        if (path) { data.positionOverLifetime = { path }; } else { delete data.positionOverLifetime; }
      }
      const rotation = [0, 1, 2].map(axis => expression('Rotation', axis));

      if (changed('Rotation') && !rotation.some(Boolean) && data.rotationOverLifetime) { delete data.rotationOverLifetime.x; delete data.rotationOverLifetime.y; delete data.rotationOverLifetime.z; }
      if (changed('Rotation') && rotation.some(Boolean)) {
        data.rotationOverLifetime = { ...data.rotationOverLifetime, separateAxes: true, asRotation: true, x: rotation[0], y: rotation[1], z: rotation[2] };
      }
      const scale = [0, 1, 2].map(axis => expression('Scale', axis));

      if (changed('Scale') && !scale.some(Boolean) && data.sizeOverLifetime) { delete data.sizeOverLifetime.x; delete data.sizeOverLifetime.y; delete data.sizeOverLifetime.z; delete data.sizeOverLifetime.size; }
      if (changed('Scale') && scale.some(Boolean)) {
        data.sizeOverLifetime = { ...data.sizeOverLifetime, separateAxes: true, x: scale[0], y: scale[1], z: scale[2] };
      }
    } else if (clip instanceof SpriteColorPlayableAsset) {
      const color = (payload.colorOverLifetime ?? {}) as Record<string, unknown>;

      color.opacity = section.channels[0].keys.length ? encodeCurve(section.channels[0].keys) : section.channels[0].defaultValue;
      payload.colorOverLifetime = color;
    } else if (clip instanceof FloatPropertyPlayableAsset) {
      payload.curveData = section.channels[0].keys.length ? encodeCurve(section.channels[0].keys) : section.channels[0].defaultValue;
    } else if (clip instanceof ObjectReferencePropertyPlayableAsset) {
      const channel = section.channels[0];

      payload.curveData = [REFERENCE_CURVE, channel.keys.map(key => [key.time, channel.references?.get(key.id) ? { id: channel.references.get(key.id)!.getInstanceId() } : null])];
    } else {
      const kind = propertyClipKind(clip);
      const types = { color: spec.ValueType.COLOR_CURVE, vector2: spec.ValueType.VECTOR2_CURVE, vector3: spec.ValueType.VECTOR3_CURVE, vector4: spec.ValueType.VECTOR4_CURVE };

      if (kind && kind !== 'reference' && kind !== 'float') {
        payload.curveData = [types[kind], section.channels.map(channel => channel.keys.length ? encodeCurve(channel.keys) : [spec.ValueType.CONSTANT, channel.defaultValue])];
      }
    }
    payload.id = clip.getInstanceId();
    payload.dataType = this.assetType(clip); payload.name = clip.name;
    payload.start = clip.start; payload.duration = clip.duration; payload.endBehavior = clip.endBehavior;
    clip.setData(copy(payload) as unknown as spec.EffectsObjectData);
    section.payload = payload;
    this.recordChannelState(section);
  }

  insertKey (section: SequenceSection, channel: SequenceChannel, time: number, value?: number, preserveCurve = false): void {
    if (this.isLocked(section.track) || section.clip.duration <= 0 || time < section.clip.start - 1e-8 || time > section.clip.start + section.clip.duration + 1e-8) { return; }
    const normalized = Math.max(0, Math.min(1, (time - section.clip.start) / section.clip.duration));

    if (section.position && channel.pathView) {
      const sourceTime = section.position.range[0] + normalized * (section.position.range[1] - section.position.range[0]);
      const existing = section.position.keys.find(key => Math.abs(key.timing.time - sourceTime) < 1e-8);
      const point = existing ? [...existing.point] as spec.vec3 : [0, 1, 2].map(axis => section.position!.evaluate(normalized, axis)) as spec.vec3;

      if (channel.pathView === 'point' && !preserveCurve) { point[channel.axis] = value ?? this.channelValue(section, channel, time); }
      const key = section.position.insert(normalized, channel.pathView === 'point' && !preserveCurve ? point : undefined);

      section.position.project(section.channels.filter(channel => channel.pathView));
      this.selectedKeys.add(key.id + ':' + channel.axis);
      this.write(section);

      return;
    }

    if (preserveCurve && channel.kind === 'number' && channel.keys.length) {
      insertBoundary(channel.keys, normalized);
      const key = channel.keys.find(item => Math.abs(item.time - normalized) < 1e-7);

      if (key) { this.selectedKeys.add(key.id); }
      this.write(section);

      return;
    }
    const existing = channel.keys.find(key => Math.abs(key.time - normalized) < 1e-7);
    const reference = channel.kind === 'reference' ? propertyValue(this.boundObject(section.track), String(section.track.definition.path ?? '')) : undefined;

    if (channel.kind === 'reference' && channel.referenceType && !reference) { return; }
    const rawValue = value ?? this.channelValue(section, channel, time);
    const targetValue = Math.max(channel.minimum ?? -Infinity, Math.min(channel.maximum ?? Infinity, channel.integer ? Math.round(rawValue) : rawValue));

    if (propertyClipKind(section.clip) && channel.kind === 'number') {
      // Capture defaults for every unkeyed channel before writing the composite curve.
      for (const other of section.channels) {
        if (!other.keys.length) { other.defaultValue = this.channelValue(section, other, time); }
      }
    }
    if (existing) { existing.value = targetValue; this.selectedKeys.add(existing.id); } else {
      const key = makeKey(normalized, targetValue);

      channel.keys.push(key); this.selectedKeys.add(key.id);
    }
    if (channel.kind === 'reference') {
      const key = channel.keys.find(key => Math.abs(key.time - normalized) < 1e-7)!;

      channel.references?.set(key.id, reference && typeof reference === 'object' && 'getInstanceId' in reference ? reference as EffectsObject : null);
    }
    if (channel.group === 'Location') {
      for (const axis of section.channels.filter(item => item.group === 'Location' && !item.keys.length)) {
        axis.keys.push(makeKey(normalized, this.channelValue(section, axis, time)));
      }
    }
    updateAutoTangents(channel.keys);
    this.write(section);
  }

  addKeys (time: number, channelId?: string): void {
    const keyChannels = new Set(this.selectedKeyItems().map(item => item.channel));
    const targetsChannel = (section: SequenceSection, channel: SequenceChannel) => channelId ? channel.id === channelId :
      this.trackSelected(section.track) || this.selectedSections.has(section.clip.getInstanceId()) || keyChannels.has(channel);
    const targets = this.allSections().filter(section => !this.isLocked(section.track) &&
      time >= section.clip.start - 1e-8 && time <= section.clip.start + section.clip.duration + 1e-8 &&
      section.channels.some(channel => targetsChannel(section, channel)));

    if (!targets.length) { return; }
    this.edit('Add keyframes', () => {
      this.selectedKeys.clear();
      for (const section of targets) {
        if (time < section.clip.start - 1e-8 || time > section.clip.start + section.clip.duration + 1e-8) { continue; }
        for (const channel of section.channels) {
          if (targetsChannel(section, channel)) { this.insertKey(section, channel, time); }
        }
      }
    });
  }

  trackSelected (track: TrackAsset): boolean {
    let node: TrackAsset | undefined = track;

    while (node) {
      if (this.selectedTracks.has(node.getInstanceId())) { return true; }
      node = node.parent;
    }

    return false;
  }

  deleteSelection (): void {
    this.edit('Delete selection', () => {
      if (this.selectedKeys.size) {
        for (const section of this.allSections()) {
          if (this.isLocked(section.track)) { continue; }
          if (section.position) {
            const ids = new Set(section.channels.flatMap(channel => channel.keys.filter(key => this.selectedKeys.has(key.id) && key.pathKeyId).map(key => key.pathKeyId!)));

            section.position.remove(ids); section.position.project(section.channels.filter(channel => channel.pathView));
          }
          for (const channel of section.channels) {
            if (!channel.pathView) { channel.keys = channel.keys.filter(key => !this.selectedKeys.has(key.id)); }
          }
          this.write(section);
        }
        this.selectedKeys.clear();
      } else if (this.selectedSections.size) {
        for (const track of this.tracks) {
          if (this.isLocked(track)) { continue; }
          const clips = track.getClips();

          for (let i = clips.length - 1; i >= 0; i--) {
            if (this.selectedSections.has(clips[i].getInstanceId())) { clips.splice(i, 1); }
          }
        }
        this.selectedSections.clear();
      } else {
        for (const track of [...this.tracks].reverse()) {
          if (!this.selectedTracks.has(track.getInstanceId()) || this.isLocked(track)) { continue; }
          const siblings = track.parent ? track.parent.getChildTracks() : this.timeline.tracks;
          const index = siblings.indexOf(track);

          if (index >= 0) { siblings.splice(index, 1); this.component.clearBinding(track); }
        }
        this.selectedTracks.clear();
      }
    });
  }

  reorderTrack (track: TrackAsset, target: TrackAsset, after = false): void {
    if (track === target || track.parent !== target.parent || this.isLocked(track)) { return; }
    this.edit('Reorder tracks', () => {
      const siblings = track.parent ? track.parent.getChildTracks() : this.timeline.tracks;

      siblings.splice(siblings.indexOf(track), 1);
      siblings.splice(siblings.indexOf(target) + (after ? 1 : 0), 0, track);
    });
  }

  duplicateSection (source: SequenceSection, start: number, targetTrack = source.track, state = this.snapshotSection(source)): SequenceSection {
    const Constructor = source.clip.constructor as new (engine: Composition['engine']) => TimelineClip;
    const clip = new Constructor(this.composition.engine);

    clip.name = state.name;
    clip.start = start; clip.duration = state.duration; clip.endBehavior = state.endBehavior;
    targetTrack.addClip(clip);
    const section: SequenceSection = {
      clip, track: targetTrack, payload: copy(state.payload), channelState: new Map(state.channelState),
      position: state.position ? PositionPathModel.restore(state.position, true) : undefined,
      channels: state.channels.map(({ channel, keys: sourceKeys, defaultValue, references: sourceReferences }) => {
        const references = new Map<string, EffectsObject | null>();
        const keys = sourceKeys.map(key => {
          const result = { ...key, id: makeKey(0, 0).id };

          references.set(result.id, sourceReferences?.get(key.id) ?? null);

          return result;
        });

        return { ...channel, id: clip.getInstanceId() + ':' + channel.group + '.' + channel.label, keys, defaultValue, references };
      }),
    };

    section.position?.project(section.channels.filter(channel => channel.pathView));
    this.sections.set(clip, section); this.write(section);

    return section;
  }

  resizeSection (section: SequenceSection, start: number, end: number, stretch = false): void {
    if (this.isLocked(section.track)) { return; }
    const oldStart = section.clip.start, duration = section.clip.duration;

    if (!stretch && duration > 0) {
      section.position?.trim((start - oldStart) / duration, (end - oldStart) / duration);
      for (const channel of section.channels) {
        if (channel.pathView) { continue; }
        const previous = channel.keys;

        channel.keys = trimKeys(previous, (start - oldStart) / duration, (end - oldStart) / duration);
        if (channel.kind === 'reference') {
          for (const key of channel.keys) {
            if (!channel.references?.has(key.id)) {
              const originalTime = (start + key.time * (end - start) - oldStart) / duration;
              const reference = previous.filter(item => item.time <= originalTime + 1e-8).at(-1) ?? previous[0];

              channel.references?.set(key.id, channel.references.get(reference?.id ?? '') ?? null);
            }
          }
        }
      }
      section.position?.project(section.channels.filter(channel => channel.pathView));
    }
    section.clip.start = start; section.clip.duration = Math.max(1 / 240, end - start);
    this.write(section);
  }

  splitSelection (time: number): void {
    const keySections = new Set(this.selectedKeyItems().map(item => item.section));
    const candidates = this.selectedSectionItems.length ? this.selectedSectionItems : this.allSections().filter(section =>
      keySections.has(section) || this.trackSelected(section.track));
    const targets = candidates.filter(section => !this.isLocked(section.track) &&
      time > section.clip.start + 1e-7 && time < section.clip.start + section.clip.duration - 1e-7);

    if (!targets.length) { return; }
    this.edit('Split sections', () => {
      this.selectedKeys.clear(); this.selectedSections.clear();
      for (const section of targets) {
        const end = section.clip.start + section.clip.duration;

        const right = this.duplicateSection(section, section.clip.start);

        this.resizeSection(right, time, end);
        this.resizeSection(section, section.clip.start, time);
        if (section.clip instanceof TransformPlayableAsset && (section.payload as unknown as TransformData).positionOverLifetime?.path) {
          // A retained position path must stop contributing when its continuation starts.
          section.clip.endBehavior = spec.EndBehavior.destroy; this.write(section);
        }
        this.selectedSections.add(section.clip.getInstanceId());
        this.selectedSections.add(right.clip.getInstanceId());
      }
    });
  }

  copySelection (): void {
    this.keyClipboard = []; this.sectionClipboard = []; this.trackClipboard = [];
    const keys = this.selectedKeyItems();

    if (keys.length) {
      const first = Math.min(...keys.map(item => item.section.clip.start + item.key.time * item.section.clip.duration));

      const spatial = new Set<string>();

      this.keyClipboard = keys.filter(({ key }) => {
        if (!key.pathKeyId) { return true; }
        if (spatial.has(key.pathKeyId)) { return false; }
        spatial.add(key.pathKeyId);

        return true;
      }).map(({ section, channel, key }) => ({
        offset: section.clip.start + key.time * section.clip.duration - first,
        track: section.track.getInstanceId(), channel: channel.group + '.' + channel.label,
        key: { ...key }, reference: channel.references?.get(key.id),
        spatial: key.pathKeyId ? copy(section.position?.keys.find(entry => entry.id === key.pathKeyId)) : undefined,
      }));
    } else if (this.selectedSections.size) {
      const sections = this.selectedSectionItems;
      const first = Math.min(...sections.map(section => section.clip.start));

      this.sectionClipboard = sections.map(section => ({ source: section, offset: section.clip.start - first, state: this.snapshotSection(section) }));
    } else {
      const snapshot = this.snapshot();

      this.trackClipboard = this.tracks.filter(track => this.selectedTracks.has(track.getInstanceId()) &&
        (!track.parent || !this.trackSelected(track.parent))).map(source => ({ source, snapshot }));
    }
  }

  paste (time = this.currentTime): void {
    if (!this.hasClipboard) { return; }
    this.edit('Paste selection', () => {
      this.selectedKeys.clear(); this.selectedSections.clear();
      for (const entry of this.keyClipboard) {
        const sections = this.allSections().filter(section =>
          (this.selectedTracks.size ? this.trackSelected(section.track) : section.track.getInstanceId() === entry.track) &&
          time + entry.offset >= section.clip.start && time + entry.offset <= section.clip.start + section.clip.duration,
        );

        for (const section of sections) {
          if (this.isLocked(section.track)) { continue; }
          if (entry.spatial) {
            const t = (time + entry.offset - section.clip.start) / section.clip.duration;

            if (section.position) {
              const key = section.position.insert(t, entry.spatial.point);

              section.position.setControl(key.id, 'incoming', entry.spatial.incoming);
              section.position.setControl(key.id, 'outgoing', entry.spatial.outgoing);
              section.position.project(section.channels.filter(channel => channel.pathView));
              this.selectedKeys.add(key.id + ':0'); this.write(section);
            } else {
              for (const channel of section.channels.filter(channel => channel.group === 'Location')) {
                this.insertKey(section, channel, time + entry.offset, entry.spatial.point[channel.axis]);
              }
            }

            continue;
          }
          const channel = section.channels.find(item => item.group + '.' + item.label === entry.channel);

          if (!channel) { continue; }
          if (channel.pathView) { this.insertKey(section, channel, time + entry.offset, entry.key.value); continue; }
          const t = (time + entry.offset - section.clip.start) / section.clip.duration;

          channel.keys = channel.keys.filter(key => Math.abs(key.time - t) > 1e-7);
          const key = { ...entry.key, id: makeKey(0, 0).id, time: t };

          channel.keys.push(key); channel.references?.set(key.id, entry.reference ?? null);
          updateAutoTangents(channel.keys); this.selectedKeys.add(key.id); this.write(section);
        }
      }
      for (const entry of this.sectionClipboard) {
        const target = this.tracks.find(track => this.selectedTracks.has(track.getInstanceId()) && track.constructor === entry.source.track.constructor) ?? entry.source.track;

        if (!this.tracks.includes(target) || this.isLocked(target)) { continue; }
        const section = this.duplicateSection(entry.source, time + entry.offset, target, entry.state);

        this.selectedSections.add(section.clip.getInstanceId());
      }
      if (this.trackClipboard.length) {
        const target = this.tracks.find(track => this.selectedTracks.has(track.getInstanceId()));

        this.selectedTracks.clear();
        for (const entry of this.trackClipboard) {
          const parent = entry.source.parent ? (target instanceof ObjectBindingTrack ? target : target?.parent) ??
            (this.tracks.includes(entry.source.parent) ? entry.source.parent : undefined) : undefined;

          if (entry.source.parent && !parent || parent && this.isLocked(parent)) { continue; }
          const track = this.cloneTrack(entry.source, entry.snapshot, parent);

          this.selectedTracks.add(track.getInstanceId());
        }
      }
    });
  }

  duplicateSelection (): void {
    if (!this.selectedKeys.size && !this.selectedSections.size && this.selectedTracks.size) {
      const sources = this.tracks.filter(track => this.selectedTracks.has(track.getInstanceId()) &&
        !this.isLocked(track) && (!track.parent || !this.trackSelected(track.parent)));
      const snapshot = this.snapshot();

      this.edit('Duplicate tracks', () => {
        this.selectedTracks.clear();
        for (const source of sources) {
          const track = this.cloneTrack(source, snapshot, source.parent);

          track.name += ' Copy'; this.selectedTracks.add(track.getInstanceId());
        }
      });

      return;
    }
    this.copySelection();
    const end = Math.max(this.currentTime, ...this.selectedSectionItems.map(section => section.clip.start + section.clip.duration),
      ...this.selectedKeyItems().map(item => item.section.clip.start + item.key.time * item.section.clip.duration + 1 / 30));

    this.paste(end);
  }

  snapshot (): SequenceSnapshot {
    const items = new Set(this.tracks.map(track => this.boundItem(track)).filter((item): item is VFXItem => !!item));

    return {
      roots: [...this.timeline.tracks], locked: Array.from(this.locked), selection: this.selection(),
      transforms: Array.from(items, item => ({ item, position: item.transform.position.toArray(),
        rotation: getEditorRotation(item.transform).toArray(), scale: item.transform.scale.toArray() })),
      tracks: this.tracks.map(track => ({
        track, definition: copy(track.definition), name: track.name, label: this.trackLabel(track), children: [...track.getChildTracks()], clips: [...track.getClips()], binding: this.component.getBinding(track), muted: this.muted.has(track.getInstanceId()),
      })),
      sections: this.allSections().map(section => this.snapshotSection(section)),
    };
  }

  private snapshotSection (section: SequenceSection): SectionSnapshot {
    return {
      section, start: section.clip.start, duration: section.clip.duration, endBehavior: section.clip.endBehavior,
      name: section.clip.name, payload: copy(section.payload), channelState: new Map(section.channelState),
      position: section.position?.snapshot(),
      channels: section.channels.map(channel => ({ channel, keys: channel.keys.map(key => ({ ...key })), defaultValue: channel.defaultValue,
        references: channel.references ? new Map(channel.references) : undefined })),
    };
  }

  private cloneTrack (source: TrackAsset, snapshot: SequenceSnapshot, parent?: TrackAsset): TrackAsset {
    const state = snapshot.tracks.find(entry => entry.track === source)!;
    const Constructor = source.constructor as new (engine: Composition['engine']) => TrackAsset;
    const track = new Constructor(this.composition.engine);

    track.fromData({ ...copy(state.definition), dataType: this.assetType(source) as spec.DataType, id: track.getInstanceId(), clips: [], children: [] });
    track.definition = { ...copy(state.definition), id: track.getInstanceId() };
    track.name = state.name || state.label;
    if (state.muted) { this.muted.add(track.getInstanceId()); }
    if (parent) { parent.addChild(track); } else { this.timeline.tracks.push(track); }
    this.timeline.markAsChanged();
    if (state.binding) { this.component.setBinding(track, state.binding); }
    for (const clip of state.clips) {
      const sectionState = snapshot.sections.find(entry => entry.section.clip === clip)!;

      this.duplicateSection(sectionState.section, sectionState.start, track, sectionState);
    }
    for (const child of state.children) { this.cloneTrack(child, snapshot, track); }

    return track;
  }

  restore (snapshot: SequenceSnapshot): void {
    this.transaction = undefined;
    for (const track of this.tracks) { this.component.clearBinding(track); }
    this.timeline.tracks.splice(0, this.timeline.tracks.length, ...snapshot.roots);
    this.muted.clear();
    for (const state of snapshot.tracks) {
      state.track.name = state.name;
      Reflect.set(state.track, 'parent', undefined);
      if (state.muted) { this.muted.add(state.track.getInstanceId()); }
      state.track.getChildTracks().splice(0, state.track.getChildTracks().length, ...state.children);
      state.track.getClips().splice(0, state.track.getClips().length, ...state.clips);
    }
    for (const state of snapshot.tracks) { for (const child of state.children) { child.parent = state.track; } }
    this.locked.clear(); snapshot.locked.forEach(id => this.locked.add(id));
    this.timeline.markAsChanged();
    for (const state of snapshot.tracks) { if (state.binding) { this.component.setBinding(state.track, state.binding); } }
    for (const state of snapshot.sections) {
      const section = state.section;

      section.clip.start = state.start; section.clip.duration = state.duration;
      section.clip.endBehavior = state.endBehavior; section.clip.name = state.name; section.payload = copy(state.payload); section.channelState = new Map(state.channelState);
      section.position = state.position ? PositionPathModel.restore(state.position) : undefined;
      section.channels = state.channels.map(channel => channel.channel);
      for (const channel of state.channels) {
        channel.channel.keys = channel.keys.map(key => ({ ...key }));
        channel.channel.defaultValue = channel.defaultValue;
        channel.channel.references = channel.references ? new Map(channel.references) : undefined;
      }
      section.position?.project(section.channels.filter(channel => channel.pathView));
      this.write(section);
    }
    for (const { item, position, rotation, scale } of snapshot.transforms) {
      item.transform.setPosition(position[0], position[1], position[2]);
      item.transform.setRotation(rotation[0], rotation[1], rotation[2]);
      item.transform.setScale(scale[0], scale[1], scale[2]);
    }
    this.restoreSelection(snapshot.selection); this.sync(); this.changed();
  }

  isValidSnapshot (snapshot: SequenceSnapshot): boolean {
    return this.component.isRegistered && snapshot.tracks.every(state => state.track.isRegistered && (!state.binding || state.binding.isRegistered)) &&
      snapshot.sections.every(state => state.section.clip.isRegistered && state.channels.every(channel =>
        !channel.references || Array.from(channel.references.values()).every(reference => !reference || reference.isRegistered))) &&
      snapshot.transforms.every(state => state.item.isRegistered);
  }

  exportData (): object {
    return {
      version: '3.9',
      timelineAsset: { id: this.timeline.getInstanceId() },
      miscs: [
        { id: this.timeline.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: this.timeline.tracks.map(track => ({ id: track.getInstanceId() })) },
        ...this.tracks.map(track => ({ ...track.definition, id: track.getInstanceId(), name: track.name, dataType: this.assetType(track),
          children: track.getChildTracks().map(child => ({ id: child.getInstanceId() })), clips: track.getClips().map(clip => ({ id: clip.getInstanceId() })) })),
        ...this.allSections().map(section => ({ ...copy(section.payload), id: section.clip.getInstanceId(), name: section.clip.name,
          dataType: this.assetType(section.clip), start: section.clip.start, duration: section.clip.duration, endBehavior: section.clip.endBehavior })),
      ],
      sceneBindings: this.tracks.flatMap(track => {
        const target = this.component.getBinding(track);

        return target ? [{ key: { id: track.getInstanceId() }, value: { id: target.getInstanceId() } }] : [];
      }),
    };
  }

  exportEditorData (): SequenceEditorData {
    const id = (object: EffectsObject) => this.sceneDocument?.serializer.id(object) ?? object.getInstanceId();

    return {
      timelineId: id(this.timeline),
      version: 3,
      positions: Object.fromEntries(this.allSections().filter(section => section.clip instanceof TransformPlayableAsset).map(section => [id(section.clip), {
        mode: section.position ? 'path' : 'separated', source: curveSourceSignature(this.channelSource(section, 'Location')),
      }])),
      sections: Object.fromEntries(this.allSections().map(section => [id(section.clip), section.channels.filter(channel => channel.kind === 'number' && !channel.pathView).map(channel => ({
        group: channel.group, axis: channel.axis, defaultValue: channel.defaultValue,
        source: curveSourceSignature(this.channelSource(section, channel.group)),
        keys: channel.keys.map(({ id: _id, ...key }) => ({ ...key })),
      }))])),
    };
  }

  private channelSource (section: SequenceSection, group: string): unknown {
    if (section.clip instanceof TransformPlayableAsset) {
      const data = section.payload as unknown as TransformData;

      return group === 'Location' ? data.positionOverLifetime?.path : group === 'Rotation' ? data.rotationOverLifetime : data.sizeOverLifetime;
    }

    return section.clip instanceof SpriteColorPlayableAsset ? section.payload.colorOverLifetime : section.payload.curveData;
  }

  private savedEditorData (): SequenceEditorData | undefined {
    const document = this.sceneDocument;

    if (!document) { return; }
    const timelineId = document.serializer.id(this.timeline);
    const data = document.editor.sequences?.[timelineId] ?? document.editor.sequences?.[document.serializer.id(this.component)];

    return data?.timelineId === timelineId ? data : undefined;
  }

  private separatedPosition (section: SequenceSection): boolean {
    const path = (section.payload as unknown as TransformData).positionOverLifetime?.path;

    if (path) { return path[0] === spec.ValueType.VECTOR3_CURVE; }
    const clipId = this.sceneDocument?.serializer.id(section.clip);
    const saved = clipId ? this.savedEditorData()?.positions?.[clipId] : undefined;

    return saved?.mode === 'separated' && saved.source === curveSourceSignature(path);
  }

  private savedChannels (section: SequenceSection): SequenceChannelEditorData[] {
    const document = this.sceneDocument, data = this.savedEditorData();

    if (!document || !data) { return []; }

    return (data.sections?.[document.serializer.id(section.clip)] ?? []).filter(channel =>
      (channel.group !== 'Location' || (data.version ?? 0) >= 2 && this.separatedPosition(section)) &&
      channel.source === curveSourceSignature(this.channelSource(section, channel.group)) && Number.isFinite(channel.defaultValue) &&
      Array.isArray(channel.keys) && channel.keys.every(key =>
        [key.time, key.value, key.inSlope, key.outSlope, key.inWeight, key.outWeight, key.weightedMode, key.interpolationMode].every(Number.isFinite) &&
        ['auto', 'user', 'break'].includes(key.tangentMode)));
  }

  private readSection (clip: TimelineClip, track: TrackAsset): SequenceSection {
    const payload = copy(clip instanceof TransformPlayableAsset ? clip.transformAnimationData ?? {} :
      clip instanceof SpriteColorPlayableAsset ? clip.data ?? {} : clip.definition ?? {}) as Payload;
    const section: SequenceSection = { clip, track, payload, channels: [], channelState: new Map() };
    const item = this.boundItem(track);
    const saved = this.savedChannels(section);
    const add = (group: string, label: string, axis: number, expression: spec.FixedNumberExpression | undefined, fallback: number) => {
      const authored = saved.find(channel => channel.group === group && channel.axis === axis);
      const constant = typeof expression === 'number' || Array.isArray(expression) && expression[0] === spec.ValueType.CONSTANT;
      const channel: SequenceChannel = {
        id: clip.getInstanceId() + ':' + group + '.' + label, group, label, axis,
        keys: authored ? authored.keys.map(key => ({ ...key, id: makeKey(key.time, key.value).id })) : propertyClipKind(clip) && constant ? [] : decodeCurve(expression, fallback),
        defaultValue: authored && this.channelSource(section, group) !== undefined ? authored.defaultValue : fallback, kind: 'number',
      };

      section.channels.push(channel);

      return channel;
    };

    if (clip instanceof TransformPlayableAsset) {
      const data = clip.transformAnimationData as TransformData | undefined;
      const path = data?.positionOverLifetime?.path;
      const separated = this.separatedPosition(section);
      const defaults = item?.transform.position.toArray() ?? [0, 0, 0];

      for (let axis = 0; axis < 3; axis++) {
        const channel = add('Location', ['X', 'Y', 'Z'][axis], axis,
          path?.[0] === spec.ValueType.VECTOR3_CURVE ? path[1][axis] : undefined, defaults[axis]);

        if (!separated) { channel.pathView = 'point'; }
      }
      if (!separated) {
        section.position = new PositionPathModel(path as spec.FixedVec3Expression | undefined, defaults as spec.vec3);
        add('Location', 'Timing', 3, undefined, 0).pathView = 'timing';
        section.position.project(section.channels.filter(channel => channel.pathView));
      }
      const rotation = data?.rotationOverLifetime;
      const scale = data?.sizeOverLifetime;

      for (let axis = 0; axis < 3; axis++) {
        add('Rotation', ['X', 'Y', 'Z'][axis], axis,
          axis === 2 || rotation?.separateAxes ? rotation?.[['x', 'y', 'z'][axis] as 'x' | 'y' | 'z'] : undefined,
          item ? getEditorRotation(item.transform).toArray()[axis] : 0);
      }
      for (let axis = 0; axis < 3; axis++) {
        add('Scale', ['X', 'Y', 'Z'][axis], axis, scale?.separateAxes ? scale[['x', 'y', 'z'][axis] as 'x' | 'y' | 'z'] : scale?.size,
          item?.transform.scale.toArray()[axis] ?? 1);
      }
    } else if (clip instanceof SpriteColorPlayableAsset) {
      add('Color', 'Opacity', 3, clip.data?.colorOverLifetime?.opacity, 1);
    } else if (clip instanceof FloatPropertyPlayableAsset) {
      add('Value', 'Value', 0, payload.curveData as spec.FixedNumberExpression, clip.curve?.getValue(0) ?? 0);
    } else if (clip instanceof ObjectReferencePropertyPlayableAsset) {
      const channel = add('Value', 'Reference', 0, undefined, 0);

      channel.kind = 'reference'; channel.references = new Map();
      channel.keys = clip.curve.keyframes.map(([time, value]) => {
        const key = makeKey(time, 0);

        channel.references!.set(key.id, value);

        return key;
      });
    } else {
      const kind = propertyClipKind(clip);

      if (kind && kind !== 'float' && kind !== 'reference') {
        const curve = (clip as import('./sequencer-properties').PropertyClip).curve;
        const defaults = vectorValues(curve.getValue(0), kind);
        const expression = payload.curveData as [number, spec.FixedNumberExpression[]] | undefined;
        const labels = kind === 'color' ? ['R', 'G', 'B', 'A'] : ['X', 'Y', 'Z', 'W'];

        defaults.forEach((fallback, axis) => add(kind === 'color' ? 'Color' : 'Value', labels[axis], axis, expression?.[1]?.[axis], fallback));
      }
    }
    if (propertyClipKind(clip)) {
      const target = this.boundObject(track);
      const property = this.properties(track).find(property => property.path === track.definition.path && resolvePropertyTarget(property.target, property.materialIndex) === target);

      if (property) {
        for (const channel of section.channels) {
          channel.minimum = property.minimum; channel.maximum = property.maximum; channel.integer = property.integer; channel.referenceType = property.referenceType;
        }
      }
    }

    this.recordChannelState(section);

    return section;
  }

  private channelSignature (section: SequenceSection, group: string): string {
    return JSON.stringify(section.channels.filter(channel => channel.group === group).map(channel => channel.keys.map(key => ({
      time: key.time, value: key.value, inSlope: key.inSlope, outSlope: key.outSlope, inWeight: key.inWeight,
      outWeight: key.outWeight, weightedMode: key.weightedMode, interpolationMode: key.interpolationMode,
    }))));
  }

  private recordChannelState (section: SequenceSection): void {
    for (const channel of section.channels) { section.channelState.set(channel.group, this.channelSignature(section, channel.group)); }
  }
}
