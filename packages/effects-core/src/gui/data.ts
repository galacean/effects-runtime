import type * as spec from '@galacean/effects-specification';

/** Common serialized properties shared by every GUI Control. */
export interface ControlData {
  anchorMin?: spec.vec2,
  anchorMax?: spec.vec2,
  offsetMin?: spec.vec2,
  offsetMax?: spec.vec2,
  pivot?: spec.vec2,
  scale?: spec.vec2,
  shear?: spec.vec2,
  rotation?: number,
  customMinimumSize?: spec.vec2,
  customMaximumSize?: spec.vec2,
  horizontalSizeFlags?: number,
  verticalSizeFlags?: number,
  stretchRatio?: number,
  horizontalGrowDirection?: number,
  verticalGrowDirection?: number,
  mouseFilter?: number,
  mouseBehaviorRecursive?: number,
  mouseForcePassScrollEvents?: boolean,
  focusMode?: number,
  focusBehaviorRecursive?: number,
  defaultCursorShape?: number | string,
  clipContents?: boolean,
}

export interface SerializedControlData<T extends ControlData = ControlData> {
  type: string,
  data: T,
}

export interface UIControlData<T extends ControlData = ControlData> extends spec.ComponentData {
  control: SerializedControlData<T>,
}

export interface RectData {
  position: spec.vec2,
  size: spec.vec2,
}
