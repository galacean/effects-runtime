import { BezierCurve, InterpolationMode } from '@galacean/effects';
import type { ImGui } from '../../platform/imgui';
import type { CurveKey, CurveModel, CurvePoint } from '../../ui/curve-editor/curve-model';
import { controlPoint } from './curve-data';
import type { KeySelection, SequenceChannel, SequenceSection, SequencerDocument } from './sequencer-document';

export class SequencerCurveModel implements CurveModel {
  private revision = -1;
  private curve = new BezierCurve([]);

  constructor (readonly document: SequencerDocument, readonly section: SequenceSection, readonly channel: SequenceChannel, readonly color: ImGui.Vec4) { }

  get id (): string { return this.channel.id; }
  get label (): string { return this.channel.group + '.' + this.channel.label; }
  get readOnly (): boolean { return this.document.isLocked(this.section.track); }

  keys (): CurveKey[] {
    return this.channel.keys.map((key, index) => {
      const handles: CurveKey['handles'] = {};

      if (this.channel.pathView !== 'point' && key.interpolationMode === InterpolationMode.Cubic) {
        for (const side of ['in', 'out'] as const) {
          if (side === 'in' && index === 0 || side === 'out' && index + 1 === this.channel.keys.length) { continue; }
          const point = controlPoint(this.channel.keys, index, side);

          handles[side] = { time: this.section.clip.start + point.time * this.section.clip.duration, value: point.value };
        }
      }

      return { id: key.id, time: this.section.clip.start + key.time * this.section.clip.duration, value: key.value, handles };
    });
  }

  evaluate (time: number): number {
    if (this.channel.pathView && this.section.position) {
      return this.section.position.evaluate((time - this.section.clip.start) / this.section.clip.duration, this.channel.axis);
    }
    if (this.revision !== this.document.revision) { this.curve.setKeyFrames(this.channel.keys); this.revision = this.document.revision; }

    return this.curve.getValue((time - this.section.clip.start) / this.section.clip.duration);
  }

  resolve (id: string): KeySelection | undefined {
    const key = this.channel.keys.find(key => key.id === id);

    return key ? { section: this.section, channel: this.channel, key } : undefined;
  }

  setKeyPosition (id: string, position: CurvePoint): void {
    const key = this.channel.keys.find(key => key.id === id);

    if (!key || this.readOnly) { return; }
    key.time = (position.time - this.section.clip.start) / this.section.clip.duration;
    if (this.channel.pathView !== 'timing') { key.value = position.value; }
  }
}
