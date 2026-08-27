import type { FontStyle, FontWeight, spec } from '@galacean/effects';

export interface ThemeFontData {
  family: string,
  weight?: FontWeight,
  style?: FontStyle,
}

export interface StyleBoxMarginsData {
  left?: number,
  top?: number,
  right?: number,
  bottom?: number,
}

export interface StyleBoxEmptyData {
  type: 'empty',
  contentMargins?: StyleBoxMarginsData,
}

export interface StyleBoxFlatData {
  type: 'flat',
  backgroundColor?: spec.ColorData,
  borderColor?: spec.ColorData,
  borderWidths?: StyleBoxMarginsData,
  contentMargins?: StyleBoxMarginsData,
}

export interface StyleBoxTextureData {
  type: 'texture',
  texture: spec.DataPath | null,
  sourceRect?: RectData,
  patchMargins?: StyleBoxMarginsData,
  contentMargins?: StyleBoxMarginsData,
  horizontalAxisStretchMode?: number,
  verticalAxisStretchMode?: number,
  drawCenter?: boolean,
  tint?: spec.ColorData,
}

export type StyleBoxData = StyleBoxEmptyData | StyleBoxFlatData | StyleBoxTextureData;

export interface ThemeItemCollectionData {
  colors?: Record<string, spec.ColorData>,
  constants?: Record<string, number>,
  fonts?: Record<string, ThemeFontData>,
  fontSizes?: Record<string, number>,
  icons?: Record<string, spec.DataPath | null>,
  styleBoxes?: Record<string, StyleBoxData>,
}

export interface ThemeData {
  types: Record<string, ThemeItemCollectionData>,
  variations?: Record<string, string>,
}

export interface ThemeOverridesData extends ThemeItemCollectionData {}

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
  themeTypeVariation?: string,
  themeOverrides?: ThemeOverridesData,
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
