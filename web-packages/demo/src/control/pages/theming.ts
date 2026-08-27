import type { Engine } from '@galacean/effects';
import { Control, math } from '@galacean/effects';
import {
  Button,
  AutowrapMode,
  CheckBox,
  CheckButton,
  GUIStyle,
  HSlider,
  HorizontalAlignment,
  Label,
  Panel,
  ProgressBar,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import type { AccentName } from '../theme';
import { ACCENTS, getTheme } from '../theme';
import { addSectionTitle, createButton, createSegmentedControl, styleSlider } from '../widgets';
import { label } from './common';

const ACCENT_NAMES: AccentName[] = ['blue', 'indigo', 'emerald', 'amber', 'rose'];

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

      button.normalColor = accent;
      button.hoverColor = accent;
      button.pressedColor = accent;
      button.borderColor = ctx.state.customAccent === null && ctx.state.accent === name
        ? theme.textPrimary
        : theme.borderSubtle;
      button.borderWidth = ctx.state.customAccent === null && ctx.state.accent === name ? 3 : 1;
      button.textColor = theme.textOnAccent;
      button.setRect({ position: new math.Vector2(20 + index * 57, 202), size: new math.Vector2(48, 42) });
      button.parent = panel;
      button.on('pressed', () => {
        ctx.state.accent = name;
        ctx.state.customAccent = null;
        ctx.requestRebuild();
      });
      label(this.engine, name, 20 + index * 57, 248, 48, 18, panel, {
        size: 9,
        color: theme.textSecondary,
        horizontal: HorizontalAlignment.Center,
      });
    });

    const currentAccent = ctx.state.customAccent
      ? `Custom RGB ${ctx.state.customAccent.map(value => value.toFixed(0)).join(', ')}`
      : `Preset: ${ctx.state.accent}`;

    label(this.engine, currentAccent, 20, 286, 282, 28, panel, {
      size: 12,
      color: theme.textPrimary,
      weight: 600,
      horizontal: HorizontalAlignment.Center,
    });

    label(this.engine, 'WHY THE TREE REBUILDS', 20, 342, 210, 20, panel, {
      size: 10,
      color: theme.textTertiary,
      weight: 650,
    });
    label(
      this.engine,
      'GUI controls copy GUIStyle.current when constructed. Rebuilding lets every native control pick up the new palette consistently.',
      20,
      370,
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

    reset.setRect({ position: new math.Vector2(20, 452), size: new math.Vector2(282, 36) });
    reset.parent = panel;
  }

  private buildSemantics (panel: Panel): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'GUIStyle snapshot', 'Controls keep the style values copied at construction');
    const original = label(this.engine, 'Existing Label — original color', 20, 80, 282, 32, panel, {
      size: 13,
      color: theme.textPrimary,
      weight: 600,
    });
    let created: Label | null = null;
    const action = createButton(this.engine, 'Mutate style and create a Label', () => {
      GUIStyle.current.textColor = theme.danger;
      created?.dispose();
      created = new Label(this.engine, 'New Label — copied danger color');
      created.fontSize = 13;
      created.fontWeight = 600;
      created.setRect({ position: new math.Vector2(20, 124), size: new math.Vector2(282, 32) });
      created.parent = panel;
      original.text = 'Existing Label — unchanged';
    }, 'primary');

    action.setRect({ position: new math.Vector2(20, 174), size: new math.Vector2(282, 38) });
    action.parent = panel;
    label(this.engine, 'A theme change restores GUIStyle before creating the next tree.', 20, 220, 282, 42, panel, {
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
    const checked = new CheckBox(this.engine, 'Checked');
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
