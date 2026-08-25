import type { Engine } from '@galacean/effects';
import { Control, math } from '@galacean/effects';
import {
  AutowrapMode,
  Button,
  ButtonGroup,
  CheckBox,
  CheckButton,
  ColorRect,
  HSlider,
  Label,
  Panel,
  ProgressBar,
  TextOverflow,
  VerticalAlignment,
  VSlider,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import { getTheme } from '../theme';
import { addSectionTitle, createButton, styleSlider } from '../widgets';
import { label } from './common';

export class OverviewPage extends Control {
  constructor (engine: Engine, _ctx: AppContext) {
    super(engine);
    const buttons = new Panel(engine);
    const selection = new Panel(engine);
    const ranges = new Panel(engine);
    const display = new Panel(engine);

    attachAnchoredRect(buttons, this, 0, 0, 0.5, 0.5, 0, 0, 8, 8);
    attachAnchoredRect(selection, this, 0.5, 0, 1, 0.5, 8, 0, 0, 8);
    attachAnchoredRect(ranges, this, 0, 0.5, 0.5, 1, 0, 8, 8, 0);
    attachAnchoredRect(display, this, 0.5, 0.5, 1, 1, 8, 8, 0, 0);
    this.buildButtons(buttons);
    this.buildSelection(selection);
    this.buildRanges(ranges);
    this.buildDisplay(display);
  }

  private buildButtons (panel: Panel): void {
    const theme = getTheme();
    const counter = label(this.engine, 'Pressed 0 times', 20, 168, 294, 28, panel, {
      size: 11,
      color: theme.textSecondary,
    });
    let count = 0;

    addSectionTitle(this.engine, panel, 'Button', 'Press, toggle and disabled states');
    const primary = createButton(this.engine, 'Primary action', () => {
      counter.text = `Pressed ${++count} time${count === 1 ? '' : 's'}`;
    }, 'primary');
    const secondary = createButton(this.engine, 'Secondary');
    const toggle = new Button(this.engine, 'Toggle button');
    const disabled = new Button(this.engine, 'Disabled');

    primary.setRect({ position: new math.Vector2(20, 82), size: new math.Vector2(136, 36) });
    secondary.setRect({ position: new math.Vector2(166, 82), size: new math.Vector2(136, 36) });
    toggle.toggleMode = true;
    toggle.setRect({ position: new math.Vector2(20, 128), size: new math.Vector2(136, 36) });
    disabled.disabled = true;
    disabled.setRect({ position: new math.Vector2(166, 128), size: new math.Vector2(136, 36) });
    [primary, secondary, toggle, disabled].forEach(control => {
      control.parent = panel;
    });
  }

  private buildSelection (panel: Panel): void {
    addSectionTitle(this.engine, panel, 'Selection', 'CheckBox, ButtonGroup and CheckButton');
    const checkbox = new CheckBox(this.engine, 'Enable shadows');
    const radioGroup = new ButtonGroup();
    const optionA = new CheckBox(this.engine, 'Quality: Balanced');
    const optionB = new CheckBox(this.engine, 'Quality: High');
    const toggle = new CheckButton(this.engine, 'Autosave');

    checkbox.setPressedNoSignal(true);
    checkbox.setRect({ position: new math.Vector2(20, 78), size: new math.Vector2(282, 34) });
    optionA.buttonGroup = radioGroup;
    optionA.setPressedNoSignal(true);
    optionA.setRect({ position: new math.Vector2(20, 118), size: new math.Vector2(282, 32) });
    optionB.buttonGroup = radioGroup;
    optionB.setRect({ position: new math.Vector2(20, 154), size: new math.Vector2(282, 32) });
    toggle.setPressedNoSignal(true);
    toggle.setRect({ position: new math.Vector2(20, 194), size: new math.Vector2(282, 34) });
    [checkbox, optionA, optionB, toggle].forEach(control => {
      control.parent = panel;
    });
  }

  private buildRanges (panel: Panel): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'Range controls', 'One Range shared by two sliders and progress');
    const horizontal = styleSlider(new HSlider(this.engine));
    const vertical = styleSlider(new VSlider(this.engine));
    const progress = new ProgressBar(this.engine);
    const value = label(this.engine, '48%', 20, 80, 80, 28, panel, {
      size: 18,
      color: theme.textPrimary,
      weight: 650,
    });

    horizontal.share(vertical);
    horizontal.share(progress);
    horizontal.setValueNoSignal(48);
    horizontal.setRect({ position: new math.Vector2(20, 122), size: new math.Vector2(230, 20) });
    vertical.setRect({ position: new math.Vector2(280, 82), size: new math.Vector2(18, 104) });
    progress.setRect({ position: new math.Vector2(20, 158), size: new math.Vector2(230, 28) });
    horizontal.on('valueChanged', next => {
      value.text = `${Math.round(next)}%`;
    });
    [horizontal, vertical, progress].forEach(control => {
      control.parent = panel;
    });
  }

  private buildDisplay (panel: Panel): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'Display controls', 'Label wrapping, clipping and ColorRect');
    const swatch = new ColorRect(this.engine);
    const wrapped = new Label(this.engine, 'WordSmart wrapping keeps English and 中文 content readable.');
    const clipped = new Label(this.engine, 'This long single-line label is clipped at the panel edge.');

    swatch.color = theme.accentSoft;
    swatch.setRect({ position: new math.Vector2(20, 82), size: new math.Vector2(282, 62) });
    swatch.parent = panel;
    wrapped.autowrapMode = AutowrapMode.WordSmart;
    wrapped.textOverflow = TextOverflow.Clip;
    wrapped.textColor = theme.textPrimary;
    wrapped.verticalAlignment = VerticalAlignment.Top;
    wrapped.setRect({ position: new math.Vector2(32, 89), size: new math.Vector2(258, 48) });
    wrapped.parent = panel;
    clipped.textOverflow = TextOverflow.Ellipsis;
    clipped.textColor = theme.textSecondary;
    clipped.verticalAlignment = VerticalAlignment.Center;
    clipped.setRect({ position: new math.Vector2(20, 152), size: new math.Vector2(282, 30) });
    clipped.parent = panel;
    const info = label(this.engine, 'Panel · Label · ColorRect', 20, 190, 282, 28, panel, {
      size: 11,
      color: theme.textTertiary,
    });

    info.fontWeight = 600;
  }
}
