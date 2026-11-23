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
  private readonly shapeTools = element('shape-tools');
  private readonly penTools = element('pen-tools');
  private readonly layerButtons = new Map<VFXItem, HTMLButtonElement>();
  private readonly toolButtons: [HTMLElement, DemoTool][] = [
    [element('move'), 'move'],
    [element('hand'), 'hand'],
    [element('create-frame'), 'frame'],
    [element('create-text'), 'text'],
    [element('create-pen'), 'pen'],
    [element('create-shape'), 'shape'],
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
    this.events.on(element('menu-pen'), 'click', () => editor.setTool('pen'));
    this.events.on(element('menu-shape'), 'click', () => editor.setTool('shape'));
    for (const primitive of ['rect', 'ellipse', 'polygon', 'star'] as const) {
      this.events.on(element(`shape-${primitive}`), 'click', () => editor.setShapePrimitive(primitive));
    }
    for (const [id, mode] of [['pen-mirror-angle-length', 'angle-length'], ['pen-mirror-angle', 'angle'], ['pen-mirror-none', 'none']] as const) {
      this.events.on(element(id), 'click', () => editor.setPenMirrorMode(mode));
    }
    this.events.on(element('pen-lasso'), 'click', () => editor.setPenLassoMode(!editor.penLasso));
    this.events.on(element('pen-edit-mode'), 'click', () => editor.setPenEditMode(!editor.penEditMode));
    for (const [suffix, kind] of [['video', 'Video'], ['effects', 'Effects']] as const) {
      for (const prefix of ['menu', 'create']) {
        this.events.on(element(`${prefix}-${suffix}`), 'click', () => {
          this.setCreateMenuOpen(false);
          void editor.addMedia(kind);
        });
      }
    }
    this.events.on(element('zoom-out'), 'click', () => editor.zoom(1 / 1.2));
    this.events.on(element('zoom-in'), 'click', () => editor.zoom(1.2));
    this.events.on(element('fit-view'), 'click', () => editor.fitToView());
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
    this.toolButtons.forEach(([button, value]) => {
      const pressed = value === 'pen'
        ? tool === 'pen' && !this.editor.penEditMode
        : tool === value;

      button.setAttribute('aria-pressed', String(pressed));
    });
    this.shapeTools.hidden = tool !== 'shape';
    this.penTools.hidden = tool !== 'pen';
    for (const primitive of ['rect', 'ellipse', 'polygon', 'star'] as const) {
      element(`shape-${primitive}`).setAttribute('aria-pressed', String(tool === 'shape' && this.editor.primitive === primitive));
    }
    for (const mode of ['angle-length', 'angle', 'none'] as const) {
      element(`pen-mirror-${mode}`).setAttribute('aria-pressed', String(tool === 'pen' && this.editor.penMirror === mode));
    }
    element('pen-lasso').setAttribute('aria-pressed', String(tool === 'pen' && this.editor.penLasso));
    element('pen-edit-mode').setAttribute('aria-pressed', String(tool === 'pen' && this.editor.penEditMode));
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

    const icons: Record<DemoItem['kind'], string> = { Frame: 'frame', Text: 'text', Sprite: 'rectangle', Vector: 'shape', CustomShape: 'pen', Video: 'video', Effects: 'effects' };

    use.setAttribute('href', `#icon-${icons[data.kind]}`);
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(use);
    label.className = 'layer-name';
    label.textContent = data.name + (data.status === 'loading' ? ' · 加载中' : data.status === 'error' ? ' · 加载失败' : '');
    button.type = 'button';
    button.dataset.itemId = data.item.getInstanceId();
    button.style.paddingLeft = `${12 + depth * 18}px`;
    button.setAttribute('aria-pressed', 'false');
    button.append(icon, label);

    return button;
  }
}
