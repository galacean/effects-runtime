import type { Engine } from '@galacean/effects';
import type { math } from '@galacean/effects';
import {
  ColorPicker,
  Control,
  LineEdit,
  Panel,
  TextEdit,
  TextOverflow,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect } from '../layout';
import { getTheme, setFlatStyleOverride } from '../theme';
import { label } from './common';

export class TextColorPage extends Control {
  constructor (engine: Engine, _ctx: AppContext) {
    super(engine);
    const theme = getTheme();
    const singleLinePanel = new Panel(engine);
    const multilinePanel = new Panel(engine);
    const colorPanel = new Panel(engine);

    attachAnchoredRect(singleLinePanel, this, 0, 0, 0.47, 0.44, 0, 0, 8, 8);
    attachAnchoredRect(multilinePanel, this, 0, 0.44, 0.47, 1, 0, 8, 8, 0);
    attachAnchoredRect(colorPanel, this, 0.47, 0, 1, 1, 8, 0, 0, 0);
    this.addSectionTitle(singleLinePanel, 'Single-line input', 'Caret, selection, validation-friendly placeholders and secret text.');
    this.addSectionTitle(multilinePanel, 'Multiline input', 'Line navigation, selection, clipboard, undo history and scrolling.');
    this.addSectionTitle(colorPanel, 'Color input', 'HSV controls, alpha, channels and hexadecimal values in one editor.');

    const name = new LineEdit(engine, 'Effects Runtime');

    name.placeholderText = 'Project name';
    attachAnchoredRect(name, singleLinePanel, 0, 0, 0.62, 0, 20, 82, 6, -116);
    const secret = new LineEdit(engine, 'runtime-gui');

    secret.secret = true;
    secret.placeholderText = 'Access token';
    attachAnchoredRect(secret, singleLinePanel, 0.62, 0, 1, 0, 6, 82, 20, -116);
    const inputStatus = label(engine, 'Drag across text to select it, then type to replace the selection.', 20, 136, 402, 28, singleLinePanel, {
      size: 10,
      color: theme.textTertiary,
      overflow: TextOverflow.Ellipsis,
    });

    inputStatus.setAnchorMax(1, 0);
    inputStatus.setOffsetMax(-20, 164);
    name.on('textChanged', value => { inputStatus.text = `LineEdit changed · ${value.length} characters`; });
    secret.on('textChanged', value => { inputStatus.text = `Secret field changed · ${value.length} characters`; });

    const notes = new TextEdit(engine, 'LineEdit handles precise single-line values.\nTextEdit adds multiline caret movement, selection and scrolling.');

    notes.placeholderText = 'Write release notes…';
    attachAnchoredRect(notes, multilinePanel, 0, 0, 1, 1, 20, 82, 20, 64);
    const noteStatus = label(engine, '2 lines', 20, -48, 402, 28, multilinePanel, {
      size: 10,
      color: theme.textTertiary,
      overflow: TextOverflow.Ellipsis,
    });

    noteStatus.setAnchorMin(0, 1);
    noteStatus.setAnchorMax(1, 1);
    noteStatus.setOffsetMin(20, -48);
    noteStatus.setOffsetMax(-20, -20);
    notes.on('textChanged', value => { noteStatus.text = `${value.split('\n').length} lines · ${value.length} characters`; });

    const picker = new ColorPicker(engine);
    const colorValue = label(engine, '', 20, -52, 420, 28, colorPanel, {
      size: 10,
      color: theme.textSecondary,
      overflow: TextOverflow.Ellipsis,
    });

    picker.color = theme.accent;
    attachAnchoredRect(picker, colorPanel, 0, 0, 1, 1, 20, 78, 20, 62);
    colorValue.setAnchorMin(0, 1);
    colorValue.setAnchorMax(1, 1);
    colorValue.setOffsetMin(20, -52);
    colorValue.setOffsetMax(-20, -24);
    const updateColor = (value: math.Color): void => {
      colorValue.text = `RGBA ${Math.round(value.r * 255)}, ${Math.round(value.g * 255)}, ${Math.round(value.b * 255)}, ${value.a.toFixed(2)}`;
    };

    updateColor(picker.color);
    picker.on('colorChanged', updateColor);
  }

  private addSectionTitle (parent: Panel, title: string, description: string): void {
    const theme = getTheme();

    setFlatStyleOverride(parent, 'panel', { background: theme.panelBg, border: theme.borderSubtle });
    const heading = label(this.engine, title, 20, 16, 420, 26, parent, {
      size: 15,
      color: theme.textPrimary,
      weight: 680,
    });
    const copy = label(this.engine, description, 20, 43, 420, 24, parent, {
      size: 10,
      color: theme.textSecondary,
      overflow: TextOverflow.Ellipsis,
    });

    heading.setAnchorMax(1, 0);
    heading.setOffsetMax(-20, 42);
    copy.setAnchorMax(1, 0);
    copy.setOffsetMax(-20, 67);
  }
}
