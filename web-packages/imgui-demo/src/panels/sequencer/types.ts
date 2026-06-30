import type { ImGui } from '../../imgui';
import type { Sprite } from '@galacean/effects';

export type KeyframeData = {
  time: number,
  value: number,
};

/**
 * Sprite 对象引用关键帧：time 为归一化 0-1（相对 clip），sprite 为运行时 Sprite 资产实例。
 */
export type SpriteKeyframeData = {
  time: number,
  sprite: Sprite,
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
