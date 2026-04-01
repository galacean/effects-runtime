import type { ImGui } from '../../imgui';

export type KeyframeData = {
  time: number,
  value: number,
};

export type TransformPropertyChannel = {
  label: string,
  keyframes: KeyframeData[],
  color: ImGui.Vec4,
};

export type TransformPropertyGroup = {
  name: string,
  channels: TransformPropertyChannel[],
  clipStart: number,
  clipDuration: number,
};

export type SelectedKeyframeInfo = {
  trackId: string,
  channel: string,
  index: number,
  data: KeyframeData,
  clipStart: number,
  clipDuration: number,
};
