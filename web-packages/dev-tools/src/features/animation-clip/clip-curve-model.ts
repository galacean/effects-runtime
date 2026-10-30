import type { ImGui } from '../../platform/imgui';
import type { CurveKey, CurveModel } from '../../ui/curve-editor/curve-model';

export interface ClipCurveChannel { label: string, color: ImGui.Vec4, sample(time: number): number, keyframeTimes: number[] }
let nextChannelId = 0;

export class ClipCurveModel implements CurveModel {
  readonly id = 'clip-curve-' + nextChannelId++;
  readonly readOnly = true;

  constructor (private readonly channel: ClipCurveChannel) { }

  get label (): string { return this.channel.label; }
  get color (): ImGui.Vec4 { return this.channel.color; }
  evaluate (time: number): number { return this.channel.sample(time); }
  keys (): CurveKey[] { return this.channel.keyframeTimes.map((time, index) => ({ id: this.id + ':' + index, time, value: this.evaluate(time) })); }
}
