import type { Engine } from '@galacean/effects';
import { Control, math } from '@galacean/effects';
import {
  ColorRect,
  HSlider,
  HorizontalAlignment,
  Label,
  Panel,
  ProgressBar,
  ProgressFillMode,
  VSlider,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import { getTheme, setFlatStyleOverride, setFontOverrides } from '../theme';
import { addSectionTitle, createButton, createSegmentedControl, styleSlider } from '../widgets';
import { label } from './common';

export class SlidersPage extends Control {
  constructor (engine: Engine, ctx: AppContext) {
    super(engine);
    const linked = new Panel(engine);
    const mixer = new Panel(engine);

    attachAnchoredRect(linked, this, 0, 0, 0.5, 1, 0, 0, 8, 0);
    attachAnchoredRect(mixer, this, 0.5, 0, 1, 1, 8, 0, 0, 0);
    this.buildLinked(linked, ctx);
    this.buildMixer(mixer, ctx);
  }

  private buildLinked (panel: Panel, ctx: AppContext): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'Shared Range', 'HSlider, VSlider and ProgressBar share one value');
    const value = label(this.engine, '', 20, 76, 150, 34, panel, {
      size: 22,
      color: theme.textPrimary,
      weight: 680,
    });
    const horizontal = styleSlider(new HSlider(this.engine));
    const vertical = styleSlider(new VSlider(this.engine));
    const progress = new ProgressBar(this.engine);
    const dragState = label(this.engine, 'Ready to drag', 20, 202, 250, 24, panel, {
      size: 11,
      color: theme.textSecondary,
    });

    horizontal.share(vertical);
    horizontal.share(progress);
    horizontal.setValueNoSignal(ctx.state.sliders.linked);
    horizontal.setRect({ position: new math.Vector2(20, 124), size: new math.Vector2(242, 20) });
    vertical.setRect({ position: new math.Vector2(286, 80), size: new math.Vector2(18, 112) });
    progress.setRect({ position: new math.Vector2(20, 160), size: new math.Vector2(242, 28) });
    [horizontal, vertical, progress].forEach(control => {
      control.parent = panel;
    });
    const update = (next: number): void => {
      ctx.state.sliders.linked = next;
      value.text = `${Math.round(next)} / 100`;
    };

    update(horizontal.value);
    horizontal.on('valueChanged', update);
    horizontal.on('dragStarted', () => {
      dragState.text = 'Dragging horizontal slider';
      dragState.setThemeColorOverride('fontColor', theme.accent);
    });
    horizontal.on('dragEnded', changed => {
      dragState.text = changed ? 'Value committed' : 'Value unchanged';
      dragState.setThemeColorOverride('fontColor', theme.textSecondary);
    });
    vertical.on('dragStarted', () => {
      dragState.text = 'Dragging vertical slider';
      dragState.setThemeColorOverride('fontColor', theme.accent);
    });
    vertical.on('dragEnded', () => {
      dragState.text = 'Ready to drag';
      dragState.setThemeColorOverride('fontColor', theme.textSecondary);
    });

    label(this.engine, 'STEP = 5', 20, 250, 140, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const stepped = styleSlider(new HSlider(this.engine));
    const stepValue = label(this.engine, '', 20, 300, 282, 24, panel, {
      size: 11,
      color: theme.textSecondary,
    });

    stepped.step = 5;
    stepped.setValueNoSignal(ctx.state.sliders.step);
    stepped.setRect({ position: new math.Vector2(20, 278), size: new math.Vector2(282, 18) });
    stepped.parent = panel;
    const updateStep = (next: number): void => {
      ctx.state.sliders.step = next;
      stepValue.text = `${next.toFixed(0)} — snapped to the nearest step`;
    };

    updateStep(stepped.value);
    stepped.on('valueChanged', updateStep);

    label(this.engine, 'PROGRESS FILL MODE', 20, 348, 180, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const fillPreview = new ProgressBar(this.engine);
    const modes = [
      ProgressFillMode.BeginToEnd,
      ProgressFillMode.EndToBegin,
      ProgressFillMode.TopToBottom,
      ProgressFillMode.BottomToTop,
    ];
    const segmented = createSegmentedControl(this.engine, ['→', '←', '↓', '↑'], 0, index => {
      fillPreview.fillMode = modes[index];
    });

    segmented.control.setRect({ position: new math.Vector2(20, 376), size: new math.Vector2(282, 32) });
    segmented.control.parent = panel;
    fillPreview.value = 68;
    fillPreview.setRect({ position: new math.Vector2(20, 420), size: new math.Vector2(282, 30) });
    fillPreview.parent = panel;
  }

  private buildMixer (panel: Panel, ctx: AppContext): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'RGB values', 'Three HSliders update a ColorRect preview');
    const preview = new ColorRect(this.engine);
    const hex = new Label(this.engine);

    preview.setRect({ position: new math.Vector2(20, 78), size: new math.Vector2(282, 82) });
    preview.parent = panel;
    setFontOverrides(hex, { size: 13, weight: 650, color: theme.textPrimary });
    hex.horizontalAlignment = HorizontalAlignment.Center;
    hex.setRect({ position: new math.Vector2(20, 170), size: new math.Vector2(282, 28) });
    hex.parent = panel;
    const channelColors = [
      new math.Color(0.86, 0.20, 0.24, 1),
      new math.Color(0.10, 0.64, 0.36, 1),
      new math.Color(0.15, 0.39, 0.92, 1),
    ];
    const updatePreview = (): void => {
      const [red, green, blue] = ctx.state.sliders.rgb;

      preview.color = new math.Color(red / 255, green / 255, blue / 255, 1);
      hex.text = `#${[red, green, blue].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    };

    ctx.state.sliders.rgb.forEach((initial, index) => {
      const channel = styleSlider(new HSlider(this.engine));
      const channelValue = label(this.engine, String(initial), 260, 214 + index * 60, 42, 34, panel, {
        size: 11,
        color: theme.textSecondary,
        horizontal: HorizontalAlignment.Right,
      });

      channel.maxValue = 255;
      channel.step = 1;
      setFlatStyleOverride(channel, 'fill', { background: channelColors[index] });
      channel.setValueNoSignal(initial);
      channel.setRect({ position: new math.Vector2(50, 222 + index * 60), size: new math.Vector2(198, 18) });
      channel.parent = panel;
      label(this.engine, ['R', 'G', 'B'][index], 20, 214 + index * 60, 24, 34, panel, {
        size: 11,
        color: channelColors[index],
        weight: 700,
      });
      channel.on('valueChanged', next => {
        ctx.state.sliders.rgb[index] = next;
        channelValue.text = next.toFixed(0);
        updatePreview();
      });
    });
    updatePreview();
    const apply = createButton(this.engine, 'Use as accent color', () => {
      ctx.state.customAccent = [...ctx.state.sliders.rgb] as [number, number, number];
      ctx.requestRebuild();
    }, 'primary');

    apply.setRect({ position: new math.Vector2(20, 408), size: new math.Vector2(282, 38) });
    apply.parent = panel;
    label(this.engine, 'The Control tree rebuild keeps current values.', 20, 454, 282, 24, panel, {
      size: 10,
      color: theme.textSecondary,
      horizontal: HorizontalAlignment.Center,
    });
  }
}
