import {
  FocusBehaviorRecursive,
  FocusMode,
  GrowDirection,
  MouseButtonMask,
  MouseFilter,
  SizeFlags,
} from '@galacean/effects';
import type {
  Control,
  Texture,
  CursorShape,
  math,
} from '@galacean/effects';
import type {
  AspectRatioContainer,
  BaseButton,
  BoxContainer,
  Button,
  CenterContainer,
  ColorRect,
  GridContainer,
  Label,
  MarginContainer,
  NinePatchRect,
  ProgressBar,
  Range,
  ScrollBar,
  ScrollContainer,
  Slider,
  TextureRect,
} from '@galacean/effects-plugin-gui';
import {
  AspectRatioStretchMode,
  AutowrapMode,
  ButtonActionMode,
  ButtonGroup,
  HorizontalAlignment,
  LayoutAlignment,
  ProgressFillMode,
  ScrollMode,
  Side,
  TextureExpandMode,
  TextureStretchMode,
  TextOverflow,
  VerticalAlignment,
  AxisStretchMode,
} from '@galacean/effects-plugin-gui';
import type { InspectorControlType } from '../state';

export type InspectorOption = {
  label: string,
  value: number | string,
};

type PropertyBase = {
  group: string,
  name: string,
};

export type InspectorProperty = PropertyBase & (
  | {
    kind: 'boolean',
    getValue(control: Control): boolean,
    setValue(control: Control, value: boolean): void,
  }
  | {
    kind: 'number',
    min?: number,
    max?: number,
    step?: number,
    suffix?: string,
    getValue(control: Control): number,
    setValue(control: Control, value: number): void,
  }
  | {
    kind: 'vector2',
    min?: number,
    max?: number,
    step?: number,
    suffix?: string,
    getValue(control: Control): [number, number],
    setValue(control: Control, value: [number, number]): void,
  }
  | {
    kind: 'rect2',
    sizeMin?: number,
    max?: number,
    step?: number,
    suffix?: string,
    getValue(control: Control): [number, number, number, number],
    setValue(control: Control, value: [number, number, number, number]): void,
  }
  | {
    kind: 'enum',
    options: InspectorOption[],
    getValue(control: Control): number | string,
    setValue(control: Control, value: number | string): void,
  }
  | {
    kind: 'flags',
    options: InspectorOption[],
    getValue(control: Control): number,
    setValue(control: Control, value: number): void,
  }
  | {
    kind: 'text',
    multiline?: boolean,
    getValue(control: Control): string,
    setValue(control: Control, value: string): void,
  }
  | {
    kind: 'color',
    getValue(control: Control): math.Color,
    setValue(control: Control, value: math.Color): void,
  }
);

export type InspectorControlOption = {
  type: InspectorControlType,
  title: string,
  group: string,
  description: string,
};

export const INSPECTOR_CONTROL_OPTIONS: InspectorControlOption[] = [
  { type: 'Button', title: 'Button', group: 'Buttons', description: 'Text button with BaseButton interaction behavior.' },
  { type: 'CheckBox', title: 'CheckBox', group: 'Buttons', description: 'Checkbox using the Button and BaseButton property set.' },
  { type: 'CheckButton', title: 'CheckButton', group: 'Buttons', description: 'Switch-style toggle using the Button property set.' },
  { type: 'Label', title: 'Label', group: 'Display', description: 'Text layout, wrapping, alignment and theme overrides.' },
  { type: 'TextureRect', title: 'TextureRect', group: 'Display', description: 'Texture sizing and stretch behavior.' },
  { type: 'NinePatchRect', title: 'NinePatchRect', group: 'Display', description: 'Nine-patch margins and per-axis repeat behavior.' },
  { type: 'ColorRect', title: 'ColorRect', group: 'Display', description: 'A solid color rectangle.' },
  { type: 'Panel', title: 'Panel', group: 'Display', description: 'Panel geometry; visual appearance comes from its theme style.' },
  { type: 'HSlider', title: 'HSlider', group: 'Range', description: 'Horizontal Slider backed by the shared Range model.' },
  { type: 'VSlider', title: 'VSlider', group: 'Range', description: 'Vertical Slider backed by the shared Range model.' },
  { type: 'ProgressBar', title: 'ProgressBar', group: 'Range', description: 'Range visualization with percentage and fill direction.' },
  { type: 'HScrollBar', title: 'HScrollBar', group: 'Range', description: 'Horizontal ScrollBar with page and custom step.' },
  { type: 'VScrollBar', title: 'VScrollBar', group: 'Range', description: 'Vertical ScrollBar with page and custom step.' },
  { type: 'HBoxContainer', title: 'HBoxContainer', group: 'Containers', description: 'Arranges children horizontally.' },
  { type: 'VBoxContainer', title: 'VBoxContainer', group: 'Containers', description: 'Arranges children vertically.' },
  { type: 'GridContainer', title: 'GridContainer', group: 'Containers', description: 'Arranges children in a fixed column grid.' },
  { type: 'MarginContainer', title: 'MarginContainer', group: 'Containers', description: 'Applies theme margins around its children.' },
  { type: 'CenterContainer', title: 'CenterContainer', group: 'Containers', description: 'Centers children using their desired size.' },
  { type: 'AspectRatioContainer', title: 'AspectRatioContainer', group: 'Containers', description: 'Fits children to a configured aspect ratio.' },
  { type: 'ScrollContainer', title: 'ScrollContainer', group: 'Containers', description: 'Clipped scrolling viewport with automatic scrollbars.' },
];

const customMinimumSizes = new WeakMap<Control, [number, number]>();
const customMaximumSizes = new WeakMap<Control, [number, number]>();

const horizontalAlignments: InspectorOption[] = [
  { label: 'Left', value: HorizontalAlignment.Left },
  { label: 'Center', value: HorizontalAlignment.Center },
  { label: 'Right', value: HorizontalAlignment.Right },
  { label: 'Fill', value: HorizontalAlignment.Fill },
];
const buttonAlignments = horizontalAlignments.slice(0, 3);
const verticalAlignments: InspectorOption[] = [
  { label: 'Top', value: VerticalAlignment.Top },
  { label: 'Center', value: VerticalAlignment.Center },
  { label: 'Bottom', value: VerticalAlignment.Bottom },
  { label: 'Fill', value: VerticalAlignment.Fill },
];
const buttonVerticalAlignments = verticalAlignments.slice(0, 3);
const layoutAlignments: InspectorOption[] = [
  { label: 'Begin', value: LayoutAlignment.Begin },
  { label: 'Center', value: LayoutAlignment.Center },
  { label: 'End', value: LayoutAlignment.End },
];
const stretchModes: InspectorOption[] = [
  { label: 'Stretch', value: AxisStretchMode.Stretch },
  { label: 'Tile', value: AxisStretchMode.Tile },
  { label: 'Tile Fit', value: AxisStretchMode.TileFit },
];

export function createInspectorProperties (type: InspectorControlType, texture: Texture): InspectorProperty[] {
  const properties: InspectorProperty[] = [];

  switch (type) {
    case 'Button':
    case 'CheckBox':
    case 'CheckButton':
      properties.push(...buttonProperties(texture), ...baseButtonProperties());

      break;
    case 'Label':
      properties.push(...labelProperties());

      break;
    case 'TextureRect':
      properties.push(...textureRectProperties(texture));

      break;
    case 'NinePatchRect':
      properties.push(...ninePatchProperties(texture));

      break;
    case 'ColorRect':
      properties.push({
        group: 'ColorRect', name: 'color', kind: 'color',
        getValue: control => (control as ColorRect).color,
        setValue: (control, value) => (control as ColorRect).color.copyFrom(value),
      });

      break;
    case 'HSlider':
    case 'VSlider':
      properties.push(...sliderProperties(), ...rangeProperties());

      break;
    case 'ProgressBar':
      properties.push(...progressBarProperties(), ...rangeProperties());

      break;
    case 'HScrollBar':
    case 'VScrollBar':
      properties.push(...scrollBarProperties(), ...rangeProperties());

      break;
    case 'HBoxContainer':
    case 'VBoxContainer':
      properties.push(...boxContainerProperties());

      break;
    case 'GridContainer':
      properties.push(...gridContainerProperties());

      break;
    case 'MarginContainer':
      properties.push(...marginContainerProperties());

      break;
    case 'CenterContainer':
      properties.push({
        group: 'CenterContainer', name: 'use_top_left', kind: 'boolean',
        getValue: control => (control as CenterContainer).useTopLeft,
        setValue: (control, value) => { (control as CenterContainer).useTopLeft = value; },
      });

      break;
    case 'AspectRatioContainer':
      properties.push(...aspectRatioProperties());

      break;
    case 'ScrollContainer':
      properties.push(...scrollContainerProperties());

      break;
  }

  return [...properties, ...controlProperties()];
}

function controlProperties (): InspectorProperty[] {
  return [
    {
      group: 'Layout', name: 'custom_minimum_size', kind: 'vector2', min: 0, step: 1, suffix: 'px',
      getValue: control => customMinimumSizes.get(control) ?? [0, 0],
      setValue: (control, value) => {
        customMinimumSizes.set(control, value);
        control.setCustomMinimumSize(value[0], value[1]);
      },
    },
    {
      group: 'Layout', name: 'custom_maximum_size', kind: 'vector2', min: -1, step: 1, suffix: 'px',
      getValue: control => customMaximumSizes.get(control) ?? [-1, -1],
      setValue: (control, value) => {
        customMaximumSizes.set(control, value);
        control.setCustomMaximumSize(value[0], value[1]);
      },
    },
    {
      group: 'Layout', name: 'clip_contents', kind: 'boolean',
      getValue: control => control.clipContents,
      setValue: (control, value) => { control.clipContents = value; },
    },
    {
      group: 'Layout / Anchor Points', name: 'anchor_left', kind: 'number', min: 0, max: 1, step: 0.001,
      getValue: control => control.anchorMin.x,
      setValue: (control, value) => control.setAnchorMin(value, control.anchorMin.y),
    },
    {
      group: 'Layout / Anchor Points', name: 'anchor_top', kind: 'number', min: 0, max: 1, step: 0.001,
      getValue: control => control.anchorMin.y,
      setValue: (control, value) => control.setAnchorMin(control.anchorMin.x, value),
    },
    {
      group: 'Layout / Anchor Points', name: 'anchor_right', kind: 'number', min: 0, max: 1, step: 0.001,
      getValue: control => control.anchorMax.x,
      setValue: (control, value) => control.setAnchorMax(value, control.anchorMax.y),
    },
    {
      group: 'Layout / Anchor Points', name: 'anchor_bottom', kind: 'number', min: 0, max: 1, step: 0.001,
      getValue: control => control.anchorMax.y,
      setValue: (control, value) => control.setAnchorMax(control.anchorMax.x, value),
    },
    {
      group: 'Layout / Anchor Offsets', name: 'offset_left', kind: 'number', min: -4096, max: 4096, step: 1, suffix: 'px',
      getValue: control => control.offsetMin.x,
      setValue: (control, value) => control.setOffsetMin(value, control.offsetMin.y),
    },
    {
      group: 'Layout / Anchor Offsets', name: 'offset_top', kind: 'number', min: -4096, max: 4096, step: 1, suffix: 'px',
      getValue: control => control.offsetMin.y,
      setValue: (control, value) => control.setOffsetMin(control.offsetMin.x, value),
    },
    {
      group: 'Layout / Anchor Offsets', name: 'offset_right', kind: 'number', min: -4096, max: 4096, step: 1, suffix: 'px',
      getValue: control => control.offsetMax.x,
      setValue: (control, value) => control.setOffsetMax(value, control.offsetMax.y),
    },
    {
      group: 'Layout / Anchor Offsets', name: 'offset_bottom', kind: 'number', min: -4096, max: 4096, step: 1, suffix: 'px',
      getValue: control => control.offsetMax.y,
      setValue: (control, value) => control.setOffsetMax(control.offsetMax.x, value),
    },
    {
      group: 'Layout / Grow Direction', name: 'grow_horizontal', kind: 'enum',
      options: [
        { label: 'Left', value: GrowDirection.Begin },
        { label: 'Right', value: GrowDirection.End },
        { label: 'Both', value: GrowDirection.Both },
      ],
      getValue: control => control.horizontalGrowDirection,
      setValue: (control, value) => { control.horizontalGrowDirection = Number(value); },
    },
    {
      group: 'Layout / Grow Direction', name: 'grow_vertical', kind: 'enum',
      options: [
        { label: 'Top', value: GrowDirection.Begin },
        { label: 'Bottom', value: GrowDirection.End },
        { label: 'Both', value: GrowDirection.Both },
      ],
      getValue: control => control.verticalGrowDirection,
      setValue: (control, value) => { control.verticalGrowDirection = Number(value); },
    },
    {
      group: 'Layout / Transform', name: 'size', kind: 'vector2', min: 0, step: 1, suffix: 'px',
      getValue: control => [control.size.x, control.size.y],
      setValue: (control, value) => control.setSize(value[0], value[1]),
    },
    {
      group: 'Layout / Transform', name: 'position', kind: 'vector2', min: -4096, max: 4096, step: 1, suffix: 'px',
      getValue: control => [control.position.x, control.position.y],
      setValue: (control, value) => control.setPosition(value[0], value[1]),
    },
    {
      group: 'Layout / Transform', name: 'rotation', kind: 'number', min: -360, max: 360, step: 0.1, suffix: '°',
      getValue: control => control.rotation,
      setValue: (control, value) => control.setRotation(value),
    },
    {
      group: 'Layout / Transform', name: 'scale', kind: 'vector2', step: 0.01,
      getValue: control => [control.scale.x, control.scale.y],
      setValue: (control, value) => control.setScale(value[0], value[1]),
    },
    {
      group: 'Layout / Transform', name: 'pivot_offset_ratio', kind: 'vector2', step: 0.01,
      getValue: control => [control.pivot.x, control.pivot.y],
      setValue: (control, value) => control.setPivot(value[0], value[1]),
    },
    {
      group: 'Layout / Container Sizing', name: 'size_flags_horizontal', kind: 'flags',
      options: sizeFlagOptions(),
      getValue: control => control.horizontalSizeFlags,
      setValue: (control, value) => { control.horizontalSizeFlags = value; },
    },
    {
      group: 'Layout / Container Sizing', name: 'size_flags_vertical', kind: 'flags',
      options: sizeFlagOptions(),
      getValue: control => control.verticalSizeFlags,
      setValue: (control, value) => { control.verticalSizeFlags = value; },
    },
    {
      group: 'Layout / Container Sizing', name: 'size_flags_stretch_ratio', kind: 'number', min: 0.01, max: 20, step: 0.01,
      getValue: control => control.stretchRatio,
      setValue: (control, value) => { control.stretchRatio = value; },
    },
    {
      group: 'Focus', name: 'focus_mode', kind: 'enum',
      options: [
        { label: 'None', value: FocusMode.None },
        { label: 'Click', value: FocusMode.Click },
        { label: 'All', value: FocusMode.All },
        { label: 'Accessibility', value: FocusMode.Accessibility },
      ],
      getValue: control => control.focusMode,
      setValue: (control, value) => { control.focusMode = Number(value); },
    },
    {
      group: 'Focus', name: 'focus_behavior_recursive', kind: 'enum',
      options: recursiveOptions(),
      getValue: control => control.focusBehaviorRecursive,
      setValue: (control, value) => { control.focusBehaviorRecursive = Number(value); },
    },
    {
      group: 'Mouse', name: 'mouse_filter', kind: 'enum',
      options: [
        { label: 'Stop', value: MouseFilter.Stop },
        { label: 'Pass (Propagate Up)', value: MouseFilter.Pass },
        { label: 'Ignore', value: MouseFilter.Ignore },
      ],
      getValue: control => control.mouseFilter,
      setValue: (control, value) => { control.mouseFilter = Number(value); },
    },
    {
      group: 'Mouse', name: 'mouse_behavior_recursive', kind: 'enum',
      options: recursiveOptions(),
      getValue: control => control.mouseBehaviorRecursive,
      setValue: (control, value) => { control.mouseBehaviorRecursive = Number(value); },
    },
    {
      group: 'Mouse', name: 'mouse_force_pass_scroll_events', kind: 'boolean',
      getValue: control => control.mouseForcePassScrollEvents,
      setValue: (control, value) => { control.mouseForcePassScrollEvents = value; },
    },
    {
      group: 'Mouse', name: 'mouse_default_cursor_shape', kind: 'enum',
      options: cursorOptions(),
      getValue: control => control.defaultCursorShape as number | string,
      setValue: (control, value) => { control.defaultCursorShape = Number(value); },
    },
  ];
}

function labelProperties (): InspectorProperty[] {
  return [
    {
      group: 'Label', name: 'text', kind: 'text', multiline: true,
      getValue: control => (control as Label).text,
      setValue: (control, value) => { (control as Label).text = value; },
    },
    {
      group: 'Label', name: 'horizontal_alignment', kind: 'enum', options: horizontalAlignments,
      getValue: control => (control as Label).horizontalAlignment,
      setValue: (control, value) => { (control as Label).horizontalAlignment = Number(value); },
    },
    {
      group: 'Label', name: 'vertical_alignment', kind: 'enum', options: verticalAlignments,
      getValue: control => (control as Label).verticalAlignment,
      setValue: (control, value) => { (control as Label).verticalAlignment = Number(value); },
    },
    {
      group: 'Label', name: 'autowrap_mode', kind: 'enum',
      options: [
        { label: 'Off', value: AutowrapMode.Off },
        { label: 'Arbitrary', value: AutowrapMode.Arbitrary },
        { label: 'Word', value: AutowrapMode.Word },
        { label: 'Word (Smart)', value: AutowrapMode.WordSmart },
      ],
      getValue: control => (control as Label).autowrapMode,
      setValue: (control, value) => { (control as Label).autowrapMode = Number(value); },
    },
    {
      group: 'Label', name: 'clip_text', kind: 'boolean',
      getValue: control => (control as Label).textOverflow !== TextOverflow.Visible,
      setValue: (control, value) => {
        (control as Label).textOverflow = value ? TextOverflow.Clip : TextOverflow.Visible;
      },
    },
    {
      group: 'Theme Overrides / Colors', name: 'font_color', kind: 'color',
      getValue: control => (control as Label).textColor,
      setValue: (control, value) => (control as Label).textColor.copyFrom(value),
    },
    {
      group: 'Theme Overrides / Font Sizes', name: 'font_size', kind: 'number', min: 1, max: 256, step: 1, suffix: 'px',
      getValue: control => (control as Label).fontSize,
      setValue: (control, value) => { (control as Label).fontSize = value; },
    },
    {
      group: 'Theme Overrides / Constants', name: 'line_spacing', kind: 'number', min: -128, max: 256, step: 1, suffix: 'px',
      getValue: control => (control as Label).lineSpacing,
      setValue: (control, value) => { (control as Label).lineSpacing = value; },
    },
  ];
}

function buttonProperties (texture: Texture): InspectorProperty[] {
  return [
    {
      group: 'Button', name: 'text', kind: 'text',
      getValue: control => (control as Button).text,
      setValue: (control, value) => { (control as Button).text = value; },
    },
    {
      group: 'Button', name: 'icon', kind: 'enum',
      options: [{ label: '<empty>', value: 0 }, { label: 'DemoTexture', value: 1 }],
      getValue: control => (control as Button).icon ? 1 : 0,
      setValue: (control, value) => { (control as Button).icon = Number(value) === 1 ? texture : null; },
    },
    {
      group: 'Button', name: 'flat', kind: 'boolean',
      getValue: control => (control as Button).flat,
      setValue: (control, value) => { (control as Button).flat = value; },
    },
    {
      group: 'Button / Text Behavior', name: 'alignment', kind: 'enum', options: buttonAlignments,
      getValue: control => (control as Button).textAlignment,
      setValue: (control, value) => { (control as Button).textAlignment = Number(value); },
    },
    {
      group: 'Button / Text Behavior', name: 'clip_text', kind: 'boolean',
      getValue: control => (control as Button).clipText,
      setValue: (control, value) => { (control as Button).clipText = value; },
    },
    {
      group: 'Button / Icon Behavior', name: 'icon_alignment', kind: 'enum', options: buttonAlignments,
      getValue: control => (control as Button).iconAlignment,
      setValue: (control, value) => { (control as Button).iconAlignment = Number(value); },
    },
    {
      group: 'Button / Icon Behavior', name: 'vertical_icon_alignment', kind: 'enum', options: buttonVerticalAlignments,
      getValue: control => (control as Button).iconVerticalAlignment,
      setValue: (control, value) => { (control as Button).iconVerticalAlignment = Number(value); },
    },
    {
      group: 'Button / Icon Behavior', name: 'expand_icon', kind: 'boolean',
      getValue: control => (control as Button).expandIcon,
      setValue: (control, value) => { (control as Button).expandIcon = value; },
    },
    {
      group: 'Theme Overrides / Colors', name: 'font_color', kind: 'color',
      getValue: control => (control as Button).textColor,
      setValue: (control, value) => (control as Button).textColor.copyFrom(value),
    },
    {
      group: 'Theme Overrides / Colors', name: 'font_disabled_color', kind: 'color',
      getValue: control => (control as Button).disabledTextColor,
      setValue: (control, value) => (control as Button).disabledTextColor.copyFrom(value),
    },
    {
      group: 'Theme Overrides / Font Sizes', name: 'font_size', kind: 'number', min: 1, max: 256, step: 1, suffix: 'px',
      getValue: control => (control as Button).fontSize,
      setValue: (control, value) => { (control as Button).fontSize = value; },
    },
    {
      group: 'Theme Overrides / Constants', name: 'h_separation', kind: 'number', min: 0, max: 256, step: 1, suffix: 'px',
      getValue: control => (control as Button).iconSeparation,
      setValue: (control, value) => { (control as Button).iconSeparation = value; },
    },
  ];
}

function baseButtonProperties (): InspectorProperty[] {
  const group = new ButtonGroup();

  return [
    {
      group: 'BaseButton', name: 'disabled', kind: 'boolean',
      getValue: control => (control as BaseButton).disabled,
      setValue: (control, value) => { (control as BaseButton).disabled = value; },
    },
    {
      group: 'BaseButton', name: 'toggle_mode', kind: 'boolean',
      getValue: control => (control as BaseButton).toggleMode,
      setValue: (control, value) => { (control as BaseButton).toggleMode = value; },
    },
    {
      group: 'BaseButton', name: 'button_pressed', kind: 'boolean',
      getValue: control => (control as BaseButton).buttonPressed,
      setValue: (control, value) => { (control as BaseButton).buttonPressed = value; },
    },
    {
      group: 'BaseButton', name: 'action_mode', kind: 'enum',
      options: [
        { label: 'Button Press', value: ButtonActionMode.Press },
        { label: 'Button Release', value: ButtonActionMode.Release },
      ],
      getValue: control => (control as BaseButton).actionMode,
      setValue: (control, value) => { (control as BaseButton).actionMode = Number(value); },
    },
    {
      group: 'BaseButton', name: 'button_mask', kind: 'flags',
      options: [
        { label: 'Mouse Left', value: MouseButtonMask.Left },
        { label: 'Mouse Right', value: MouseButtonMask.Right },
        { label: 'Mouse Middle', value: MouseButtonMask.Middle },
      ],
      getValue: control => (control as BaseButton).buttonMask,
      setValue: (control, value) => { (control as BaseButton).buttonMask = value; },
    },
    {
      group: 'BaseButton', name: 'keep_pressed_outside', kind: 'boolean',
      getValue: control => (control as BaseButton).keepPressedOutside,
      setValue: (control, value) => { (control as BaseButton).keepPressedOutside = value; },
    },
    {
      group: 'BaseButton', name: 'button_group', kind: 'enum',
      options: [{ label: '<empty>', value: 0 }, { label: 'DemoButtonGroup', value: 1 }],
      getValue: control => (control as BaseButton).buttonGroup ? 1 : 0,
      setValue: (control, value) => { (control as BaseButton).buttonGroup = Number(value) === 1 ? group : null; },
    },
  ];
}

function textureRectProperties (texture: Texture): InspectorProperty[] {
  return [
    {
      group: 'TextureRect', name: 'texture', kind: 'enum',
      options: [{ label: '<empty>', value: 0 }, { label: 'DemoTexture', value: 1 }],
      getValue: control => (control as TextureRect).texture ? 1 : 0,
      setValue: (control, value) => { (control as TextureRect).texture = Number(value) === 1 ? texture : null; },
    },
    {
      group: 'TextureRect', name: 'expand_mode', kind: 'enum',
      options: [
        { label: 'Keep Size', value: TextureExpandMode.KeepSize },
        { label: 'Ignore Size', value: TextureExpandMode.IgnoreSize },
        { label: 'Fit Width', value: TextureExpandMode.FitWidth },
        { label: 'Fit Width Proportional', value: TextureExpandMode.FitWidthProportional },
        { label: 'Fit Height', value: TextureExpandMode.FitHeight },
        { label: 'Fit Height Proportional', value: TextureExpandMode.FitHeightProportional },
      ],
      getValue: control => (control as TextureRect).expandMode,
      setValue: (control, value) => { (control as TextureRect).expandMode = Number(value); },
    },
    {
      group: 'TextureRect', name: 'stretch_mode', kind: 'enum',
      options: [
        { label: 'Scale', value: TextureStretchMode.Scale },
        { label: 'Tile', value: TextureStretchMode.Tile },
        { label: 'Keep', value: TextureStretchMode.Keep },
        { label: 'Keep Centered', value: TextureStretchMode.KeepCentered },
        { label: 'Keep Aspect', value: TextureStretchMode.KeepAspect },
        { label: 'Keep Aspect Centered', value: TextureStretchMode.KeepAspectCentered },
        { label: 'Keep Aspect Covered', value: TextureStretchMode.KeepAspectCovered },
      ],
      getValue: control => (control as TextureRect).stretchMode,
      setValue: (control, value) => { (control as TextureRect).stretchMode = Number(value); },
    },
    {
      group: 'TextureRect', name: 'flip_h', kind: 'boolean',
      getValue: control => (control as TextureRect).flipH,
      setValue: (control, value) => { (control as TextureRect).flipH = value; },
    },
    {
      group: 'TextureRect', name: 'flip_v', kind: 'boolean',
      getValue: control => (control as TextureRect).flipV,
      setValue: (control, value) => { (control as TextureRect).flipV = value; },
    },
  ];
}

function ninePatchProperties (texture: Texture): InspectorProperty[] {
  const margin = (name: string, side: Side): InspectorProperty => ({
    group: 'NinePatchRect / Patch Margin', name, kind: 'number', min: 0, max: 16384, step: 1, suffix: 'px',
    getValue: control => (control as NinePatchRect).getPatchMargin(side),
    setValue: (control, value) => (control as NinePatchRect).setPatchMargin(side, value),
  });

  return [
    {
      group: 'NinePatchRect', name: 'texture', kind: 'enum',
      options: [{ label: '<empty>', value: 0 }, { label: 'DemoTexture', value: 1 }],
      getValue: control => (control as NinePatchRect).texture ? 1 : 0,
      setValue: (control, value) => { (control as NinePatchRect).texture = Number(value) === 1 ? texture : null; },
    },
    {
      group: 'NinePatchRect', name: 'draw_center', kind: 'boolean',
      getValue: control => (control as NinePatchRect).drawCenter,
      setValue: (control, value) => { (control as NinePatchRect).drawCenter = value; },
    },
    {
      group: 'NinePatchRect', name: 'region_rect', kind: 'rect2', sizeMin: 0, step: 1, suffix: 'px',
      getValue: control => {
        const region = (control as NinePatchRect).regionRect;

        return [region.position.x, region.position.y, region.size.x, region.size.y];
      },
      setValue: (control, value) => (control as NinePatchRect).setRegionRect(value[0], value[1], value[2], value[3]),
    },
    margin('patch_margin_left', Side.Left),
    margin('patch_margin_top', Side.Top),
    margin('patch_margin_right', Side.Right),
    margin('patch_margin_bottom', Side.Bottom),
    {
      group: 'NinePatchRect / Axis Stretch', name: 'axis_stretch_horizontal', kind: 'enum', options: stretchModes,
      getValue: control => (control as NinePatchRect).horizontalAxisStretchMode,
      setValue: (control, value) => { (control as NinePatchRect).horizontalAxisStretchMode = Number(value); },
    },
    {
      group: 'NinePatchRect / Axis Stretch', name: 'axis_stretch_vertical', kind: 'enum', options: stretchModes,
      getValue: control => (control as NinePatchRect).verticalAxisStretchMode,
      setValue: (control, value) => { (control as NinePatchRect).verticalAxisStretchMode = Number(value); },
    },
  ];
}

function rangeProperties (): InspectorProperty[] {
  return [
    {
      group: 'Range', name: 'min_value', kind: 'number', step: 0.01,
      getValue: control => (control as Range).minValue,
      setValue: (control, value) => { (control as Range).minValue = value; },
    },
    {
      group: 'Range', name: 'max_value', kind: 'number', step: 0.01,
      getValue: control => (control as Range).maxValue,
      setValue: (control, value) => { (control as Range).maxValue = value; },
    },
    {
      group: 'Range', name: 'step', kind: 'number', step: 0.01,
      getValue: control => (control as Range).step,
      setValue: (control, value) => { (control as Range).step = value; },
    },
    {
      group: 'Range', name: 'page', kind: 'number', step: 0.01,
      getValue: control => (control as Range).page,
      setValue: (control, value) => { (control as Range).page = value; },
    },
    {
      group: 'Range', name: 'value', kind: 'number', step: 0.01,
      getValue: control => (control as Range).value,
      setValue: (control, value) => { (control as Range).value = value; },
    },
    {
      group: 'Range', name: 'exp_edit', kind: 'boolean',
      getValue: control => (control as Range).exponentialRatio,
      setValue: (control, value) => { (control as Range).exponentialRatio = value; },
    },
    {
      group: 'Range', name: 'rounded', kind: 'boolean',
      getValue: control => (control as Range).rounded,
      setValue: (control, value) => { (control as Range).rounded = value; },
    },
    {
      group: 'Range', name: 'allow_greater', kind: 'boolean',
      getValue: control => (control as Range).allowGreater,
      setValue: (control, value) => { (control as Range).allowGreater = value; },
    },
    {
      group: 'Range', name: 'allow_lesser', kind: 'boolean',
      getValue: control => (control as Range).allowLesser,
      setValue: (control, value) => { (control as Range).allowLesser = value; },
    },
  ];
}

function sliderProperties (): InspectorProperty[] {
  return [
    {
      group: 'Slider', name: 'editable', kind: 'boolean',
      getValue: control => (control as Slider).editable,
      setValue: (control, value) => { (control as Slider).editable = value; },
    },
    {
      group: 'Slider', name: 'scrollable', kind: 'boolean',
      getValue: control => (control as Slider).scrollable,
      setValue: (control, value) => { (control as Slider).scrollable = value; },
    },
  ];
}

function progressBarProperties (): InspectorProperty[] {
  return [
    {
      group: 'ProgressBar', name: 'fill_mode', kind: 'enum',
      options: [
        { label: 'Begin to End', value: ProgressFillMode.BeginToEnd },
        { label: 'End to Begin', value: ProgressFillMode.EndToBegin },
        { label: 'Top to Bottom', value: ProgressFillMode.TopToBottom },
        { label: 'Bottom to Top', value: ProgressFillMode.BottomToTop },
      ],
      getValue: control => (control as ProgressBar).fillMode,
      setValue: (control, value) => { (control as ProgressBar).fillMode = Number(value); },
    },
    {
      group: 'ProgressBar', name: 'show_percentage', kind: 'boolean',
      getValue: control => (control as ProgressBar).showPercentage,
      setValue: (control, value) => { (control as ProgressBar).showPercentage = value; },
    },
    {
      group: 'Theme Overrides / Colors', name: 'font_color', kind: 'color',
      getValue: control => (control as ProgressBar).textColor,
      setValue: (control, value) => (control as ProgressBar).textColor.copyFrom(value),
    },
    {
      group: 'Theme Overrides / Font Sizes', name: 'font_size', kind: 'number', min: 1, max: 256, step: 1, suffix: 'px',
      getValue: control => (control as ProgressBar).fontSize,
      setValue: (control, value) => { (control as ProgressBar).fontSize = value; },
    },
  ];
}

function scrollBarProperties (): InspectorProperty[] {
  return [{
    group: 'ScrollBar', name: 'custom_step', kind: 'number', min: -1, max: 4096, step: 0.01, suffix: 'px',
    getValue: control => (control as ScrollBar).customStep,
    setValue: (control, value) => { (control as ScrollBar).customStep = value; },
  }];
}

function boxContainerProperties (): InspectorProperty[] {
  return [
    {
      group: 'BoxContainer', name: 'alignment', kind: 'enum', options: layoutAlignments,
      getValue: control => (control as BoxContainer).alignment,
      setValue: (control, value) => { (control as BoxContainer).alignment = Number(value); },
    },
    {
      group: 'Theme Overrides / Constants', name: 'separation', kind: 'number', min: -128, max: 1024, step: 1, suffix: 'px',
      getValue: control => (control as BoxContainer).separation,
      setValue: (control, value) => { (control as BoxContainer).separation = value; },
    },
  ];
}

function gridContainerProperties (): InspectorProperty[] {
  return [
    {
      group: 'GridContainer', name: 'columns', kind: 'number', min: 1, max: 1024, step: 1,
      getValue: control => (control as GridContainer).columns,
      setValue: (control, value) => { (control as GridContainer).columns = value; },
    },
    {
      group: 'Theme Overrides / Constants', name: 'h_separation', kind: 'number', min: -128, max: 1024, step: 1, suffix: 'px',
      getValue: control => (control as GridContainer).horizontalSeparation,
      setValue: (control, value) => { (control as GridContainer).horizontalSeparation = value; },
    },
    {
      group: 'Theme Overrides / Constants', name: 'v_separation', kind: 'number', min: -128, max: 1024, step: 1, suffix: 'px',
      getValue: control => (control as GridContainer).verticalSeparation,
      setValue: (control, value) => { (control as GridContainer).verticalSeparation = value; },
    },
  ];
}

function marginContainerProperties (): InspectorProperty[] {
  const margin = (name: string, side: 'left' | 'top' | 'right' | 'bottom'): InspectorProperty => ({
    group: 'Theme Overrides / Constants', name, kind: 'number', min: -128, max: 1024, step: 1, suffix: 'px',
    getValue: control => {
      const marginControl = control as MarginContainer;

      if (side === 'left') {
        return marginControl.marginLeft;
      }
      if (side === 'top') {
        return marginControl.marginTop;
      }
      if (side === 'right') {
        return marginControl.marginRight;
      }

      return marginControl.marginBottom;
    },
    setValue: (control, value) => {
      const marginControl = control as MarginContainer;

      if (side === 'left') {
        marginControl.marginLeft = value;
      } else if (side === 'top') {
        marginControl.marginTop = value;
      } else if (side === 'right') {
        marginControl.marginRight = value;
      } else {
        marginControl.marginBottom = value;
      }
    },
  });

  return [
    margin('margin_left', 'left'), margin('margin_top', 'top'),
    margin('margin_right', 'right'), margin('margin_bottom', 'bottom'),
  ];
}

function aspectRatioProperties (): InspectorProperty[] {
  return [
    {
      group: 'AspectRatioContainer', name: 'ratio', kind: 'number', min: 0.001, max: 10, step: 0.0001,
      getValue: control => (control as AspectRatioContainer).ratio,
      setValue: (control, value) => { (control as AspectRatioContainer).ratio = value; },
    },
    {
      group: 'AspectRatioContainer', name: 'stretch_mode', kind: 'enum',
      options: [
        { label: 'Width Controls Height', value: AspectRatioStretchMode.WidthControlsHeight },
        { label: 'Height Controls Width', value: AspectRatioStretchMode.HeightControlsWidth },
        { label: 'Fit', value: AspectRatioStretchMode.Fit },
        { label: 'Cover', value: AspectRatioStretchMode.Cover },
      ],
      getValue: control => (control as AspectRatioContainer).stretchMode,
      setValue: (control, value) => { (control as AspectRatioContainer).stretchMode = Number(value); },
    },
    {
      group: 'AspectRatioContainer / Alignment', name: 'alignment_horizontal', kind: 'enum', options: layoutAlignments,
      getValue: control => (control as AspectRatioContainer).horizontalAlignment,
      setValue: (control, value) => { (control as AspectRatioContainer).horizontalAlignment = Number(value); },
    },
    {
      group: 'AspectRatioContainer / Alignment', name: 'alignment_vertical', kind: 'enum', options: layoutAlignments,
      getValue: control => (control as AspectRatioContainer).verticalAlignment,
      setValue: (control, value) => { (control as AspectRatioContainer).verticalAlignment = Number(value); },
    },
  ];
}

function scrollContainerProperties (): InspectorProperty[] {
  const scrollModes: InspectorOption[] = [
    { label: 'Disabled', value: ScrollMode.Disabled },
    { label: 'Auto', value: ScrollMode.Auto },
    { label: 'Always Show', value: ScrollMode.ShowAlways },
    { label: 'Never Show', value: ScrollMode.ShowNever },
    { label: 'Reserve', value: ScrollMode.Reserve },
    { label: 'Maximize First', value: ScrollMode.MaximizeFirst },
  ];

  return [
    {
      group: 'ScrollContainer', name: 'follow_focus', kind: 'boolean',
      getValue: control => (control as ScrollContainer).followFocus,
      setValue: (control, value) => { (control as ScrollContainer).followFocus = value; },
    },
    {
      group: 'ScrollContainer / Scrollbar', name: 'scroll_horizontal', kind: 'number', step: 1, suffix: 'px',
      getValue: control => (control as ScrollContainer).hScroll,
      setValue: (control, value) => { (control as ScrollContainer).hScroll = value; },
    },
    {
      group: 'ScrollContainer / Scrollbar', name: 'scroll_vertical', kind: 'number', step: 1, suffix: 'px',
      getValue: control => (control as ScrollContainer).vScroll,
      setValue: (control, value) => { (control as ScrollContainer).vScroll = value; },
    },
    {
      group: 'ScrollContainer / Scrollbar', name: 'scroll_horizontal_custom_step', kind: 'number', min: -1, max: 4096, step: 1, suffix: 'px',
      getValue: control => (control as ScrollContainer).horizontalCustomStep,
      setValue: (control, value) => { (control as ScrollContainer).horizontalCustomStep = value; },
    },
    {
      group: 'ScrollContainer / Scrollbar', name: 'scroll_vertical_custom_step', kind: 'number', min: -1, max: 4096, step: 1, suffix: 'px',
      getValue: control => (control as ScrollContainer).verticalCustomStep,
      setValue: (control, value) => { (control as ScrollContainer).verticalCustomStep = value; },
    },
    {
      group: 'ScrollContainer / Scrollbar', name: 'horizontal_scroll_mode', kind: 'enum', options: scrollModes,
      getValue: control => (control as ScrollContainer).horizontalScrollMode,
      setValue: (control, value) => { (control as ScrollContainer).horizontalScrollMode = Number(value); },
    },
    {
      group: 'ScrollContainer / Scrollbar', name: 'vertical_scroll_mode', kind: 'enum', options: scrollModes,
      getValue: control => (control as ScrollContainer).verticalScrollMode,
      setValue: (control, value) => { (control as ScrollContainer).verticalScrollMode = Number(value); },
    },
    {
      group: 'ScrollContainer / Scrollbar', name: 'scroll_horizontal_by_default', kind: 'boolean',
      getValue: control => (control as ScrollContainer).scrollHorizontalByDefault,
      setValue: (control, value) => { (control as ScrollContainer).scrollHorizontalByDefault = value; },
    },
    {
      group: 'ScrollContainer / Scrollbar', name: 'scroll_deadzone', kind: 'number', min: 0, step: 1,
      getValue: control => (control as ScrollContainer).deadzone,
      setValue: (control, value) => { (control as ScrollContainer).deadzone = value; },
    },
  ];
}

function sizeFlagOptions (): InspectorOption[] {
  return [
    { label: 'Fill', value: SizeFlags.Fill },
    { label: 'Expand', value: SizeFlags.Expand },
    { label: 'Shrink Center', value: SizeFlags.ShrinkCenter },
    { label: 'Shrink End', value: SizeFlags.ShrinkEnd },
  ];
}

function recursiveOptions (): InspectorOption[] {
  return [
    { label: 'Inherited', value: FocusBehaviorRecursive.Inherited },
    { label: 'Disabled', value: FocusBehaviorRecursive.Disabled },
    { label: 'Enabled', value: FocusBehaviorRecursive.Enabled },
  ];
}

function cursorOptions (): InspectorOption[] {
  return [
    'Arrow', 'I-Beam', 'Pointing Hand', 'Cross', 'Wait', 'Busy', 'Drag', 'Can Drop', 'Forbidden',
    'Vertical Resize', 'Horizontal Resize', 'Secondary Diagonal Resize', 'Main Diagonal Resize',
    'Move', 'Vertical Split', 'Horizontal Split', 'Help',
  ].map((label, value) => ({ label, value: value as CursorShape }));
}
