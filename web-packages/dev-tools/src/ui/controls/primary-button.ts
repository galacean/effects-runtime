import type { Engine } from '@galacean/effects';
import { Button } from '@galacean/effects-plugin-gui';

export class EditorPrimaryButton extends Button {
  constructor (engine: Engine, text = '') { super(engine, text); this.themeTypeVariation = 'EditorPrimaryButton'; this.setCustomMinimumSize(0, 22); }
}
