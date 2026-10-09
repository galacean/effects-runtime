import type { VFXItem } from '@galacean/effects';
import { DOMEvents, element } from './dom';
import type { DemoEditor, DemoTool } from './editor';
import { InspectorPanel } from './inspector';
import type { DemoItem, DemoScene } from './scene';

/** 展示工具栏、图层与操作记录，并将 DOM 操作交给编辑器。 */
export class DemoView {
  private readonly events = new DOMEvents();
  private readonly inspector: InspectorPanel;
  private readonly layerList = element('items');
  private readonly status = element('status');
  private readonly zoom = element('zoom');
  private readonly actionList = element('events');
  private readonly createMenu = element('create-menu');
  private readonly createToggle = element('create-toggle');
  private readonly layerButtons = new Map<VFXItem, HTMLButtonElement>();
  private readonly toolButtons: [HTMLElement, DemoTool][] = [
    [element('move'), 'move'],
    [element('hand'), 'hand'],
    [element('create-frame'), 'frame'],
    [element('create-text'), 'text'],
  ];
  private readonly actions: { label: string, count: number }[] = [];
  private selectionSignature = '';

  constructor (private readonly scene: DemoScene, private readonly editor: DemoEditor) {
    this.inspector = new InspectorPanel(scene, editor);
    this.toolButtons.forEach(([button, tool]) => {
      this.events.on(button, 'click', () => editor.setTool(tool));
    });
    this.events.on(element('menu-frame'), 'click', () => editor.setTool('frame'));
    this.events.on(element('menu-text'), 'click', () => editor.setTool('text'));
    this.events.on(element('zoom-out'), 'click', () => editor.zoom(1 / 1.2));
    this.events.on(element('zoom-in'), 'click', () => editor.zoom(1.2));
    this.events.on(this.createToggle, 'click', () => this.setCreateMenuOpen(this.createMenu.hidden));
    this.events.on(document, 'pointerdown', event => {
      if (event.target instanceof Node && !this.createMenu.contains(event.target) && !this.createToggle.contains(event.target)) {
        this.setCreateMenuOpen(false);
      }
    });
    this.events.on(this.layerList, 'click', event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-item-id]') : null;
      const data = button?.dataset.itemId ? scene.getItemById(button.dataset.itemId) : undefined;

      if (data) {
        editor.select(data.item, event.shiftKey);
      }
    });
    this.refreshScene();
    this.showTool(editor.tool);
  }

  refreshScene (): void {
    this.renderLayers();
    this.refreshSelection();
    if (!this.status.dataset.error) {
      this.status.textContent = `已就绪 · ${this.scene.getItems().length} 个图层`;
    }
  }

  refreshSelection (): void {
    this.inspector.refresh();
    const selected = this.editor.selectedItems;
    const signature = JSON.stringify(selected.map(item => item.getInstanceId()));

    if (signature !== this.selectionSignature) {
      this.selectionSignature = signature;
      this.layerButtons.forEach((button, item) => button.setAttribute('aria-pressed', String(selected.includes(item))));
    }
  }

  showTool (tool: DemoTool): void {
    this.toolButtons.forEach(([button, value]) => button.setAttribute('aria-pressed', String(tool === value)));
    this.setCreateMenuOpen(false);
  }

  showZoom (scale: number): void {
    this.zoom.textContent = `${Math.round(scale * 100)}%`;
  }

  recordAction (label: string): void {
    if (this.actions[0]?.label === label) {
      this.actions[0].count++;
    } else {
      this.actions.unshift({ label, count: 1 });
      this.actions.length = Math.min(this.actions.length, 12);
    }
    this.actionList.replaceChildren(...this.actions.map(action => {
      const row = document.createElement('li');

      row.textContent = `${action.label}${action.count > 1 ? ` ×${action.count}` : ''}`;

      return row;
    }));
    this.refreshSelection();
  }

  dispose (): void {
    this.events.dispose();
    this.inspector.dispose();
    this.layerButtons.clear();
  }

  private setCreateMenuOpen (open: boolean): void {
    this.createMenu.hidden = !open;
    this.createToggle.setAttribute('aria-expanded', String(open));
  }

  private renderLayers (): void {
    const items = this.scene.getItems();
    const registered = new Set(items.map(data => data.item));
    const children = new Map<VFXItem, DemoItem[]>();
    const roots: DemoItem[] = [];

    items.forEach(data => {
      const parent = data.item.parent;

      if (parent && registered.has(parent)) {
        const siblings = children.get(parent) ?? [];

        siblings.push(data);
        children.set(parent, siblings);
      } else {
        roots.push(data);
      }
    });
    this.layerButtons.clear();
    const rows: HTMLButtonElement[] = [];
    const appendRow = (data: DemoItem, depth: number): void => {
      const button = this.createLayerButton(data, depth);

      this.layerButtons.set(data.item, button);
      rows.push(button);
      children.get(data.item)?.forEach(child => appendRow(child, depth + 1));
    };

    roots.forEach(data => appendRow(data, 0));
    this.layerList.replaceChildren(...rows);
    this.selectionSignature = '';
  }

  private createLayerButton (data: DemoItem, depth: number): HTMLButtonElement {
    const button = document.createElement('button');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    const label = document.createElement('span');

    use.setAttribute('href', `#icon-${data.kind === 'Frame' ? 'frame' : data.kind === 'Text' ? 'text' : 'rectangle'}`);
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(use);
    label.className = 'layer-name';
    label.textContent = data.name;
    button.type = 'button';
    button.dataset.itemId = data.item.getInstanceId();
    button.style.paddingLeft = `${12 + depth * 18}px`;
    button.setAttribute('aria-pressed', 'false');
    button.append(icon, label);

    return button;
  }
}
