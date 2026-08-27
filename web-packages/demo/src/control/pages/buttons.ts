import type { Engine } from '@galacean/effects';
import { Control, math } from '@galacean/effects';
import {
  Button,
  ButtonActionMode,
  HorizontalAlignment,
  Label,
  Panel,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import { getTheme } from '../theme';
import { addSectionTitle, createButton, createSegmentedControl } from '../widgets';
import { createDemoTexture, label } from './common';

export class ButtonsPage extends Control {
  private readonly texture = createDemoTexture(this.engine);

  constructor (engine: Engine, _ctx: AppContext) {
    super(engine);
    const variants = new Panel(engine);
    const behavior = new Panel(engine);

    attachAnchoredRect(variants, this, 0, 0, 0.5, 1, 0, 0, 8, 0);
    attachAnchoredRect(behavior, this, 0.5, 0, 1, 1, 8, 0, 0, 0);
    this.buildVariants(variants);
    this.buildBehavior(behavior);
  }

  override onDestroy (): void {
    this.texture.dispose();
  }

  private buildVariants (panel: Panel): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'Button states', 'Native Button colors, disabled state and icon content');
    const primary = createButton(this.engine, 'Primary', undefined, 'primary');
    const standard = createButton(this.engine, 'Standard');
    const ghost = createButton(this.engine, 'Ghost', undefined, 'ghost');
    const danger = createButton(this.engine, 'Delete', undefined, 'danger');
    const disabled = createButton(this.engine, 'Disabled');

    primary.setRect({ position: new math.Vector2(20, 82), size: new math.Vector2(136, 36) });
    standard.setRect({ position: new math.Vector2(166, 82), size: new math.Vector2(136, 36) });
    ghost.setRect({ position: new math.Vector2(20, 130), size: new math.Vector2(136, 36) });
    danger.setRect({ position: new math.Vector2(166, 130), size: new math.Vector2(136, 36) });
    disabled.disabled = true;
    disabled.setRect({ position: new math.Vector2(20, 178), size: new math.Vector2(136, 36) });
    [primary, standard, ghost, danger, disabled].forEach(control => {
      control.parent = panel;
    });

    label(this.engine, 'ICON CONTENT', 20, 232, 160, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const iconOnly = new Button(this.engine);
    const iconText = new Button(this.engine, 'Texture icon');

    iconOnly.icon = this.texture;
    iconOnly.expandIcon = true;
    iconOnly.clipText = true;
    iconOnly.setRect({ position: new math.Vector2(20, 260), size: new math.Vector2(112, 74) });
    iconText.icon = this.texture;
    iconText.expandIcon = true;
    iconText.clipText = true;
    iconText.setRect({ position: new math.Vector2(142, 260), size: new math.Vector2(160, 74) });
    iconOnly.parent = panel;
    iconText.parent = panel;

    label(this.engine, 'SIZE & PADDING', 20, 350, 160, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const small = new Button(this.engine, 'Small');
    const medium = new Button(this.engine, 'Medium');
    const large = new Button(this.engine, 'Large');

    small.fontSize = 11;
    small.horizontalPadding = 6;
    small.verticalPadding = 3;
    small.setRect({ position: new math.Vector2(20, 382), size: new math.Vector2(78, 28) });
    medium.setRect({ position: new math.Vector2(108, 378), size: new math.Vector2(94, 36) });
    large.fontSize = 14;
    large.horizontalPadding = 14;
    large.verticalPadding = 8;
    large.setRect({ position: new math.Vector2(212, 374), size: new math.Vector2(90, 44) });
    [small, medium, large].forEach(control => {
      control.parent = panel;
    });
  }

  private buildBehavior (panel: Panel): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'Interaction behavior', 'ButtonGroup, toggleMode and actionMode');
    label(this.engine, 'BUTTON GROUP', 20, 76, 180, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const previewPanel = new Panel(this.engine);
    const preview = new Label(this.engine, 'Centered label');
    const alignments = [HorizontalAlignment.Left, HorizontalAlignment.Center, HorizontalAlignment.Right];
    const segmented = createSegmentedControl(this.engine, ['Left', 'Center', 'Right'], 1, index => {
      preview.horizontalAlignment = alignments[index];
      preview.text = `${['Left', 'Centered', 'Right'][index]} label`;
    });

    segmented.control.setRect({ position: new math.Vector2(20, 104), size: new math.Vector2(282, 34) });
    segmented.control.parent = panel;
    previewPanel.backgroundColor = theme.panelRaisedBg;
    previewPanel.setRect({ position: new math.Vector2(20, 150), size: new math.Vector2(282, 62) });
    previewPanel.parent = panel;
    preview.horizontalAlignment = HorizontalAlignment.Center;
    preview.verticalAlignment = VerticalAlignment.Center;
    preview.textColor = theme.textPrimary;
    preview.setRect({ position: new math.Vector2(12, 8), size: new math.Vector2(258, 46) });
    preview.parent = previewPanel;

    label(this.engine, 'ACTION MODE', 20, 236, 180, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const pressButton = new Button(this.engine, 'On press');
    const releaseButton = new Button(this.engine, 'On release');
    const pressCount = label(this.engine, '0 events', 20, 306, 134, 24, panel, { size: 11, color: theme.textSecondary });
    const releaseCount = label(this.engine, '0 events', 168, 306, 134, 24, panel, { size: 11, color: theme.textSecondary });
    let down = 0;
    let up = 0;

    pressButton.actionMode = ButtonActionMode.Press;
    releaseButton.actionMode = ButtonActionMode.Release;
    pressButton.setRect({ position: new math.Vector2(20, 264), size: new math.Vector2(134, 36) });
    releaseButton.setRect({ position: new math.Vector2(168, 264), size: new math.Vector2(134, 36) });
    pressButton.parent = panel;
    releaseButton.parent = panel;
    pressButton.on('pressed', () => {
      pressCount.text = `${++down} event${down === 1 ? '' : 's'}`;
    });
    releaseButton.on('pressed', () => {
      releaseCount.text = `${++up} event${up === 1 ? '' : 's'}`;
    });

    label(this.engine, 'TOGGLE MODE', 20, 356, 180, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const toggle = new Button(this.engine, 'Click to toggle');
    const toggleState = label(this.engine, 'Off', 168, 384, 134, 36, panel, {
      size: 12,
      color: theme.textSecondary,
      horizontal: HorizontalAlignment.Center,
    });

    toggle.toggleMode = true;
    toggle.setRect({ position: new math.Vector2(20, 384), size: new math.Vector2(134, 36) });
    toggle.parent = panel;
    toggle.on('toggled', pressed => {
      toggleState.text = pressed ? 'On' : 'Off';
      toggleState.textColor = pressed ? theme.success : theme.textSecondary;
    });
  }
}
