import { ObjectBindingTrack, TransformTrack } from '@galacean/effects';
import type { TrackAsset } from '@galacean/effects';
import type { SequenceChannel, SequenceSection, SequencerDocument } from './sequencer-document';
import { controlPoint } from './curve-data';
import { SEQUENCE_LAYOUT as L } from './sequencer-style';

export interface SequenceRow {
  id: string,
  label: string,
  kind: 'object' | 'track' | 'group' | 'channel',
  depth: number,
  track: TrackAsset,
  expandable: boolean,
  channels: { section: SequenceSection, channel: SequenceChannel }[],
  top: number,
  height: number,
}
export class SequencerState {
  frameRate = 30;
  displayFrames = true;
  snapping = true;
  snapFrames = true;
  snapKeys = true;
  snapSections = true;
  loop = true;
  curveMode = false;
  showTangents = true;
  showDetails = false;
  jumpFrames = 5;
  viewStart = 0;
  viewEnd = 5;
  playbackStart = 0;
  playbackEnd = 5;
  outlinerWidth = 320;
  scrollY = 0;
  curveMin = -1;
  curveMax = 1;
  search = '';
  activeChannel = '';
  readonly expanded = new Set<string>();
  private readonly initialized = new Set<string>();

  initialize (document: SequencerDocument): void {
    this.viewStart = -document.duration * 0.03;
    this.viewEnd = document.duration * 1.07;
    this.playbackStart = 0; this.playbackEnd = document.duration;
    this.scrollY = 0; this.activeChannel = ''; this.search = '';
    this.expanded.clear(); this.initialized.clear();
  }

  rows (document: SequencerDocument): SequenceRow[] {
    const rows: SequenceRow[] = [];
    let top = 0;
    const append = (row: Omit<SequenceRow, 'top' | 'height'>) => {
      const height = row.kind === 'object' ? L.objectHeight : row.kind === 'track' ? L.trackHeight : row.kind === 'group' ? L.groupHeight : L.channelHeight;

      rows.push({ ...row, top, height }); top += height;
    };
    const query = this.search.trim().toLowerCase();
    const matches = (track: TrackAsset): boolean =>
      document.trackLabel(track).toLowerCase().includes(query) || track.getChildTracks().some(matches);
    const visit = (track: TrackAsset, depth: number) => {
      if (query && !matches(track)) { return; }
      const id = track.getInstanceId();
      const sections = track.getClips().map(clip => document.sections.get(clip)!).filter(Boolean);
      const channels = sections.flatMap(section => section.channels.map(channel => ({ section, channel })));
      const groups = Array.from(new Set(channels.map(entry => entry.channel.group)));
      const children = track.getChildTracks();

      if (!this.initialized.has(id)) {
        this.initialized.add(id);
        if (track instanceof ObjectBindingTrack) { this.expanded.add(id); }
      }
      append({ id, label: document.trackLabel(track), kind: track instanceof ObjectBindingTrack ? 'object' : 'track',
        depth, track, expandable: children.length + groups.length > 0, channels });
      if (!this.expanded.has(id) && !query) { return; }
      for (const group of groups) {
        const groupId = id + ':' + group;
        const groupChannels = channels.filter(entry => entry.channel.group === group);

        append({ id: groupId, label: group, kind: 'group', depth: depth + 1, track, expandable: true, channels: groupChannels });
        if (!this.expanded.has(groupId) && !query) { continue; }
        for (const label of Array.from(new Set(groupChannels.map(entry => entry.channel.label)))) {
          append({ id: groupId + '.' + label, label, kind: 'channel', depth: depth + 2, track, expandable: false,
            channels: groupChannels.filter(entry => entry.channel.label === label) });
        }
      }
      children.forEach(child => visit(child, depth + 1));
    };

    document.timeline.tracks.forEach(track => visit(track, 0));

    return rows;
  }

  snap (time: number, document: SequencerDocument, pixelsPerSecond: number, ignore = new Set<string>()): number {
    if (!this.snapping) { return time; }
    let value = this.snapFrames ? Math.round(time * this.frameRate) / this.frameRate : time;
    let distance = this.snapFrames ? Math.abs(value - time) * pixelsPerSecond : Infinity;
    const candidates = [document.currentTime, this.playbackStart, this.playbackEnd];

    for (const section of document.allSections()) {
      if (this.snapSections && !ignore.has(section.clip.getInstanceId())) { candidates.push(section.clip.start, section.clip.start + section.clip.duration); }
      if (this.snapKeys && !ignore.has(section.clip.getInstanceId())) {
        for (const channel of section.channels) {
          for (const key of channel.keys) {
            if (!ignore.has(key.id)) { candidates.push(section.clip.start + key.time * section.clip.duration); }
          }
        }
      }
    }
    for (const candidate of candidates) {
      const d = Math.abs(candidate - time) * pixelsPerSecond;

      if (d < 7 && (distance > 7 || d < distance)) { value = candidate; distance = d; }
    }

    return value;
  }

  formatTime (time: number): string {
    return this.displayFrames ? Math.round(time * this.frameRate).toString().padStart(4, '0') : time.toFixed(2) + ' s';
  }

  fit (document: SequencerDocument, selection = true): void {
    const selectedKeys = selection ? document.selectedKeyItems() : [];
    const sections = selection && document.selectedSectionItems.length ? document.selectedSectionItems : document.allSections();
    const curveKeys = this.curveMode ? this.curveChannels(document).flatMap(({ section, channel }) =>
      channel.keys.map(key => section.clip.start + key.time * section.clip.duration)) : [];
    const times = selectedKeys.length ? selectedKeys.map(item => item.section.clip.start + item.key.time * item.section.clip.duration) :
      curveKeys.length ? curveKeys : sections.flatMap(section => [section.clip.start, section.clip.start + section.clip.duration]);
    const min = times.length ? Math.min(...times) : this.playbackStart;
    const max = times.length ? Math.max(...times) : this.playbackEnd;
    const range = Math.max(1 / this.frameRate * 10, max - min);

    this.viewStart = min - range * 0.08; this.viewEnd = max + range * 0.08;
    this.fitValues(document, selection);
  }

  curveChannels (document: SequencerDocument): { section: SequenceSection, channel: SequenceChannel }[] {
    let channels = document.allSections().flatMap(section => section.channels.filter(channel => channel.kind === 'number' && channel.keys.length)
      .map(channel => ({ section, channel })));

    if (this.activeChannel) {
      const row = this.rows(document).find(row => row.id === this.activeChannel);

      if (row) { channels = channels.filter(entry => row.channels.some(item => item.channel === entry.channel)); }
    } else if (document.selectedTracks.size) {
      channels = channels.filter(entry => document.trackSelected(entry.section.track));
    }

    return channels;
  }

  fitValues (document: SequencerDocument, selection = false): void {
    let min = Infinity, max = -Infinity;
    const selected = selection ? document.selectedKeyItems() : [];

    for (const { key } of selected) {
      if (Number.isFinite(key.value)) { min = Math.min(min, key.value); max = Math.max(max, key.value); }
    }
    for (const { channel } of selected.length ? [] : this.curveChannels(document)) {
      channel.keys.forEach((key, index) => {
        for (const value of [key.value, controlPoint(channel.keys, index, 'in').value, controlPoint(channel.keys, index, 'out').value]) {
          if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
        }
      });
    }
    if (!Number.isFinite(max - min)) { min = -1; max = 1; }
    const range = Math.max(1, max - min, Math.abs(min) * 1e-6, Math.abs(max) * 1e-6);

    this.curveMin = Math.max(-Number.MAX_VALUE, min - range * 0.12);
    this.curveMax = Math.min(Number.MAX_VALUE, max + range * 0.12);
  }

  expandAll (document: SequencerDocument, expanded: boolean): void {
    if (!expanded) {
      this.expanded.clear();

      return;
    }
    for (const track of document.tracks) {
      this.expanded.add(track.getInstanceId());
      if (track instanceof TransformTrack) { ['Location', 'Rotation', 'Scale'].forEach(group => this.expanded.add(track.getInstanceId() + ':' + group)); }
    }
  }

  toggleSelectedExpansion (document: SequencerDocument, recursive: boolean): void {
    const rows = this.rows(document).filter(row => row.expandable && (this.activeChannel ? row.id === this.activeChannel :
      (row.kind === 'object' || row.kind === 'track') && document.selectedTracks.has(row.track.getInstanceId())));
    const expand = rows.some(row => !this.expanded.has(row.id));
    const apply = (id: string) => { if (expand) { this.expanded.add(id); } else { this.expanded.delete(id); } };

    for (const row of rows) {
      apply(row.id);
      if (!recursive) { continue; }
      for (const track of document.tracks) {
        let parent: TrackAsset | undefined = track;

        while (parent && parent !== row.track) { parent = parent.parent; }
        if (!parent) { continue; }
        if (row.kind === 'object' || row.kind === 'track') { apply(track.getInstanceId()); }
        for (const section of document.allSections().filter(item => item.track === track)) {
          section.channels.forEach(channel => {
            const id = track.getInstanceId() + ':' + channel.group;

            if (row.kind !== 'group' || id === row.id) { apply(id); }
          });
        }
      }
    }
  }
}
