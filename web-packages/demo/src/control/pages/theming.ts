import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import {
  Button,
  AutowrapMode,
  Checkbox,
  CheckButton,
  Control,
  HSlider,
  HorizontalAlignment,
  Label,
  Panel,
  ProgressBar,
  Theme,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import type { AccentName } from '../theme';
import { ACCENTS, getTheme, setFlatStyleOverride, setFontOverrides } from '../theme';
import { addSectionTitle, createButton, createSegmentedControl, styleSlider } from '../widgets';
import { label } from './common';

const ACCENT_NAMES: AccentName[] = ['blue', 'indigo', 'emerald', 'amber', 'orange', 'rose', 'gray'];

export class ThemingPage extends Control {
  constructor (engine: Engine, ctx: AppContext) {
    super(engine);
    const appearance = new Panel(engine);
    const semantics = new Panel(engine);

    attachAnchoredRect(appearance, this, 0, 0, 0.5, 1, 0, 0, 8, 0);
    attachAnchoredRect(semantics, this, 0.5, 0, 1, 1, 8, 0, 0, 0);
    this.buildAppearance(appearance, ctx);
    this.buildSemantics(semantics);
  }

  private buildAppearance (panel: Panel, ctx: AppContext): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'Appearance', 'Theme and accent changes rebuild the Control tree');
    label(this.engine, 'COLOR MODE', 20, 78, 150, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const themeSelector = createSegmentedControl(
      this.engine,
      ['Light', 'Dark'],
      ctx.state.theme === 'light' ? 0 : 1,
      index => {
        ctx.state.theme = index === 0 ? 'light' : 'dark';
        ctx.requestRebuild();
      },
    );

    themeSelector.control.setRect({ position: new math.Vector2(20, 106), size: new math.Vector2(282, 36) });
    themeSelector.control.parent = panel;

    label(this.engine, 'ACCENT COLOR', 20, 172, 150, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    ACCENT_NAMES.forEach((name, index) => {
      const button = new Button(this.engine, name.slice(0, 1).toUpperCase());
      const accent = ACCENTS[name][ctx.state.theme];
      const column = index % 4;
      const row = Math.floor(index / 4);

      const border = ctx.state.customAccent === null && ctx.state.accent === name
        ? theme.textPrimary
        : theme.borderSubtle;
      const borderWidth = ctx.state.customAccent === null && ctx.state.accent === name ? 3 : 1;

      for (const state of ['normal', 'hover', 'pressed', 'hoverPressed']) {
        setFlatStyleOverride(button, state, { background: accent, border, borderWidth });
      }
      setFontOverrides(button, { color: theme.textOnAccent });
      button.setRect({ position: new math.Vector2(20 + column * 72, 202 + row * 68), size: new math.Vector2(56, 42) });
      button.parent = panel;
      button.on('pressed', () => {
        ctx.state.accent = name;
        ctx.state.customAccent = null;
        ctx.requestRebuild();
      });
      label(this.engine, name, 20 + column * 72, 248 + row * 68, 56, 18, panel, {
        size: 9,
        color: theme.textSecondary,
        horizontal: HorizontalAlignment.Center,
      });
    });

    const currentAccent = ctx.state.customAccent
      ? `Custom RGB ${ctx.state.customAccent.map(value => value.toFixed(0)).join(', ')}`
      : `Preset: ${ctx.state.accent}`;

    label(this.engine, currentAccent, 20, 344, 282, 28, panel, {
      size: 12,
      color: theme.textPrimary,
      weight: 600,
      horizontal: HorizontalAlignment.Center,
    });

    label(this.engine, 'WHY THE TREE REBUILDS', 20, 390, 210, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    label(
      this.engine,
      'A Theme attached to a root or subtree is inherited live. This gallery still rebuilds to refresh its content-level color tokens.',
      20,
      418,
      282,
      68,
      panel,
      { size: 11, color: theme.textSecondary, autowrap: AutowrapMode.WordSmart },
    );
    const reset = createButton(this.engine, 'Reset custom accent', () => {
      ctx.state.customAccent = null;
      ctx.state.accent = 'blue';
      ctx.requestRebuild();
    });

    reset.setRect({ position: new math.Vector2(20, 500), size: new math.Vector2(282, 36) });
    reset.parent = panel;
  }

  private buildSemantics (panel: Panel): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'Tree Theme update', 'Existing controls resolve inherited values live');
    const localTheme = new Theme();
    const original = new Label(this.engine, 'Existing Label — inherited color');

    panel.theme = localTheme;
    original.parent = panel;
    setFontOverrides(original, { weight: 600 });
    original.setRect({ position: new math.Vector2(20, 80), size: new math.Vector2(282, 32) });
    let created: Label | null = null;
    const action = createButton(this.engine, 'Update subtree Theme', () => {
      localTheme.setColor('Label', 'fontColor', theme.danger);
      created?.dispose();
      created = new Label(this.engine, 'New Label — same inherited color');
      created.parent = panel;
      setFontOverrides(created, { weight: 600 });
      created.setRect({ position: new math.Vector2(20, 124), size: new math.Vector2(282, 32) });
      original.text = 'Existing Label — updated live';
    }, 'primary');

    action.setRect({ position: new math.Vector2(20, 174), size: new math.Vector2(282, 38) });
    action.parent = panel;
    label(this.engine, 'The local Theme affects only this panel subtree; sibling Canvas and Player trees remain isolated.', 20, 220, 282, 42, panel, {
      size: 11,
      color: theme.textSecondary,
      autowrap: AutowrapMode.WordSmart,
    });

    label(this.engine, 'NATIVE CONTROL SAMPLE', 20, 280, 220, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    const normal = new Button(this.engine, 'Normal');
    const disabled = new Button(this.engine, 'Disabled');
    const checked = new Checkbox(this.engine, 'Checked');
    const toggle = new CheckButton(this.engine, 'Switch');
    const slider = styleSlider(new HSlider(this.engine));
    const progress = new ProgressBar(this.engine);

    normal.setRect({ position: new math.Vector2(20, 310), size: new math.Vector2(134, 36) });
    disabled.setRect({ position: new math.Vector2(168, 310), size: new math.Vector2(134, 36) });
    disabled.disabled = true;
    checked.setPressedNoSignal(true);
    checked.setRect({ position: new math.Vector2(20, 358), size: new math.Vector2(134, 36) });
    toggle.setPressedNoSignal(true);
    toggle.setRect({ position: new math.Vector2(168, 358), size: new math.Vector2(134, 36) });
    slider.value = 62;
    slider.setRect({ position: new math.Vector2(20, 416), size: new math.Vector2(282, 18) });
    progress.value = 62;
    progress.setRect({ position: new math.Vector2(20, 452), size: new math.Vector2(282, 28) });
    [normal, disabled, checked, toggle, slider, progress].forEach(control => {
      control.parent = panel;
    });
  }
}
