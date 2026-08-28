import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import type {
  Button } from '@galacean/effects-plugin-gui';
import {
  AutowrapMode,
  ButtonGroup,
  Control,
  GridContainer,
  HBoxContainer,
  HSeparator,
  HSlider,
  HorizontalAlignment,
  Label,
  NinePatchRect,
  Panel,
  PanelContainer,
  Side,
  SizeFlags,
  TextOverflow,
  TextureRect,
  TextureStretchMode,
  VerticalAlignment,
  VSeparator,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import { getTheme, setFlatStyleOverride, setFontOverrides } from '../theme';
import { addSectionTitle, createButton, createSegmentedControl, createToggle, styleSlider } from '../widgets';
import { ResizeHandle, createDemoTexture, label } from './common';

const H_ALIGNMENTS = [HorizontalAlignment.Left, HorizontalAlignment.Center, HorizontalAlignment.Right];
const V_ALIGNMENTS = [VerticalAlignment.Top, VerticalAlignment.Center, VerticalAlignment.Bottom];

export class ContentPage extends Control {
  private readonly texture = createDemoTexture(this.engine);

  constructor (engine: Engine, ctx: AppContext) {
    super(engine);
    const typography = new Panel(engine);
    const media = new Panel(engine);

    attachAnchoredRect(typography, this, 0, 0, 0.5, 1, 0, 0, 8, 0);
    attachAnchoredRect(media, this, 0.5, 0, 1, 1, 8, 0, 0, 0);
    this.buildTypography(typography, ctx);
    this.buildMedia(media, ctx);
  }

  override onDestroy (): void {
    this.texture.dispose();
  }

  private buildTypography (card: Panel, ctx: AppContext): void {
    const theme = getTheme();

    addSectionTitle(this.engine, card, 'Label alignment', 'Nine combinations across both alignment axes');
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        const cell = new Panel(this.engine);
        const value = new Label(this.engine, `${['L', 'C', 'R'][column]}${['T', 'C', 'B'][row]}`);
        const x = 20 + column * 98;
        const y = 76 + row * 50;

        cell.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(90, 40) });
        setFlatStyleOverride(cell, 'panel', { background: theme.panelRaisedBg });
        cell.parent = card;
        setFontOverrides(value, { size: 10, color: theme.textSecondary });
        value.horizontalAlignment = H_ALIGNMENTS[column];
        value.verticalAlignment = V_ALIGNMENTS[row];
        value.setRect({ position: new math.Vector2(x + 8, y + 5), size: new math.Vector2(74, 30) });
        value.parent = card;
      }
    }

    label(this.engine, 'WRAP & OVERFLOW', 20, 240, 200, 20, card, {
      size: 10,
      color: theme.textTertiary,
      weight: 700,
    });
    const wrapped = new Label(this.engine, 'Long content demonstrates wrapping, clipping and ellipsis. 中文会保持清晰可读。');
    const wrapToggle = createToggle(this.engine, 'WordSmart autowrap', ctx.state.content.autowrap, checked => {
      ctx.state.content.autowrap = checked;
      wrapped.autowrapMode = checked ? AutowrapMode.WordSmart : AutowrapMode.Off;
    });

    wrapToggle.setRect({ position: new math.Vector2(20, 268), size: new math.Vector2(294, 36) });
    wrapToggle.parent = card;
    const widthSlider = styleSlider(new HSlider(this.engine));
    const widthReadout = label(this.engine, '', 250, 310, 96, 26, card, {
      size: 11,
      color: theme.textSecondary,
      horizontal: HorizontalAlignment.Right,
    });

    widthSlider.minValue = 160;
    widthSlider.maxValue = 294;
    widthSlider.step = 2;
    widthSlider.setValueNoSignal(ctx.state.content.wrapWidth);
    widthSlider.setRect({ position: new math.Vector2(20, 316), size: new math.Vector2(214, 18) });
    widthSlider.parent = card;
    wrapped.autowrapMode = ctx.state.content.autowrap ? AutowrapMode.WordSmart : AutowrapMode.Off;
    wrapped.textOverflow = TextOverflow.Clip;
    wrapped.setThemeColorOverride('fontColor', theme.textPrimary);
    wrapped.verticalAlignment = VerticalAlignment.Center;
    wrapped.setRect({ position: new math.Vector2(20, 376), size: new math.Vector2(ctx.state.content.wrapWidth, 72) });
    wrapped.parent = card;
    const overflow = createSegmentedControl(this.engine, ['Visible', 'Clip', 'Ellipsis'], 1, index => {
      wrapped.textOverflow = [TextOverflow.Visible, TextOverflow.Clip, TextOverflow.Ellipsis][index];
    });

    overflow.control.setRect({ position: new math.Vector2(20, 344), size: new math.Vector2(294, 30) });
    overflow.control.parent = card;
    const updateWidth = (value: number): void => {
      ctx.state.content.wrapWidth = value;
      widthReadout.text = `${value.toFixed(0)} px`;
      wrapped.setRect({ position: new math.Vector2(20, 376), size: new math.Vector2(value, 72) });
    };

    updateWidth(widthSlider.value);
    widthSlider.on('valueChanged', updateWidth);
  }

  private buildMedia (card: Panel, ctx: AppContext): void {
    const theme = getTheme();

    addSectionTitle(this.engine, card, 'Texture display', 'TextureRect modes and a resizable NinePatchRect');
    const texture = new TextureRect(this.engine, this.texture);
    const stretchModes = [
      TextureStretchMode.Scale,
      TextureStretchMode.Tile,
      TextureStretchMode.Keep,
      TextureStretchMode.KeepCentered,
      TextureStretchMode.KeepAspect,
      TextureStretchMode.KeepAspectCentered,
      TextureStretchMode.KeepAspectCovered,
    ];

    texture.stretchMode = stretchModes[ctx.state.content.stretchMode] ?? TextureStretchMode.KeepAspectCentered;
    texture.setRect({ position: new math.Vector2(20, 158), size: new math.Vector2(294, 96) });
    texture.parent = card;
    const modeGrid = new GridContainer(this.engine);
    const modeGroup = new ButtonGroup();

    modeGrid.columns = 4;
    modeGrid.setThemeConstantOverride('horizontalSeparation', 4);
    modeGrid.setThemeConstantOverride('verticalSeparation', 4);
    modeGrid.setRect({ position: new math.Vector2(20, 76), size: new math.Vector2(294, 70) });
    modeGrid.parent = card;
    ['Scale', 'Tile', 'Keep', 'Center', 'Aspect', 'Fit', 'Cover'].forEach((mode, index) => {
      const button: Button = createButton(this.engine, mode);

      button.toggleMode = true;
      button.buttonGroup = modeGroup;
      for (const state of ['normal', 'hover', 'pressed', 'hoverPressed', 'disabled']) {
        setFlatStyleOverride(button, state, { horizontalMargin: 4 });
      }
      button.setPressedNoSignal(index === ctx.state.content.stretchMode);
      button.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
      button.on('toggled', pressed => {
        if (pressed) {
          ctx.state.content.stretchMode = index;
          texture.stretchMode = stretchModes[index];
        }
      });
      modeGrid.addChild(button);
    });
    const patch = new NinePatchRect(this.engine, this.texture);

    patch.setPatchMargin(Side.Left, 12);
    patch.setPatchMargin(Side.Top, 12);
    patch.setPatchMargin(Side.Right, 12);
    patch.setPatchMargin(Side.Bottom, 12);
    patch.setRect({ position: new math.Vector2(20, 294), size: new math.Vector2(220, 94) });
    patch.parent = card;
    const readout = label(this.engine, '220 × 94', 246, 320, 68, 38, card, {
      size: 11,
      color: theme.textSecondary,
      horizontal: HorizontalAlignment.Center,
    });
    const handle = new ResizeHandle(this.engine, 'se', () => undefined, () => {
      const pointer = card.getLocalMousePosition();
      const width = Math.max(120, Math.min(294, pointer.x - 20));
      const height = Math.max(64, Math.min(116, pointer.y - 294));

      patch.setRect({ position: new math.Vector2(20, 294), size: new math.Vector2(width, height) });
      handle.setRect({ position: new math.Vector2(12 + width, 286 + height), size: new math.Vector2(16, 16) });
      readout.text = `${Math.round(width)} × ${Math.round(height)}`;
    });

    handle.setRect({ position: new math.Vector2(232, 380), size: new math.Vector2(16, 16) });
    handle.parent = card;
    label(this.engine, 'Drag the corner', 20, 268, 220, 20, card, {
      size: 10,
      color: theme.textTertiary,
      weight: 700,
    });

    label(this.engine, 'SURFACES & SEPARATORS', 20, 414, 220, 20, card, {
      size: 10,
      color: theme.textTertiary,
      weight: 700,
    });
    const surface = new PanelContainer(this.engine);
    const surfaceLabel = new Label(this.engine, 'PanelContainer');

    surface.setRect({ position: new math.Vector2(20, 442), size: new math.Vector2(140, 58) });
    surface.parent = card;
    surfaceLabel.horizontalAlignment = HorizontalAlignment.Center;
    surfaceLabel.verticalAlignment = VerticalAlignment.Center;
    surfaceLabel.parent = surface;
    const separator = new HSeparator(this.engine);

    separator.setRect({ position: new math.Vector2(174, 442), size: new math.Vector2(120, 14) });
    separator.parent = card;
    const split = new HBoxContainer(this.engine);
    const left = new Label(this.engine, 'Left');
    const verticalSeparator = new VSeparator(this.engine);
    const right = new Label(this.engine, 'Right');

    split.setThemeConstantOverride('separation', 6);
    split.setRect({ position: new math.Vector2(174, 462), size: new math.Vector2(120, 38) });
    split.parent = card;
    for (const value of [left, right]) {
      value.horizontalAlignment = HorizontalAlignment.Center;
      value.verticalAlignment = VerticalAlignment.Center;
      value.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    }
    verticalSeparator.setSizeFlags(SizeFlags.Fill, SizeFlags.ExpandFill);
    left.parent = split;
    verticalSeparator.parent = split;
    right.parent = split;
  }
}
