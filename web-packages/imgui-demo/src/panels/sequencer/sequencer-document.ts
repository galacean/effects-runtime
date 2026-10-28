import {
  ActivationPlayableAsset, ActivationTrack, BezierCurve, Component, CompositionComponent, InterpolationMode,
  FloatPropertyPlayableAsset, ObjectBindingTrack, ObjectReferencePropertyPlayableAsset,
  SpriteColorPlayableAsset, SpriteColorTrack, TransformPlayableAsset, TransformTrack,
  VFXItem, REFERENCE_CURVE, createValueGetter, effectsClassStore, spec,
} from '@galacean/effects';
import type { Composition, EffectsObject, TimelineAsset, TimelineClip, TrackAsset } from '@galacean/effects';
import { decodeCurve, decodeSpatialCurve, encodeCurve, insertBoundary, makeKey, sampleCurve, trimKeys, updateAutoTangents } from './curve-data';
import type { SequenceKey } from './curve-data';
import { encodePositionPath } from './position-path';
import { findSequenceTimeline, sampleSequencePreview } from './sequencer-preview';
import { getEditorRotation } from '../../core/editor-transform';

type Payload = Record<string, unknown>;
type TransformData = TransformPlayableAsset['transformAnimationData'];

export interface SequenceChannel {
  id: string,
  group: string,
  label: string,
  keys: SequenceKey[],
  defaultValue: number,
  axis: number,
  kind: 'number' | 'reference',
  references?: Map<string, EffectsObject | null>,
}
export interface SequenceSection {
  clip: TimelineClip,
  track: TrackAsset,
  payload: Payload,
  channels: SequenceChannel[],
  channelState: Map<string, string>,
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
  channels: { channel: SequenceChannel, keys: SequenceKey[], references?: Map<string, EffectsObject | null> }[],
}
export interface SequenceSnapshot {
  roots: TrackAsset[],
  tracks: TrackSnapshot[],
  sections: SectionSnapshot[],
  locked: string[],
  transforms: { item: VFXItem, position: number[], rotation: number[], scale: number[] }[],
}
interface HistoryEntry { label: string, before: SequenceSnapshot, after: SequenceSnapshot }
interface KeyClipboard {
  offset: number,
  channel: string,
  track: string,
  key: SequenceKey,
  reference?: EffectsObject | null,
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
  readonly history: HistoryEntry[] = [];
  readonly redoHistory: HistoryEntry[] = [];
  private transaction?: { label: string, before: SequenceSnapshot, changed: boolean };
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
  }

  get tracks (): TrackAsset[] { return this.timeline.flattenedTracks; }
  get currentTime (): number { return this.component.getTime() - this.component.startTime; }
  get duration (): number { return Math.max(1 / 30, this.component.item.duration); }
  get canUndo (): boolean { return this.history.length > 0; }
  get canRedo (): boolean { return this.redoHistory.length > 0; }
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
    });
  }

  channelValue (section: SequenceSection, channel: SequenceChannel, time = this.currentTime): number {
    if (Math.abs(time - this.currentTime) < 1e-7) {
      const item = this.boundItem(section.track);

      if (item && section.clip instanceof TransformPlayableAsset) {
        const vector = channel.group === 'Location' ? item.transform.position : channel.group === 'Rotation' ? getEditorRotation(item.transform) : item.transform.scale;

        return vector.toArray()[channel.axis];
      }
      if (section.clip instanceof FloatPropertyPlayableAsset) {
        let node: TrackAsset | undefined = section.track;
        let target: unknown;

        while (node && !target) { target = this.component.getBinding(node); node = node.parent; }
        const path = section.track.definition.path as string | undefined;

        for (const name of path?.split('.') ?? []) {
          target = target && typeof target === 'object' ? (target as Record<string, unknown>)[name] : undefined;
        }
        if (typeof target === 'number') { return target; }
      }
    }

    return channel.keys.length ? sampleCurve(channel.keys, (time - section.clip.start) / section.clip.duration) : channel.defaultValue;
  }

  begin (label: string): void {
    if (!this.transaction) { this.transaction = { label, before: this.snapshot(), changed: false }; }
  }

  changed (): void {
    if (this.transaction) { this.transaction.changed = true; }
    this.revision++;
    sampleSequencePreview(this.component, this.timeline, this.muted);
    this.previewDirty = false;
  }

  commit (): void {
    const transaction = this.transaction;

    this.transaction = undefined;
    if (!transaction?.changed) { return; }
    this.history.push({ label: transaction.label, before: transaction.before, after: this.snapshot() });
    if (this.history.length > 100) { this.history.shift(); }
    this.redoHistory.length = 0;
  }

  cancel (): void {
    const before = this.transaction?.before;

    this.transaction = undefined;
    if (before) { this.restore(before); }
  }

  edit (label: string, action: () => void): void {
    this.begin(label);
    try { action(); this.changed(); this.commit(); } catch (error) { this.cancel(); throw error; }
  }

  undo (): void {
    this.commit();
    const entry = this.history.pop();

    if (entry) { this.restore(entry.before); this.redoHistory.push(entry); }
  }

  redo (): void {
    const entry = this.redoHistory.pop();

    if (entry) { this.restore(entry.after); this.history.push(entry); }
  }

  setTime (time: number): void {
    this.composition.pause();
    if (this.component === this.composition.sceneRoot.getComponent(CompositionComponent)) { this.composition.setTime(Math.max(0, time)); } else { this.component.setTime(Math.max(0, time) + this.component.startTime); }
  }

  clearSelection (): void {
    this.selectedTracks.clear(); this.selectedSections.clear(); this.selectedKeys.clear();
  }

  addBinding (item: VFXItem): ObjectBindingTrack {
    const existing = this.timeline.tracks.find(track => this.component.getBinding(track) === item);

    if (existing instanceof ObjectBindingTrack) { return existing; }
    const track = new ObjectBindingTrack(this.composition.engine);

    track.name = item.name;
    this.timeline.tracks.push(track);
    this.timeline.markAsChanged();
    this.component.setBinding(track, item);

    return track;
  }

  addTrack (parent: TrackAsset, kind: 'transform' | 'activation' | 'opacity'): TrackAsset | undefined {
    if (this.isLocked(parent)) { return; }
    let track: TrackAsset;

    if (kind === 'transform') { track = new TransformTrack(this.composition.engine); track.name = 'Transform'; } else if (kind === 'activation') { track = new ActivationTrack(this.composition.engine); track.name = 'Activation'; } else { track = new SpriteColorTrack(this.composition.engine); track.name = 'Opacity'; }
    parent.addChild(track);
    this.createSection(track, 0, this.duration);
    this.timeline.markAsChanged();

    return track;
  }

  createSection (track: TrackAsset, start = this.currentTime, duration = Math.min(1, this.duration)): SequenceSection | undefined {
    if (this.isLocked(track)) { return; }
    let clip: TimelineClip;

    if (track instanceof TransformTrack) {
      clip = track.createClip(TransformPlayableAsset, 'Transform');
      clip.fromData({ id: clip.getInstanceId() } as unknown as spec.EffectsObjectData);
    } else if (track instanceof ActivationTrack) {
      clip = track.createClip(ActivationPlayableAsset, 'Active');
    } else if (track instanceof SpriteColorTrack) {
      clip = track.createClip(SpriteColorPlayableAsset, 'Opacity');
      clip.fromData({ id: clip.getInstanceId(), colorOverLifetime: { opacity: 1 } } as unknown as spec.EffectsObjectData);
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

      if (changed('Location')) {
        const path = encodePositionPath(section.channels.filter(channel => channel.group === 'Location'));

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

    if (preserveCurve && channel.kind === 'number' && channel.keys.length) {
      insertBoundary(channel.keys, normalized);
      const key = channel.keys.find(item => Math.abs(item.time - normalized) < 1e-7);

      if (key) { this.selectedKeys.add(key.id); }
      this.write(section);

      return;
    }
    const existing = channel.keys.find(key => Math.abs(key.time - normalized) < 1e-7);
    const targetValue = value ?? this.channelValue(section, channel, time);

    if (existing) { existing.value = targetValue; this.selectedKeys.add(existing.id); } else {
      const key = makeKey(normalized, targetValue);

      if (channel.kind === 'reference') {
        channel.references?.set(key.id, channel.references.get(channel.keys.at(-1)?.id ?? '') ?? null);
      }
      channel.keys.push(key); this.selectedKeys.add(key.id);
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
          for (const channel of section.channels) { channel.keys = channel.keys.filter(key => !this.selectedKeys.has(key.id)); }
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
      channels: state.channels.map(({ channel, keys: sourceKeys, references: sourceReferences }) => {
        const references = new Map<string, EffectsObject | null>();
        const keys = sourceKeys.map(key => {
          const result = { ...key, id: makeKey(0, 0).id };

          references.set(result.id, sourceReferences?.get(key.id) ?? null);

          return result;
        });

        return { ...channel, id: clip.getInstanceId() + ':' + channel.group + '.' + channel.label, keys, references };
      }),
    };

    this.sections.set(clip, section); this.write(section);

    return section;
  }

  resizeSection (section: SequenceSection, start: number, end: number, stretch = false): void {
    if (this.isLocked(section.track)) { return; }
    const oldStart = section.clip.start, duration = section.clip.duration;

    if (!stretch && duration > 0) {
      for (const channel of section.channels) {
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

      this.keyClipboard = keys.map(({ section, channel, key }) => ({
        offset: section.clip.start + key.time * section.clip.duration - first,
        track: section.track.getInstanceId(), channel: channel.group + '.' + channel.label,
        key: { ...key }, reference: channel.references?.get(key.id),
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
          const channel = section.channels.find(item => item.group + '.' + item.label === entry.channel);

          if (!channel) { continue; }
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
      roots: [...this.timeline.tracks], locked: Array.from(this.locked),
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
      channels: section.channels.map(channel => ({ channel, keys: channel.keys.map(key => ({ ...key })), references: channel.references ? new Map(channel.references) : undefined })),
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
    for (const track of this.tracks) { this.component.clearBinding(track); }
    this.timeline.tracks.splice(0, this.timeline.tracks.length, ...snapshot.roots);
    this.muted.clear();
    for (const state of snapshot.tracks) {
      state.track.name = state.name;
      if (state.muted) { this.muted.add(state.track.getInstanceId()); }
      state.track.getChildTracks().splice(0, state.track.getChildTracks().length, ...state.children);
      state.track.getClips().splice(0, state.track.getClips().length, ...state.clips);
      for (const child of state.children) { child.parent = state.track; }
    }
    this.locked.clear(); snapshot.locked.forEach(id => this.locked.add(id));
    this.timeline.markAsChanged();
    for (const state of snapshot.tracks) { if (state.binding) { this.component.setBinding(state.track, state.binding); } }
    for (const state of snapshot.sections) {
      const section = state.section;

      section.clip.start = state.start; section.clip.duration = state.duration;
      section.clip.endBehavior = state.endBehavior; section.clip.name = state.name; section.payload = copy(state.payload); section.channelState = new Map(state.channelState);
      for (const channel of state.channels) {
        channel.channel.keys = channel.keys.map(key => ({ ...key }));
        channel.channel.references = channel.references ? new Map(channel.references) : undefined;
      }
      this.write(section);
    }
    for (const { item, position, rotation, scale } of snapshot.transforms) {
      item.transform.setPosition(position[0], position[1], position[2]);
      item.transform.setRotation(rotation[0], rotation[1], rotation[2]);
      item.transform.setScale(scale[0], scale[1], scale[2]);
    }
    this.changed();
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

  private readSection (clip: TimelineClip, track: TrackAsset): SequenceSection {
    const payload = copy(clip instanceof TransformPlayableAsset ? clip.transformAnimationData ?? {} :
      clip instanceof SpriteColorPlayableAsset ? clip.data ?? {} : clip.definition ?? {}) as Payload;
    const section: SequenceSection = { clip, track, payload, channels: [], channelState: new Map() };
    const item = this.boundItem(track);
    const add = (group: string, label: string, axis: number, expression: spec.FixedNumberExpression | undefined, fallback: number) => {
      const channel: SequenceChannel = {
        id: clip.getInstanceId() + ':' + group + '.' + label, group, label, axis,
        keys: decodeCurve(expression, fallback), defaultValue: fallback, kind: 'number',
      };

      section.channels.push(channel);

      return channel;
    };

    if (clip instanceof TransformPlayableAsset) {
      const data = clip.transformAnimationData;
      const path = data?.positionOverLifetime?.path;
      const defaults = item?.transform.position.toArray() ?? [0, 0, 0];

      for (let axis = 0; axis < 3; axis++) {
        const channel = add('Location', ['X', 'Y', 'Z'][axis], axis, undefined, defaults[axis]);

        if (path && Array.isArray(path) && path[0] === spec.ValueType.CONSTANT_VEC3) {
          channel.keys = [makeKey(0, path[1][axis])];
        } else if (path?.[0] === spec.ValueType.LINEAR_PATH && path[1][0].every(key => key[2] === 1 && key[3] === 1)) {
          channel.keys = path[1][0].map((key, index) => ({
            ...makeKey(key[0], path[1][1][index][axis]), interpolationMode: InterpolationMode.Linear, tangentMode: 'break',
          }));
        } else if (path) {
          const getter = createValueGetter(path);
          const knots = Array.isArray(path) && path[0] === spec.ValueType.BEZIER_CURVE_PATH
            ? decodeCurve([spec.ValueType.BEZIER_CURVE, path[1][0]]).map(key => key.time) :
            path[0] === spec.ValueType.LINEAR_PATH ? path[1][0].map(key => key[0]) : [0, 1];

          channel.keys = decodeSpatialCurve(time => {
            const point = getter.getValue(time);

            return Array.isArray(point) ? point[axis] : point[['x', 'y', 'z'][axis] as 'x' | 'y' | 'z'];
          }, knots);
        }
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
      const channel = add('Value', 'Value', 0, undefined, clip.curve?.getValue(0) ?? 0);

      channel.keys = clip.curve instanceof BezierCurve ? clip.curve.getKeyFrames().map(key => ({ ...key, id: makeKey(0, 0).id, tangentMode: 'user' })) : [makeKey(0, channel.defaultValue)];
    } else if (clip instanceof ObjectReferencePropertyPlayableAsset) {
      const channel = add('Sprite', 'Reference', 0, undefined, 0);

      channel.kind = 'reference'; channel.references = new Map();
      channel.keys = clip.curve.keyframes.map(([time, value]) => {
        const key = makeKey(time, 0);

        channel.references!.set(key.id, value);

        return key;
      });
    }

    this.recordChannelState(section);

    return section;
  }

  private channelSignature (section: SequenceSection, group: string): string {
    return JSON.stringify(section.channels.filter(channel => channel.group === group).map(channel => channel.keys.map(key => ({
      time: key.time, value: key.value, inSlope: key.inSlope, outSlope: key.outSlope, inWeight: key.inWeight,
      outWeight: key.outWeight, interpolationMode: key.interpolationMode,
    }))));
  }

  private recordChannelState (section: SequenceSection): void {
    for (const channel of section.channels) { section.channelState.set(channel.group, this.channelSignature(section, channel.group)); }
  }
}
