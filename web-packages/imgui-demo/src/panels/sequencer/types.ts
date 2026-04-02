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

export type CurveSegmentData = {
  startTime: number,
  startValue: number,
  endTime: number,
  endValue: number,
  cp1: { x: number, y: number },
  cp2: { x: number, y: number },
  interpolation: 'bezier' | 'linear' | 'constant',
};

export type CurveChannelData = {
  label: string,
  keyframes: KeyframeData[],
  segments: CurveSegmentData[],
  color: ImGui.Vec4,
  valueMin: number,
  valueMax: number,
};

export type CurvePropertyGroup = {
  name: string,
  channels: CurveChannelData[],
  clipStart: number,
  clipDuration: number,
};

export type CurveCanvasChannel = {
  id: string,
  trackId: string,
  groupName: string,
  channelLabel: string,
  channelData: CurveChannelData,
  clipStart: number,
  clipDuration: number,
};
