import type { Engine } from '@galacean/effects';
import { HorizontalAlignment } from '@galacean/effects-plugin-gui';
import { EditorMenuButton } from './menu';

export interface EditorChoice<T> { label: string, value: T, enabled?: boolean }

export class EditorComboBox<T> extends EditorMenuButton {
  constructor (engine: Engine, private readonly choices: readonly EditorChoice<T>[], private readonly read: () => T, write: (value: T) => void) {
    super(engine, ''); this.themeTypeVariation = 'EditorComboButton'; this.showArrow = true; this.clipText = true; this.textAlignment = HorizontalAlignment.Left;
    this.actions = () => this.choices.map(choice => ({ label: choice.label, checked: choice.value === this.read(), enabled: choice.enabled, action: () => write(choice.value) }));
    this.refresh();
  }
  refresh (): void { this.text = this.choices.find(choice => choice.value === this.read())?.label ?? 'None'; }
  override update (delta: number): void { this.refresh(); super.update(delta); }
}
