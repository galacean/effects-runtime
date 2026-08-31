import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import {
  AutowrapMode,
  ButtonGroup,
  Checkbox,
  CheckButton,
  Control,
  HorizontalAlignment,
  Panel,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import { getTheme, setFlatStyleOverride } from '../theme';
import { addSectionTitle } from '../widgets';
import { label } from './common';

export class SelectionPage extends Control {
  constructor (engine: Engine, ctx: AppContext) {
    super(engine);
    const choices = new Panel(engine);
    const settings = new Panel(engine);

    attachAnchoredRect(choices, this, 0, 0, 0.5, 1, 0, 0, 8, 0);
    attachAnchoredRect(settings, this, 0.5, 0, 1, 1, 8, 0, 0, 0);
    this.buildChoices(choices, ctx);
    this.buildSettings(settings, ctx);
  }

  private buildChoices (card: Panel, ctx: AppContext): void {
    const theme = getTheme();

    addSectionTitle(this.engine, card, 'Multiple selection', 'Checkbox values with a select-all controller');
    const summary = label(this.engine, '', 20, 294, 294, 52, card, {
      size: 12,
      color: theme.textSecondary,
      vertical: 1,
      autowrap: AutowrapMode.WordSmart,
    });
    const itemLabels = ['Animation', 'Interaction', 'Post-processing'];
    const items = itemLabels.map((text, index) => {
      const checkbox = new Checkbox(this.engine, text);

      checkbox.setPressedNoSignal(ctx.state.selection.multi[index]);
      checkbox.setRect({ position: new math.Vector2(20, 132 + index * 48), size: new math.Vector2(294, 36) });
      checkbox.parent = card;

      return checkbox;
    });
    const master = new Checkbox(this.engine, 'Select all capabilities');

    master.setPressedNoSignal(ctx.state.selection.multi.every(Boolean));
    setFlatStyleOverride(master, 'normal', { background: theme.accentSoft });
    master.setRect({ position: new math.Vector2(20, 80), size: new math.Vector2(294, 38) });
    master.parent = card;

    const update = (): void => {
      const count = ctx.state.selection.multi.filter(Boolean).length;

      summary.text = count === 0
        ? 'No capabilities selected'
        : `${count} selected · ${itemLabels.filter((_text, index) => ctx.state.selection.multi[index]).join(', ')}`;
      master.setPressedNoSignal(count === items.length);
    };

    master.on('toggled', pressed => {
      items.forEach((item, index) => {
        item.setPressedNoSignal(pressed);
        ctx.state.selection.multi[index] = pressed;
      });
      update();
    });
    items.forEach((item, index) => {
      item.on('toggled', pressed => {
        ctx.state.selection.multi[index] = pressed;
        update();
      });
    });
    update();

    const disabled = new Checkbox(this.engine, 'Unavailable capability');

    disabled.disabled = true;
    disabled.setRect({ position: new math.Vector2(20, 374), size: new math.Vector2(294, 36) });
    disabled.parent = card;
  }

  private buildSettings (card: Panel, ctx: AppContext): void {
    const theme = getTheme();

    addSectionTitle(this.engine, card, 'Single choice and switches', 'ButtonGroup radio behavior and CheckButton states');
    label(this.engine, 'PLAN', 20, 78, 120, 20, card, { size: 10, color: theme.textTertiary, weight: 700 });
    const group = new ButtonGroup();
    const plans = ['Starter', 'Studio', 'Enterprise'];
    const details = ['For prototypes · 3 projects', 'For teams · unlimited projects', 'For orgs · SSO and audit logs'];
    const detail = label(this.engine, details[ctx.state.selection.plan], 20, 228, 294, 38, card, {
      size: 12,
      color: theme.textSecondary,
    });

    plans.forEach((text, index) => {
      const radio = new Checkbox(this.engine, text);

      radio.buttonGroup = group;
      radio.setPressedNoSignal(index === ctx.state.selection.plan);
      radio.setRect({ position: new math.Vector2(20, 104 + index * 40), size: new math.Vector2(294, 34) });
      radio.parent = card;
      radio.on('toggled', pressed => {
        if (pressed) {
          ctx.state.selection.plan = index;
          detail.text = details[index];
        }
      });
    });

    label(this.engine, 'FEATURE SWITCHES', 20, 282, 220, 20, card, {
      size: 10,
      color: theme.textTertiary,
      weight: 700,
    });
    const switchLabels = ['Autosave', 'Live collaboration', 'Usage analytics'];

    switchLabels.forEach((text, index) => {
      const toggle = new CheckButton(this.engine, text);

      toggle.setPressedNoSignal(ctx.state.selection.switches[index]);
      toggle.setRect({ position: new math.Vector2(20, 310 + index * 46), size: new math.Vector2(294, 36) });
      toggle.parent = card;
      toggle.on('toggled', pressed => {
        ctx.state.selection.switches[index] = pressed;
      });
    });

    const disabled = new CheckButton(this.engine, 'Managed by administrator');

    disabled.disabled = true;
    disabled.textAlignment = HorizontalAlignment.Left;
    disabled.setRect({ position: new math.Vector2(20, 450), size: new math.Vector2(294, 36) });
    disabled.parent = card;
  }
}
