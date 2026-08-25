import type { Control, Engine } from '@galacean/effects';
import { SizeFlags, math } from '@galacean/effects';
import type {
  Slider } from '@galacean/effects-plugin-gui';
import {
  Button,
  ButtonGroup,
  CheckButton,
  HBoxContainer,
  HorizontalAlignment,
  Label,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import { getTheme, mix, withAlpha } from './theme';

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
  button.fontSize = 12;
  button.fontWeight = 600;
  button.borderWidth = 1;
  button.normalColor = theme.panelBg;
  button.hoverColor = theme.panelRaisedBg;
  button.pressedColor = theme.accentSoft;
  button.borderColor = theme.borderSubtle;
  button.textColor = theme.textPrimary;
  if (variant === 'primary') {
    button.normalColor = theme.accent;
    button.hoverColor = theme.accentHover;
    button.pressedColor = mix(theme.accentHover, theme.textPrimary, 0.12);
    button.borderColor = theme.accent;
    button.textColor = theme.textOnAccent;
  } else if (variant === 'danger') {
    button.normalColor = withAlpha(theme.danger, 0.14);
    button.hoverColor = withAlpha(theme.danger, 0.22);
    button.pressedColor = withAlpha(theme.danger, 0.32);
    button.borderColor = withAlpha(theme.danger, 0.52);
    button.textColor = theme.danger;
  } else if (variant === 'ghost') {
    button.flat = true;
    button.borderWidth = 0;
    button.hoverColor = theme.panelRaisedBg;
    button.pressedColor = theme.accentSoft;
    button.textColor = theme.textSecondary;
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

  slider.trackColor = theme.controlTrack;
  slider.fillColor = theme.accent;
  slider.grabberColor = mix(theme.borderStrong, theme.textPrimary, 0.18);
  slider.grabberHighlightedColor = theme.accentHover;
  slider.grabberDisabledColor = theme.borderSubtle;

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

  row.separation = 4;

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

  title.fontSize = 15;
  title.fontWeight = 650;
  title.textColor = theme.textPrimary;
  title.textOverflow = TextOverflow.Ellipsis;
  title.verticalAlignment = VerticalAlignment.Center;
  title.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, 24) });
  title.parent = parent;
  description.fontSize = 11;
  description.textColor = theme.textSecondary;
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

  keyLabel.fontSize = 11;
  keyLabel.textColor = theme.textSecondary;
  keyLabel.verticalAlignment = VerticalAlignment.Center;
  keyLabel.textOverflow = TextOverflow.Ellipsis;
  keyLabel.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width * 0.58, 28) });
  keyLabel.parent = parent;
  valueLabel.fontSize = 11;
  valueLabel.fontWeight = 600;
  valueLabel.textColor = theme.textPrimary;
  valueLabel.horizontalAlignment = HorizontalAlignment.Right;
  valueLabel.verticalAlignment = VerticalAlignment.Center;
  valueLabel.textOverflow = TextOverflow.Ellipsis;
  valueLabel.setRect({ position: new math.Vector2(x + width * 0.58, y), size: new math.Vector2(width * 0.42, 28) });
  valueLabel.parent = parent;

  return valueLabel;
}
