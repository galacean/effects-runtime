import type {
  ControlData,
  RectData,
  spec,
} from '@galacean/effects';
import type {
  AspectRatioStretchMode,
  LayoutAlignment,
} from './layout/enums';
import type { ScrollMode } from './scroll/enums';
import type {
  AutowrapMode,
  AxisStretchMode,
  ButtonActionMode,
  HorizontalAlignment,
  ProgressFillMode,
  TextOverflow,
  TextureExpandMode,
  TextureStretchMode,
  VerticalAlignment,
} from './controls/enums';

export interface BoxContainerData extends ControlData {
  alignment?: LayoutAlignment,
  reverse?: boolean,
}

export interface GridContainerData extends ControlData {
  columns?: number,
}

export interface MarginContainerData extends ControlData {}

export interface CenterContainerData extends ControlData {
  useTopLeft?: boolean,
}

export interface AspectRatioContainerData extends ControlData {
  ratio?: number,
  stretchMode?: AspectRatioStretchMode,
  horizontalAlignment?: LayoutAlignment,
  verticalAlignment?: LayoutAlignment,
}

export interface RangeData extends ControlData {
  minValue?: number,
  maxValue?: number,
  step?: number,
  page?: number,
  value?: number,
  exponentialRatio?: boolean,
  rounded?: boolean,
  allowGreater?: boolean,
  allowLesser?: boolean,
}

export interface ScrollBarData extends RangeData {
  customStep?: number,
}

export interface ScrollContainerData extends ControlData {
  hScroll?: number,
  vScroll?: number,
  horizontalScrollMode?: ScrollMode,
  verticalScrollMode?: ScrollMode,
  horizontalCustomStep?: number,
  verticalCustomStep?: number,
  scrollHorizontalByDefault?: boolean,
  deadzone?: number,
  followFocus?: boolean,
}

export interface LabelData extends ControlData {
  text?: string,
  horizontalAlignment?: HorizontalAlignment,
  verticalAlignment?: VerticalAlignment,
  autowrapMode?: AutowrapMode,
  textOverflow?: TextOverflow,
}

export interface TextureRectData extends ControlData {
  texture?: spec.DataPath | null,
  expandMode?: TextureExpandMode,
  stretchMode?: TextureStretchMode,
  flipH?: boolean,
  flipV?: boolean,
  tint?: spec.ColorData,
}

export interface NinePatchRectData extends ControlData {
  texture?: spec.DataPath | null,
  regionRect?: RectData,
  patchMarginLeft?: number,
  patchMarginTop?: number,
  patchMarginRight?: number,
  patchMarginBottom?: number,
  drawCenter?: boolean,
  horizontalAxisStretchMode?: AxisStretchMode,
  verticalAxisStretchMode?: AxisStretchMode,
  tint?: spec.ColorData,
}

export interface ColorRectData extends ControlData {
  color?: spec.ColorData,
}

export interface PanelData extends ControlData {}

export interface BaseButtonData extends ControlData {
  disabled?: boolean,
  toggleMode?: boolean,
  buttonPressed?: boolean,
  buttonMask?: number,
  actionMode?: ButtonActionMode,
  keepPressedOutside?: boolean,
}

export interface ButtonData extends BaseButtonData {
  text?: string,
  icon?: spec.DataPath | null,
  flat?: boolean,
  clipText?: boolean,
  expandIcon?: boolean,
  textAlignment?: HorizontalAlignment,
  iconAlignment?: HorizontalAlignment,
  iconVerticalAlignment?: VerticalAlignment,
}

export interface CheckBoxData extends ButtonData {}

export interface CheckButtonData extends ButtonData {}

export interface SliderData extends RangeData {
  editable?: boolean,
  scrollable?: boolean,
}

export interface ProgressBarData extends RangeData {
  showPercentage?: boolean,
  fillMode?: ProgressFillMode,
}
