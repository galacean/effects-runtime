import type { Engine } from '@galacean/effects';
import { ButtonDrawMode, HBoxContainer, Label, SizeFlags, VerticalAlignment, VSeparator } from '@galacean/effects-plugin-gui';
import { EditorIconButton } from '../icons/control-icons';
import type { EditorIcon } from '../icons/control-icons';
import { editorColors, editorMetrics } from '../theme/control-theme';
import { append } from './layout';

export class EditorToolbar extends HBoxContainer {
  constructor (engine: Engine, height = editorMetrics.toolbarHeight) {
    super(engine); this.setCustomMinimumSize(0, height); this.setThemeConstantOverride('separation', 4);
  }
  separator (): VSeparator {
    const separator = append(this, new VSeparator(this.engine));

    separator.setCustomMinimumSize(1, 20); separator.verticalSizeFlags = SizeFlags.ShrinkCenter;

    return separator;
  }
  label (text: string): Label {
    const caption = append(this, new Label(this.engine, text));

    caption.verticalAlignment = VerticalAlignment.Center;

    return caption;
  }
  override draw (): void { this.fillRect(0, 0, this.width, this.height, editorColors.toolbar); }
}

export class EditorToggleButton extends EditorIconButton {
  constructor (engine: Engine, icon: EditorIcon, private readonly read: () => boolean, private readonly write: (value: boolean) => void, text = '') {
    super(engine, icon, text); this.toggleMode = true; this.themeTypeVariation = 'EditorToggleButton';
    this.on('toggled', value => this.write(value));
  }
  override update (delta: number): void { this.setPressedNoSignal(this.read()); super.update(delta); }
  override getDrawMode (): ButtonDrawMode {
    if (this.disabled || !this.enabledInHierarchy) { return ButtonDrawMode.Disabled; }
    // Checked and unchecked presses share the neutral toolbar background.
    if (this.isPressing()) { return ButtonDrawMode.Hover; }

    return this.buttonPressed ? this.isHovered() ? ButtonDrawMode.HoverPressed : ButtonDrawMode.Pressed : this.isHovered() ? ButtonDrawMode.Hover : ButtonDrawMode.Normal;
  }
}

export class EditorViewportToggleButton extends EditorToggleButton {
  constructor (engine: Engine, icon: EditorIcon, read: () => boolean, write: (value: boolean) => void) {
    super(engine, icon, read, write); this.themeTypeVariation = 'EditorViewportToggleButton';
  }
  override update (delta: number): void {
    super.update(delta); this.iconTint = this.buttonPressed ? editorColors.dropTarget : editorColors.foreground;
  }
  override getDrawMode (): ButtonDrawMode {
    return this.disabled || !this.enabledInHierarchy ? ButtonDrawMode.Disabled : this.isPressing() ? ButtonDrawMode.Pressed : this.isHovered() ? ButtonDrawMode.Hover : ButtonDrawMode.Normal;
  }
}
