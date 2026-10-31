import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Button, Container, VBoxContainer } from '@galacean/effects-plugin-gui';
import { append, expand, place, row } from './layout';

class TabBody extends Container {
  protected override sortChildren (): void { for (const child of this.children) { if (child.visible) { place(child, 0, 0, this.width, this.height); } } }
}
export class EditorTabs extends VBoxContainer {
  private readonly bar;
  private readonly body: TabBody;
  private readonly tabs: { title: string, button: Button, control: Control }[] = [];
  private active = 0;
  constructor (engine: Engine) { super(engine); this.bar = append(this, row(engine, [], 1)); this.body = append(this, expand(new TabBody(engine))); }
  addTab (title: string, control: Control): void {
    const index = this.tabs.length, button = append(this.bar, new Button(this.engine, title));

    button.themeTypeVariation = 'EditorToolbarButton'; append(this.body, control);
    this.tabs.push({ title, button, control }); button.on('pressed', () => this.select(index)); this.select(this.active);
  }
  select (index: number): void {
    this.active = index;
    this.tabs.forEach((tab, i) => { tab.control.visible = i === index; tab.button.setPressedNoSignal(i === index); });
    this.body.queueSort();
  }
}
