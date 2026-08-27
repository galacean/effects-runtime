import type {
  ControlData,
  FontStyle,
  FontWeight,
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
  separation?: number,
  reverse?: boolean,
}

export interface GridContainerData extends ControlData {
  columns?: number,
  horizontalSeparation?: number,
  verticalSeparation?: number,
}

export interface MarginContainerData extends ControlData {
  marginLeft?: number,
  marginTop?: number,
  marginRight?: number,
  marginBottom?: number,
}

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
  trackColor?: spec.ColorData,
  buttonColor?: spec.ColorData,
  buttonActiveColor?: spec.ColorData,
  grabberColor?: spec.ColorData,
  grabberHoverColor?: spec.ColorData,
  grabberPressedColor?: spec.ColorData,
  arrowColor?: spec.ColorData,
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
  fontFamily?: string,
  fontSize?: number,
  fontWeight?: FontWeight,
  fontStyle?: FontStyle,
  lineSpacing?: number,
  horizontalAlignment?: HorizontalAlignment,
  verticalAlignment?: VerticalAlignment,
  autowrapMode?: AutowrapMode,
  textOverflow?: TextOverflow,
  textColor?: spec.ColorData,
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

export interface PanelData extends ControlData {
  backgroundColor?: spec.ColorData,
  borderColor?: spec.ColorData,
  borderWidth?: number,
}

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
  fontFamily?: string,
  fontSize?: number,
  fontWeight?: FontWeight,
  fontStyle?: FontStyle,
  flat?: boolean,
  clipText?: boolean,
  expandIcon?: boolean,
  textAlignment?: HorizontalAlignment,
  iconAlignment?: HorizontalAlignment,
  iconVerticalAlignment?: VerticalAlignment,
  horizontalPadding?: number,
  verticalPadding?: number,
  iconSeparation?: number,
  borderWidth?: number,
  textColor?: spec.ColorData,
  disabledTextColor?: spec.ColorData,
  normalColor?: spec.ColorData,
  hoverColor?: spec.ColorData,
  pressedColor?: spec.ColorData,
  disabledColor?: spec.ColorData,
  borderColor?: spec.ColorData,
}

export interface CheckBoxData extends ButtonData {
  markColor?: spec.ColorData,
}

export interface CheckButtonData extends ButtonData {
  switchColor?: spec.ColorData,
}

export interface SliderData extends RangeData {
  editable?: boolean,
  scrollable?: boolean,
  trackColor?: spec.ColorData,
  fillColor?: spec.ColorData,
  grabberColor?: spec.ColorData,
  grabberHighlightedColor?: spec.ColorData,
  grabberDisabledColor?: spec.ColorData,
}

export interface ProgressBarData extends RangeData {
  showPercentage?: boolean,
  fillMode?: ProgressFillMode,
  fontFamily?: string,
  fontSize?: number,
  fontWeight?: FontWeight,
  fontStyle?: FontStyle,
  backgroundColor?: spec.ColorData,
  fillColor?: spec.ColorData,
  textColor?: spec.ColorData,
}
