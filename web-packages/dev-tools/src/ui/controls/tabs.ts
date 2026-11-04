import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Container, PanelContainer, VBoxContainer } from '@galacean/effects-plugin-gui';
import type { EditorIcon } from '../icons/control-icons';
import { editorBox, editorColors } from '../theme/control-theme';
import { append, expand, place, row } from './layout';
import { EditorPanelTab } from './panel-tab';
import { setTooltip } from './tooltip';

class TabBody extends Container {
  protected override sortChildren (): void { for (const child of this.children) { if (child.visible) { place(child, 0, 0, this.width, this.height); } } }
}
export class EditorTabs extends VBoxContainer {
  private readonly bar;
  private readonly body: TabBody;
  private readonly tabs: { button: EditorPanelTab, control: Control }[] = [];
  private active = 0;
  constructor (engine: Engine) {
    super(engine); this.setThemeConstantOverride('separation', 0);
    const panel = append(this, new PanelContainer(engine));

    panel.setThemeStyleBoxOverride('panel', editorBox(editorColors.title));
    this.bar = append(panel, row(engine, [], 0)); this.body = append(this, expand(new TabBody(engine)));
  }
  addTab (title: string, control: Control, icon?: EditorIcon): void {
    const index = this.tabs.length, button = append(this.bar, new EditorPanelTab(this.engine, title, icon));

    button.themeTypeVariation = 'EditorStaticTab'; button.setCustomMinimumSize(96, 25); setTooltip(button, title); append(this.body, control);
    this.tabs.push({ button, control }); button.on('pressed', () => this.select(index)); this.select(this.active);
  }
  select (index: number): void {
    this.active = index;
    this.tabs.forEach((tab, i) => { tab.control.visible = i === index; tab.button.setPressedNoSignal(i === index); });
    this.body.queueSort();
  }
}
