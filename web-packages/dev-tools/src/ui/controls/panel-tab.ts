import type { Engine } from '@galacean/effects';
import { Button, HorizontalAlignment } from '@galacean/effects-plugin-gui';
import type { ContentInsets } from '@galacean/effects-plugin-gui';
import { paintIcon, type EditorIcon } from '../icons/control-icons';
import { editorMetrics } from '../theme/control-theme';

export class EditorPanelTab extends Button {
  constructor (engine: Engine, text: string, public iconName?: EditorIcon, private readonly documentTab = false) {
    super(engine, text); this.themeTypeVariation = 'EditorDockTab'; this.clipText = true; this.textAlignment = HorizontalAlignment.Left;
    this.setCustomMinimumSize(0, documentTab ? 32 : editorMetrics.tabHeight);
  }
  protected override getContentInsets (): ContentInsets {
    return { left: 4 + (this.iconName && this.width >= 28 ? this.documentTab ? 29 : 23 : 0), top: this.documentTab ? 4 : 3, right: 0, bottom: 4 };
  }
  protected override drawDecoration (): void {
    if (this.iconName && this.width >= 28) { paintIcon(this, this.iconName, this.documentTab ? 8 : 5, (this.height - (this.documentTab ? 16 : 17)) / 2, 16, this.getThemeColor('fontColor')); }
  }
}
