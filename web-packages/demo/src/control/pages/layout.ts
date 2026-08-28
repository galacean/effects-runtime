import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import type {
  Button } from '@galacean/effects-plugin-gui';
import {
  AspectRatioContainer,
  ButtonGroup,
  Control,
  GridContainer,
  HBoxContainer,
  HSlider,
  HorizontalAlignment,
  Label,
  LayoutAlignment,
  MarginContainer,
  Panel,
  SizeFlags,
  VBoxContainer,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect, attachFullRect } from '../layout';
import type { LayoutKind } from '../state';
import { getTheme, setFlatStyleOverride, setFontOverrides } from '../theme';
import { addSectionTitle, createButton, createSegmentedControl, createToggle, styleSlider } from '../widgets';
import type { ResizeCorner } from './common';
import { ResizeHandle, label } from './common';

export class LayoutPage extends Control {
  private readonly stage: Panel;
  private readonly host: MarginContainer;
  private readonly modeLabel: Label;
  private readonly selectedLabel: Label;
  private layout: VBoxContainer | HBoxContainer | GridContainer | null = null;
  private readonly items: Button[] = [];
  private initialized = false;
  private fixedX = 0;
  private fixedY = 0;
  private activeCorner: ResizeCorner = 'se';

  constructor (engine: Engine, private readonly ctx: AppContext) {
    super(engine);
    const theme = getTheme();
    const controls = new Panel(engine);

    attachAnchoredRect(controls, this, 0, 0, 0.36, 1, 0, 0, 8, 0);
    this.stage = new Panel(engine);
    setFlatStyleOverride(this.stage, 'panel', { border: theme.accent });
    this.stage.parent = this;
    this.modeLabel = new Label(engine);
    setFontOverrides(this.modeLabel, { size: 12, weight: 650, color: theme.textPrimary });
    this.modeLabel.verticalAlignment = VerticalAlignment.Center;
    this.modeLabel.setRect({ position: new math.Vector2(16, 12), size: new math.Vector2(180, 28) });
    this.modeLabel.parent = this.stage;
    this.selectedLabel = new Label(engine);
    setFontOverrides(this.selectedLabel, { size: 11, color: theme.textSecondary });
    this.selectedLabel.horizontalAlignment = HorizontalAlignment.Right;
    this.selectedLabel.verticalAlignment = VerticalAlignment.Center;
    attachAnchoredRect(this.selectedLabel, this.stage, 1, 0, 1, 0, -150, 12, 16, -40);
    this.host = new MarginContainer(engine);
    attachFullRect(this.host, this.stage, 16, 52, 16, 16);
    this.buildControls(controls);
    this.addResizeHandles();
    this.rebuildLayout();
    this.on('sizeChanged', () => this.layoutForPageSize());
  }

  beginResize (corner: ResizeCorner): void {
    const stageRect = this.stage.getRect();

    this.activeCorner = corner;
    this.fixedX = corner.endsWith('w') ? stageRect.position.x + stageRect.size.x : stageRect.position.x;
    this.fixedY = corner.startsWith('n') ? stageRect.position.y + stageRect.size.y : stageRect.position.y;
  }

  resizeFromPointer (corner: ResizeCorner): void {
    if (corner !== this.activeCorner) {
      return;
    }
    const pointer = this.getLocalMousePosition();
    const west = corner.endsWith('w');
    const north = corner.startsWith('n');
    const minimumWidth = Math.min(320, Math.max(260, this.width - 440));
    const minimumHeight = Math.min(240, Math.max(190, this.height - 230));
    const leftBoundary = this.width * 0.36 + 16;
    const left = west ? Math.max(leftBoundary, Math.min(pointer.x, this.fixedX - minimumWidth)) : this.fixedX;
    const right = west ? this.fixedX : Math.min(this.width, Math.max(pointer.x, this.fixedX + minimumWidth));
    const top = north ? Math.max(0, Math.min(pointer.y, this.fixedY - minimumHeight)) : this.fixedY;
    const bottom = north ? this.fixedY : Math.min(this.height, Math.max(pointer.y, this.fixedY + minimumHeight));

    this.stage.setRect({
      position: new math.Vector2(left, top),
      size: new math.Vector2(Math.max(1, right - left), Math.max(1, bottom - top)),
    });
  }

  private buildControls (panel: Panel): void {
    const theme = getTheme();

    addSectionTitle(this.engine, panel, 'Container settings', 'Adjust layout properties live', 20, 18, 210);
    label(this.engine, 'CONTAINER', 20, 72, 140, 20, panel, { size: 10, color: theme.textTertiary, weight: 650 });
    const kinds: LayoutKind[] = ['vbox', 'hbox', 'grid'];
    const kind = createSegmentedControl(this.engine, ['VBox', 'HBox', 'Grid'], kinds.indexOf(this.ctx.state.layout.kind), index => {
      this.ctx.state.layout.kind = kinds[index];
      this.rebuildLayout();
    });

    kind.control.setRect({ position: new math.Vector2(20, 98), size: new math.Vector2(204, 32) });
    kind.control.parent = panel;

    label(this.engine, 'SEPARATION', 20, 146, 130, 20, panel, { size: 10, color: theme.textTertiary, weight: 650 });
    const separation = styleSlider(new HSlider(this.engine));
    const separationValue = label(this.engine, '', 170, 168, 54, 24, panel, {
      size: 10,
      color: theme.textSecondary,
      horizontal: HorizontalAlignment.Right,
    });

    separation.minValue = 4;
    separation.maxValue = 24;
    separation.step = 2;
    separation.setValueNoSignal(this.ctx.state.layout.separation);
    separation.setRect({ position: new math.Vector2(20, 174), size: new math.Vector2(140, 18) });
    separation.parent = panel;
    separationValue.text = `${separation.value.toFixed(0)} px`;
    separation.on('valueChanged', value => {
      this.ctx.state.layout.separation = value;
      separationValue.text = `${value.toFixed(0)} px`;
      this.applyMetrics();
    });

    label(this.engine, 'GRID COLUMNS', 20, 208, 130, 20, panel, { size: 10, color: theme.textTertiary, weight: 650 });
    const columns = styleSlider(new HSlider(this.engine));
    const columnValue = label(this.engine, '', 170, 230, 54, 24, panel, {
      size: 10,
      color: theme.textSecondary,
      horizontal: HorizontalAlignment.Right,
    });

    columns.minValue = 1;
    columns.maxValue = 4;
    columns.step = 1;
    columns.setValueNoSignal(this.ctx.state.layout.columns);
    columns.setRect({ position: new math.Vector2(20, 236), size: new math.Vector2(140, 18) });
    columns.parent = panel;
    columnValue.text = columns.value.toFixed(0);
    columns.on('valueChanged', value => {
      this.ctx.state.layout.columns = value;
      columnValue.text = value.toFixed(0);
      this.applyMetrics();
    });

    label(this.engine, 'ALIGNMENT', 20, 270, 130, 20, panel, { size: 10, color: theme.textTertiary, weight: 650 });
    const alignment = createSegmentedControl(this.engine, ['Begin', 'Center', 'End'], this.ctx.state.layout.alignment, index => {
      this.ctx.state.layout.alignment = index;
      this.applyMetrics();
    });

    alignment.control.setRect({ position: new math.Vector2(20, 296), size: new math.Vector2(204, 30) });
    alignment.control.parent = panel;

    label(this.engine, 'ITEM COUNT', 20, 342, 120, 20, panel, { size: 10, color: theme.textTertiary, weight: 650 });
    const count = label(this.engine, `${this.ctx.state.layout.itemCount} items`, 78, 366, 88, 32, panel, {
      size: 11,
      color: theme.textSecondary,
      horizontal: HorizontalAlignment.Center,
    });
    const remove = createButton(this.engine, '−', () => {
      this.ctx.state.layout.itemCount = Math.max(1, this.ctx.state.layout.itemCount - 1);
      count.text = `${this.ctx.state.layout.itemCount} items`;
      this.rebuildLayout();
    });
    const add = createButton(this.engine, '+', () => {
      this.ctx.state.layout.itemCount = Math.min(8, this.ctx.state.layout.itemCount + 1);
      count.text = `${this.ctx.state.layout.itemCount} items`;
      this.rebuildLayout();
    }, 'primary');

    remove.setRect({ position: new math.Vector2(20, 366), size: new math.Vector2(48, 32) });
    add.setRect({ position: new math.Vector2(176, 366), size: new math.Vector2(48, 32) });
    remove.parent = panel;
    add.parent = panel;
    const reverse = createToggle(this.engine, 'Reverse order', this.ctx.state.layout.reverse, checked => {
      this.ctx.state.layout.reverse = checked;
      this.rebuildLayout();
    });

    reverse.setRect({ position: new math.Vector2(20, 410), size: new math.Vector2(204, 34) });
    reverse.parent = panel;

    const aspect = new AspectRatioContainer(this.engine);
    const aspectPanel = new Panel(this.engine);
    const aspectLabel = new Label(this.engine, '16:9 AspectRatioContainer');

    aspect.ratio = 16 / 9;
    aspect.setRect({ position: new math.Vector2(20, 454), size: new math.Vector2(204, 48) });
    aspect.parent = panel;
    setFlatStyleOverride(aspectPanel, 'panel', { background: theme.accentSoft });
    aspect.addChild(aspectPanel);
    setFontOverrides(aspectLabel, { size: 10, color: theme.accent });
    aspectLabel.horizontalAlignment = HorizontalAlignment.Center;
    aspectLabel.verticalAlignment = VerticalAlignment.Center;
    attachFullRect(aspectLabel, aspectPanel);
  }

  private addResizeHandles (): void {
    for (const corner of ['nw', 'ne', 'sw', 'se'] as ResizeCorner[]) {
      const handle = new ResizeHandle(
        this.engine,
        corner,
        selected => this.beginResize(selected),
        selected => this.resizeFromPointer(selected),
      );
      const west = corner.endsWith('w');
      const north = corner.startsWith('n');
      const anchorX = west ? 0 : 1;
      const anchorY = north ? 0 : 1;

      attachAnchoredRect(handle, this.stage, anchorX, anchorY, anchorX, anchorY, -8, -8, -8, -8);
    }
  }

  private rebuildLayout (): void {
    this.items.length = 0;
    this.ctx.state.layout.selectedItem = Math.min(this.ctx.state.layout.selectedItem, this.ctx.state.layout.itemCount - 1);
    this.layout?.dispose();
    if (this.ctx.state.layout.kind === 'hbox') {
      this.layout = new HBoxContainer(this.engine);
    } else if (this.ctx.state.layout.kind === 'grid') {
      this.layout = new GridContainer(this.engine);
    } else {
      this.layout = new VBoxContainer(this.engine);
    }
    this.host.addChild(this.layout);
    this.applyMetrics();
    const group = new ButtonGroup();

    for (let slot = 0; slot < this.ctx.state.layout.itemCount; slot++) {
      const index = this.ctx.state.layout.reverse
        ? this.ctx.state.layout.itemCount - slot
        : slot + 1;
      const item = createButton(this.engine, String(index));

      item.toggleMode = true;
      item.buttonGroup = group;
      item.setPressedNoSignal(index - 1 === this.ctx.state.layout.selectedItem);
      item.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
      item.on('toggled', pressed => {
        if (pressed) {
          this.ctx.state.layout.selectedItem = index - 1;
          this.updateHeader();
        }
      });
      this.layout.addChild(item);
      this.items.push(item);
    }
    this.updateHeader();
  }

  private applyMetrics (): void {
    if (this.layout instanceof GridContainer) {
      this.layout.columns = this.ctx.state.layout.columns;
      this.layout.setThemeConstantOverride('horizontalSeparation', this.ctx.state.layout.separation);
      this.layout.setThemeConstantOverride('verticalSeparation', this.ctx.state.layout.separation);
    } else if (this.layout) {
      this.layout.setThemeConstantOverride('separation', this.ctx.state.layout.separation);
      this.layout.alignment = [LayoutAlignment.Begin, LayoutAlignment.Center, LayoutAlignment.End][this.ctx.state.layout.alignment];
    }
    this.updateHeader();
  }

  private updateHeader (): void {
    this.modeLabel.text = `${this.ctx.state.layout.kind.toUpperCase()} · ${this.ctx.state.layout.itemCount} items`;
    this.selectedLabel.text = `Selected ${this.ctx.state.layout.selectedItem + 1}`;
  }

  private resetStage (): void {
    const left = this.width * 0.36 + 16;

    this.stage.setRect({
      position: new math.Vector2(left, 0),
      size: new math.Vector2(Math.max(320, this.width - left), Math.max(260, this.height)),
    });
  }

  private layoutForPageSize (): void {
    if (this.width < 480 || this.height < 320) {
      return;
    }
    if (!this.initialized) {
      this.initialized = true;
      this.resetStage();

      return;
    }
    const rect = this.stage.getRect();
    const leftBoundary = this.width * 0.36 + 16;
    const width = Math.min(rect.size.x, Math.max(1, this.width - leftBoundary));
    const height = Math.min(rect.size.y, Math.max(1, this.height));
    const x = Math.max(leftBoundary, Math.min(rect.position.x, this.width - width));
    const y = Math.max(0, Math.min(rect.position.y, this.height - height));

    this.stage.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
  }
}
