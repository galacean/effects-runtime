import type { Engine } from '@galacean/effects';
import { Control, math } from '@galacean/effects';
import {
  Button,
  ButtonGroup,
  HorizontalAlignment,
  Label,
  Panel,
  ScrollContainer,
  ScrollMode,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import { attachAnchoredRect } from '../layout';
import type { InspectorControlType } from '../state';
import type { ThemeTokens } from '../theme';
import { setFlatStyleOverride, setFontOverrides } from '../theme';
import { INSPECTOR_CONTROL_OPTIONS } from './schema';

const CONTENT_WIDTH = 166;

export class ControlCatalog extends Panel {
  private readonly buttons = new Map<InspectorControlType, Button>();

  constructor (
    engine: Engine,
    selected: InspectorControlType,
    private readonly tokens: ThemeTokens,
    selectControl: (type: InspectorControlType) => void,
  ) {
    super(engine);
    setFlatStyleOverride(this, 'panel', { background: tokens.panelBg, border: tokens.borderSubtle });
    this.clipContents = true;
    this.addLabel('CONTROLS', 12, 10, 150, 16, 9, tokens.textTertiary, 700);
    this.addLabel('Control types', 12, 28, 150, 24, 14, tokens.textPrimary, 680);

    const divider = new Panel(engine);

    setFlatStyleOverride(divider, 'panel', { background: tokens.borderSubtle, borderWidth: 0 });
    divider.setRect({ position: new math.Vector2(0, 59), size: new math.Vector2(184, 1) });
    divider.parent = this;

    const scroll = new ScrollContainer(engine);

    scroll.horizontalScrollMode = ScrollMode.Disabled;
    scroll.verticalScrollMode = ScrollMode.Auto;
    attachAnchoredRect(scroll, this, 0, 0, 1, 1, 0, 60, 0, 0);

    const content = new Control(engine);
    const selection = new ButtonGroup();
    const groups = new Map<string, typeof INSPECTOR_CONTROL_OPTIONS>();
    let y = 8;

    content.parent = scroll;
    for (const option of INSPECTOR_CONTROL_OPTIONS) {
      const options = groups.get(option.group) ?? [];

      options.push(option);
      groups.set(option.group, options);
    }
    for (const [groupName, options] of groups) {
      const groupLabel = this.createLabel(groupName.toUpperCase(), 10, y, 146, 22, 9, tokens.textTertiary, 700);

      groupLabel.parent = content;
      y += 24;
      for (const option of options) {
        const button = new Button(engine, option.title);

        button.toggleMode = true;
        button.buttonGroup = selection;
        button.flat = true;
        button.clipText = true;
        setFontOverrides(button, { size: 11, weight: 550, color: tokens.textSecondary });
        button.textAlignment = HorizontalAlignment.Left;
        setFlatStyleOverride(button, 'normal', {
          background: tokens.panelBg, borderWidth: 0, horizontalMargin: 12,
        });
        setFlatStyleOverride(button, 'hover', {
          background: tokens.panelRaisedBg, borderWidth: 0, horizontalMargin: 12,
        });
        for (const state of ['pressed', 'hoverPressed']) {
          setFlatStyleOverride(button, state, {
            background: tokens.accentSoft, borderWidth: 0, horizontalMargin: 12,
          });
        }
        button.setRect({ position: new math.Vector2(4, y), size: new math.Vector2(158, 30) });
        button.parent = content;
        button.on('toggled', pressed => {
          if (pressed) {
            selectControl(option.type);
          }
        });
        this.buttons.set(option.type, button);
        y += 31;
      }
      y += 10;
    }
    content.setCustomMinimumSize(CONTENT_WIDTH, y);
    this.setSelected(selected);
  }

  setSelected (type: InspectorControlType): void {
    for (const [buttonType, button] of this.buttons) {
      button.setPressedNoSignal(buttonType === type);
      button.setThemeColorOverride(
        'fontColor', buttonType === type ? this.tokens.accent : this.tokens.textSecondary,
      );
    }
  }

  private addLabel (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    color: math.Color,
    weight: number,
  ): Label {
    const label = this.createLabel(text, x, y, width, height, size, color, weight);

    label.parent = this;

    return label;
  }

  private createLabel (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    color: math.Color,
    weight: number,
  ): Label {
    const label = new Label(this.engine, text);

    setFontOverrides(label, { size, weight, color });
    label.textOverflow = TextOverflow.Ellipsis;
    label.verticalAlignment = VerticalAlignment.Center;
    label.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });

    return label;
  }
}
