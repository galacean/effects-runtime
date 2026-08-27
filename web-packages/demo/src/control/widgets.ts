import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import type {
  Slider } from '@galacean/effects-plugin-gui';
import {
  Button,
  ButtonGroup,
  CheckButton,
  SizeFlags,
  HBoxContainer,
  HorizontalAlignment,
  Label,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { Control } from '@galacean/effects-plugin-gui';
import { getTheme, mix, setFlatStyleOverride, setFontOverrides, withAlpha } from './theme';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

export function createButton (
  engine: Engine,
  text: string,
  pressed?: () => void,
  variant: ButtonVariant = 'default',
): Button {
  const theme = getTheme();
  const button = new Button(engine, text);

  button.clipText = true;
  setFontOverrides(button, { size: 12, weight: 600, color: theme.textPrimary });
  setButtonStateColors(button, theme.panelBg, theme.panelRaisedBg, theme.accentSoft, theme.borderSubtle, 1);
  if (variant === 'primary') {
    setButtonStateColors(
      button, theme.accent, theme.accentHover,
      mix(theme.accentHover, theme.textPrimary, 0.12), theme.accent, 1,
    );
    setButtonFontColors(button, theme.textOnAccent);
  } else if (variant === 'danger') {
    setButtonStateColors(
      button,
      withAlpha(theme.danger, 0.14),
      withAlpha(theme.danger, 0.22),
      withAlpha(theme.danger, 0.32),
      withAlpha(theme.danger, 0.52),
      1,
    );
    setButtonFontColors(button, theme.danger);
  } else if (variant === 'ghost') {
    button.flat = true;
    setButtonStateColors(button, theme.panelBg, theme.panelRaisedBg, theme.accentSoft, theme.borderSubtle, 0);
    setButtonFontColors(button, theme.textSecondary);
  }
  if (pressed) {
    button.on('pressed', pressed);
  }

  return button;
}

export function createToggle (
  engine: Engine,
  text: string,
  checked: boolean,
  changed: (value: boolean) => void,
): CheckButton {
  const toggle = new CheckButton(engine, text);

  toggle.clipText = true;
  toggle.setPressedNoSignal(checked);
  toggle.on('toggled', changed);

  return toggle;
}

export function styleSlider<T extends Slider> (slider: T): T {
  const theme = getTheme();

  setFlatStyleOverride(slider, 'track', { background: theme.controlTrack });
  setFlatStyleOverride(slider, 'fill', { background: theme.accent });
  setFlatStyleOverride(slider, 'grabber', { background: mix(theme.borderStrong, theme.textPrimary, 0.18) });
  setFlatStyleOverride(slider, 'grabberHighlight', { background: theme.accentHover });
  setFlatStyleOverride(slider, 'grabberDisabled', { background: theme.borderSubtle });

  return slider;
}

export type SegmentedControl = {
  control: HBoxContainer,
  buttons: Button[],
  select(index: number): void,
};

export function createSegmentedControl (
  engine: Engine,
  options: string[],
  selectedIndex: number,
  changed: (index: number) => void,
): SegmentedControl {
  const row = new HBoxContainer(engine);
  const group = new ButtonGroup();
  const buttons = options.map((option, index) => {
    const button = createButton(engine, option);

    button.toggleMode = true;
    button.buttonGroup = group;
    button.setPressedNoSignal(index === selectedIndex);
    button.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    button.on('toggled', pressed => {
      if (pressed) {
        changed(index);
      }
    });
    row.addChild(button);

    return button;
  });

  row.setThemeConstantOverride('separation', 4);

  return {
    control: row,
    buttons,
    select: index => buttons.forEach((button, buttonIndex) => button.setPressedNoSignal(buttonIndex === index)),
  };
}

export function addSectionTitle (
  engine: Engine,
  parent: Control,
  titleText: string,
  caption: string,
  x = 20,
  y = 18,
  width = 294,
): void {
  const theme = getTheme();
  const title = new Label(engine, titleText);
  const description = new Label(engine, caption);

  setFontOverrides(title, { size: 15, weight: 650, color: theme.textPrimary });
  title.textOverflow = TextOverflow.Ellipsis;
  title.verticalAlignment = VerticalAlignment.Center;
  title.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, 24) });
  title.parent = parent;
  setFontOverrides(description, { size: 11, color: theme.textSecondary });
  description.textOverflow = TextOverflow.Ellipsis;
  description.verticalAlignment = VerticalAlignment.Center;
  description.setRect({ position: new math.Vector2(x, y + 27), size: new math.Vector2(width, 20) });
  description.parent = parent;
}

export function addKeyValueRow (
  engine: Engine,
  parent: Control,
  key: string,
  value: string,
  x: number,
  y: number,
  width: number,
): Label {
  const theme = getTheme();
  const keyLabel = new Label(engine, key);
  const valueLabel = new Label(engine, value);

  setFontOverrides(keyLabel, { size: 11, color: theme.textSecondary });
  keyLabel.verticalAlignment = VerticalAlignment.Center;
  keyLabel.textOverflow = TextOverflow.Ellipsis;
  keyLabel.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width * 0.58, 28) });
  keyLabel.parent = parent;
  setFontOverrides(valueLabel, { size: 11, weight: 600, color: theme.textPrimary });
  valueLabel.horizontalAlignment = HorizontalAlignment.Right;
  valueLabel.verticalAlignment = VerticalAlignment.Center;
  valueLabel.textOverflow = TextOverflow.Ellipsis;
  valueLabel.setRect({ position: new math.Vector2(x + width * 0.58, y), size: new math.Vector2(width * 0.42, 28) });
  valueLabel.parent = parent;

  return valueLabel;
}

function setButtonStateColors (
  button: Button,
  normal: math.Color,
  hover: math.Color,
  pressed: math.Color,
  border: math.Color,
  borderWidth: number,
): void {
  setFlatStyleOverride(button, 'normal', { background: normal, border, borderWidth });
  setFlatStyleOverride(button, 'hover', { background: hover, border, borderWidth });
  setFlatStyleOverride(button, 'pressed', { background: pressed, border, borderWidth });
  setFlatStyleOverride(button, 'hoverPressed', { background: pressed, border, borderWidth });
  setFlatStyleOverride(button, 'disabled', { border, borderWidth });
}

function setButtonFontColors (button: Button, color: math.Color): void {
  for (const name of ['fontColor', 'fontHoverColor', 'fontPressedColor', 'fontHoverPressedColor']) {
    button.setThemeColorOverride(name, color);
  }
}
