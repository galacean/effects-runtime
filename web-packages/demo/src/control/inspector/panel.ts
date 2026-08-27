import type {
  Engine,
  InputEventKey,
  InputEventMouseButton,
} from '@galacean/effects';
import {
  MouseButton,
  math,
} from '@galacean/effects';
import {
  AutowrapMode,
  Button,
  CheckBox,
  ColorRect,
  Control,
  CursorShape,
  FocusMode,
  GridContainer,
  HSlider,
  HorizontalAlignment,
  Label,
  MouseFilter,
  Panel,
  ScrollContainer,
  ScrollMode,
  SizeFlags,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { InspectorControlType } from '../state';
import type { ThemeTokens } from '../theme';
import { mix, setFlatStyleOverride, setFontOverrides, withAlpha } from '../theme';
import type { InspectorProperty } from './schema';

type RefreshBinding = {
  refresh(): void,
};

type PropertyNode = {
  name: string,
  path: string,
  properties: InspectorProperty[],
  children: Map<string, PropertyNode>,
};

const PANEL_WIDTH = 340;
const CONTENT_WIDTH = PANEL_WIDTH - 20;

export class ControlInspectorPanel extends Panel {
  private readonly objectTitle: Label;
  private readonly description: Label;
  private readonly propertyScroll: ScrollContainer;
  private readonly bindings: RefreshBinding[] = [];
  private readonly openSections = new Map<string, boolean>();
  private content: Control | null = null;
  private target: Control | null = null;
  private properties: InspectorProperty[] = [];
  private type: InspectorControlType;
  private propertyRowIndex = 0;

  constructor (
    engine: Engine,
    type: InspectorControlType,
    private readonly tokens: ThemeTokens,
    private readonly resetControl: () => void,
  ) {
    super(engine);
    this.type = type;
    setFlatStyleOverride(this, 'panel', { background: tokens.panelBg, border: tokens.borderSubtle });
    this.clipContents = true;

    this.addLabel('INSPECTOR', 14, 10, 210, 16, 9, tokens.textTertiary, 700);
    this.objectTitle = this.addLabel('', 14, 28, 210, 24, 15, tokens.textPrimary, 680);
    const reset = this.createButton('Reset', () => this.resetControl());

    reset.setRect({ position: new math.Vector2(264, 24), size: new math.Vector2(54, 27) });
    reset.parent = this;
    this.description = this.addLabel('', 14, 54, 304, 32, 10, tokens.textSecondary, 450);
    this.description.autowrapMode = AutowrapMode.WordSmart;
    this.description.verticalAlignment = VerticalAlignment.Top;

    const divider = new ColorRect(engine);

    divider.color = tokens.borderSubtle;
    divider.setRect({ position: new math.Vector2(0, 91), size: new math.Vector2(PANEL_WIDTH, 1) });
    divider.parent = this;

    this.propertyScroll = new ScrollContainer(engine);
    this.propertyScroll.horizontalScrollMode = ScrollMode.Disabled;
    this.propertyScroll.verticalScrollMode = ScrollMode.Auto;
    this.propertyScroll.setAnchorMin(0, 0);
    this.propertyScroll.setAnchorMax(1, 1);
    this.propertyScroll.setOffsetMin(0, 92);
    this.propertyScroll.setOffsetMax(0, 0);
    this.propertyScroll.parent = this;
    this.updateTypeHeader();
  }

  setTarget (type: InspectorControlType, target: Control, properties: InspectorProperty[]): void {
    this.type = type;
    this.target = target;
    this.properties = properties;
    this.openSections.clear();
    this.updateTypeHeader();
    this.rebuildProperties();
  }

  refresh (): void {
    for (const binding of this.bindings) {
      binding.refresh();
    }
  }

  private rebuildProperties (): void {
    this.content?.dispose();
    this.bindings.length = 0;
    const content = new Control(this.engine);
    const categories = this.buildPropertyTree();
    let y = 0;

    content.mouseFilter = MouseFilter.Pass;
    content.parent = this.propertyScroll;
    this.content = content;
    this.propertyRowIndex = 0;
    for (const category of categories.values()) {
      const header = this.createCategoryHeader(category.name);

      header.setRect({ position: new math.Vector2(0, y), size: new math.Vector2(CONTENT_WIDTH, 32) });
      header.parent = content;
      y += 32;
      y = this.appendPropertyRows(content, category.properties, y, 0);
      for (const section of category.children.values()) {
        y = this.appendSection(content, section, y, 0);
      }
    }
    content.setCustomMinimumSize(CONTENT_WIDTH, Math.max(y, 1));
    this.propertyScroll.vScroll = 0;
    this.refresh();
  }

  private createCategoryHeader (name: string): Panel {
    const header = new Panel(this.engine);
    const accent = new ColorRect(this.engine);

    setFlatStyleOverride(header, 'panel', {
      background: mix(this.tokens.panelBg, this.tokens.panelRaisedBg, 0.72), borderWidth: 0,
    });
    accent.color = this.tokens.accent;
    accent.setRect({ position: new math.Vector2(0, 0), size: new math.Vector2(3, 32) });
    accent.parent = header;
    this.addLabelTo(header, name, 11, 0, CONTENT_WIDTH - 20, 32, 11, this.tokens.textPrimary, 680);

    return header;
  }

  private createSectionHeader (section: PropertyNode, open: boolean, depth: number): Button {
    const indent = 7 + depth * 12;
    const button = this.createButton(`${open ? '▾' : '▸'}  ${section.name}`, () => {
      this.openSections.set(section.path, !open);
      this.rebuildProperties();
    });

    button.flat = true;
    button.textAlignment = HorizontalAlignment.Left;
    setFontOverrides(button, { size: 10, weight: 650 });
    setFlatStyleOverride(button, 'normal', {
      background: mix(this.tokens.panelBg, this.tokens.panelRaisedBg, 0.42),
      borderWidth: 0,
      horizontalMargin: indent + 4,
    });
    setFlatStyleOverride(button, 'hover', {
      background: mix(this.tokens.panelRaisedBg, this.tokens.accentSoft, 0.35),
      borderWidth: 0,
      horizontalMargin: indent + 4,
    });
    for (const state of ['pressed', 'hoverPressed']) {
      setFlatStyleOverride(button, state, {
        background: this.tokens.accentSoft, borderWidth: 0, horizontalMargin: indent + 4,
      });
    }

    return button;
  }

  private appendSection (parent: Control, section: PropertyNode, y: number, depth: number): number {
    const open = this.openSections.get(section.path) ?? false;
    const header = this.createSectionHeader(section, open, depth);

    header.setRect({ position: new math.Vector2(0, y), size: new math.Vector2(CONTENT_WIDTH, 28) });
    header.parent = parent;
    y += 28;
    if (!open) {
      return y;
    }
    y = this.appendPropertyRows(parent, section.properties, y, depth + 1);
    for (const child of section.children.values()) {
      y = this.appendSection(parent, child, y, depth + 1);
    }

    return y;
  }

  private appendPropertyRows (
    parent: Control,
    properties: InspectorProperty[],
    y: number,
    depth: number,
  ): number {
    for (const property of properties) {
      const rowHeight = getPropertyRowHeight(property);
      const row = this.createPropertyRow(property, rowHeight, depth);

      row.setRect({ position: new math.Vector2(0, y), size: new math.Vector2(CONTENT_WIDTH, rowHeight) });
      row.parent = parent;
      y += rowHeight;
    }

    return y;
  }

  private createPropertyRow (property: InspectorProperty, height: number, depth: number): Panel {
    const row = new Panel(this.engine);
    const stacked = property.kind === 'rect2' || property.kind === 'flags' || property.kind === 'color';
    const labelHeight = stacked ? 24 : height;
    const indent = depth * 10;

    setFlatStyleOverride(row, 'panel', {
      background: this.propertyRowIndex++ % 2 === 0
        ? this.tokens.panelBg
        : mix(this.tokens.panelBg, this.tokens.panelRaisedBg, 0.28),
      border: withAlpha(this.tokens.borderSubtle, 0.55),
      borderWidth: 0,
    });
    this.addLabelTo(
      row,
      humanize(property.name),
      12 + indent, 0, stacked ? CONTENT_WIDTH - 24 - indent : 142 - indent, labelHeight,
      10, this.tokens.textSecondary, 450,
    );

    if (property.kind === 'boolean') {
      this.createBooleanEditor(row, property, 164, Math.max(4, (height - 24) * 0.5));
    } else if (property.kind === 'number') {
      this.createNumberEditor(row, property, 164, 5, 142, 25);
    } else if (property.kind === 'vector2') {
      this.createVectorEditor(row, property, 150, 5, 156, 25);
    } else if (property.kind === 'rect2') {
      this.createRectEditor(row, property, 12, 26, 286, 27);
    } else if (property.kind === 'enum') {
      this.createEnumEditor(row, property, 164, 5, 142, 25);
    } else if (property.kind === 'flags') {
      this.createFlagsEditor(row, property, 12, 25, 286, height - 29);
    } else if (property.kind === 'text') {
      this.createTextEditor(row, property, 150, 5, 156, height - 10);
    } else {
      this.createColorEditor(row, property, 12, 25, 286, height - 29);
    }

    return row;
  }

  private createBooleanEditor (
    parent: Control,
    property: Extract<InspectorProperty, { kind: 'boolean' }>,
    x: number,
    y: number,
  ): void {
    const editor = new CheckBox(this.engine);

    editor.flat = true;
    for (const state of ['normal', 'hover', 'pressed', 'hoverPressed', 'disabled']) {
      setFlatStyleOverride(editor, state, { horizontalMargin: 5 });
    }
    editor.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(32, 24) });
    editor.parent = parent;
    editor.on('toggled', value => {
      if (this.target) {
        property.setValue(this.target, value);
        this.refresh();
      }
    });
    this.bindings.push({
      refresh: () => {
        if (this.target) {
          editor.setPressedNoSignal(property.getValue(this.target));
        }
      },
    });
  }

  private createNumberEditor (
    parent: Control,
    property: Extract<InspectorProperty, { kind: 'number' }>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const suffixWidth = property.suffix ? 22 : 0;
    const editor = new InspectorTextField(this.engine, this.tokens);

    editor.numeric = true;
    editor.step = property.step ?? 1;
    editor.changed = value => {
      const number = Number(value);

      if (this.target && value.trim() !== '' && Number.isFinite(number)) {
        property.setValue(this.target, number);
      }
    };
    editor.stepped = direction => {
      if (this.target) {
        property.setValue(this.target, property.getValue(this.target) + direction * (property.step ?? 1));
        this.refresh();
      }
    };
    editor.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width - suffixWidth, height) });
    editor.parent = parent;
    if (property.suffix) {
      this.addLabelTo(
        parent, property.suffix, x + width - suffixWidth + 4, y,
        suffixWidth - 4, height, 9, this.tokens.textTertiary, 450,
      );
    }
    this.bindings.push({
      refresh: () => {
        if (this.target && !editor.isEditing) {
          editor.setText(formatNumber(property.getValue(this.target)));
        }
      },
    });
  }

  private createVectorEditor (
    parent: Control,
    property: Extract<InspectorProperty, { kind: 'vector2' }>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const fieldWidth = (width - 30) * 0.5;
    const fields = ['X', 'Y'].map((axis, index) => {
      const axisX = x + index * (fieldWidth + 15);
      const field = new InspectorTextField(this.engine, this.tokens);

      this.addLabelTo(parent, axis, axisX, y, 13, height, 9, index === 0 ? this.tokens.danger : this.tokens.success, 700);
      field.numeric = true;
      field.step = property.step ?? 1;
      field.changed = value => {
        const number = Number(value);

        if (!this.target || value.trim() === '' || !Number.isFinite(number)) {
          return;
        }
        const vector = property.getValue(this.target);

        vector[index] = number;
        property.setValue(this.target, vector);
      };
      field.stepped = direction => {
        if (!this.target) {
          return;
        }
        const vector = property.getValue(this.target);

        vector[index] += direction * (property.step ?? 1);
        property.setValue(this.target, vector);
        this.refresh();
      };
      field.setRect({ position: new math.Vector2(axisX + 14, y), size: new math.Vector2(fieldWidth, height) });
      field.parent = parent;

      return field;
    });

    this.bindings.push({
      refresh: () => {
        if (!this.target) {
          return;
        }
        const vector = property.getValue(this.target);

        fields.forEach((field, index) => {
          if (!field.isEditing) {
            field.setText(formatNumber(vector[index]));
          }
        });
      },
    });
  }

  private createRectEditor (
    parent: Control,
    property: Extract<InspectorProperty, { kind: 'rect2' }>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const axes = ['X', 'Y', 'W', 'H'];
    const colors = [this.tokens.danger, this.tokens.success, this.tokens.warning, this.tokens.violet];
    const fieldWidth = (width - 52) * 0.25;
    const fields = axes.map((axis, index) => {
      const fieldX = x + index * (fieldWidth + 13);
      const field = new InspectorTextField(this.engine, this.tokens);

      this.addLabelTo(parent, axis, fieldX, y, 12, height, 8, colors[index], 700);
      field.numeric = true;
      field.step = property.step ?? 1;
      field.changed = value => {
        const number = Number(value);

        if (!this.target || value.trim() === '' || !Number.isFinite(number)) {
          return;
        }
        const rect = property.getValue(this.target);

        rect[index] = index >= 2 && property.sizeMin !== undefined
          ? Math.max(property.sizeMin, number)
          : number;
        property.setValue(this.target, rect);
      };
      field.setRect({ position: new math.Vector2(fieldX + 12, y), size: new math.Vector2(fieldWidth, height) });
      field.parent = parent;

      return field;
    });

    this.bindings.push({
      refresh: () => {
        if (!this.target) {
          return;
        }
        const rect = property.getValue(this.target);

        fields.forEach((field, index) => {
          if (!field.isEditing) {
            field.setText(formatNumber(rect[index]));
          }
        });
      },
    });
  }

  private createEnumEditor (
    parent: Control,
    property: Extract<InspectorProperty, { kind: 'enum' }>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const editor = this.createButton('', () => {
      if (!this.target) {
        return;
      }
      const current = property.getValue(this.target);
      const index = Math.max(0, property.options.findIndex(option => option.value === current));
      const next = property.options[(index + 1) % property.options.length];

      property.setValue(this.target, next.value);
      this.refresh();
    });

    editor.textAlignment = HorizontalAlignment.Left;
    for (const state of ['normal', 'hover', 'pressed', 'hoverPressed', 'disabled']) {
      setFlatStyleOverride(editor, state, { horizontalMargin: 8 });
    }
    editor.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
    editor.parent = parent;
    this.bindings.push({
      refresh: () => {
        if (!this.target) {
          return;
        }
        const value = property.getValue(this.target);
        const option = property.options.find(item => item.value === value);

        editor.text = `${option?.label ?? String(value)}  ›`;
      },
    });
  }

  private createFlagsEditor (
    parent: Control,
    property: Extract<InspectorProperty, { kind: 'flags' }>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const grid = new GridContainer(this.engine);
    const editors: CheckBox[] = [];

    grid.columns = 2;
    grid.setThemeConstantOverride('horizontalSeparation', 4);
    grid.setThemeConstantOverride('verticalSeparation', 2);
    grid.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
    grid.parent = parent;
    for (const option of property.options) {
      const editor = new CheckBox(this.engine, option.label);

      editor.setThemeFontSizeOverride('fontSize', 9);
      editor.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
      editor.on('toggled', () => {
        if (!this.target) {
          return;
        }
        const value = editors.reduce((result, checkbox, index) => {
          return checkbox.buttonPressed ? result | Number(property.options[index].value) : result;
        }, 0);

        property.setValue(this.target, value);
        this.refresh();
      });
      editor.parent = grid;
      editors.push(editor);
    }
    this.bindings.push({
      refresh: () => {
        if (!this.target) {
          return;
        }
        const value = property.getValue(this.target);

        editors.forEach((editor, index) => {
          editor.setPressedNoSignal((value & Number(property.options[index].value)) !== 0);
        });
      },
    });
  }

  private createTextEditor (
    parent: Control,
    property: Extract<InspectorProperty, { kind: 'text' }>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const editor = new InspectorTextField(this.engine, this.tokens);

    editor.multiline = property.multiline ?? false;
    editor.changed = value => {
      if (this.target) {
        property.setValue(this.target, value);
      }
    };
    editor.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
    editor.parent = parent;
    this.bindings.push({
      refresh: () => {
        if (this.target && !editor.isEditing) {
          editor.setText(property.getValue(this.target));
        }
      },
    });
  }

  private createColorEditor (
    parent: Control,
    property: Extract<InspectorProperty, { kind: 'color' }>,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const swatch = new ColorRect(this.engine);
    const channels: Array<'r' | 'g' | 'b' | 'a'> = ['r', 'g', 'b', 'a'];
    const channelColors = [this.tokens.danger, this.tokens.success, this.tokens.accent, this.tokens.textSecondary];
    const sliders: HSlider[] = [];
    const values: Label[] = [];

    swatch.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(38, height) });
    swatch.parent = parent;
    channels.forEach((channel, index) => {
      const rowY = y + index * 22;
      const slider = new HSlider(this.engine);
      const valueLabel = this.addLabelTo(
        parent, '', x + width - 34, rowY, 34, 20,
        9, this.tokens.textSecondary, 550,
      );

      this.addLabelTo(parent, channel.toUpperCase(), x + 46, rowY, 14, 20, 9, channelColors[index], 700);
      slider.minValue = 0;
      slider.maxValue = 1;
      slider.step = 0.01;
      setFlatStyleOverride(slider, 'fill', { background: channelColors[index] });
      slider.setRect({ position: new math.Vector2(x + 62, rowY + 2), size: new math.Vector2(width - 100, 16) });
      slider.parent = parent;
      slider.on('valueChanged', value => {
        if (!this.target) {
          return;
        }
        const current = property.getValue(this.target);
        const color = new math.Color(current.r, current.g, current.b, current.a);

        color[channel] = value;
        property.setValue(this.target, color);
        this.refresh();
      });
      sliders.push(slider);
      values.push(valueLabel);
    });
    this.bindings.push({
      refresh: () => {
        if (!this.target) {
          return;
        }
        const color = property.getValue(this.target);

        swatch.color.copyFrom(color);
        channels.forEach((channel, index) => {
          sliders[index].setValueNoSignal(color[channel]);
          values[index].text = color[channel].toFixed(2);
        });
      },
    });
  }

  private buildPropertyTree (): Map<string, PropertyNode> {
    const roots = new Map<string, PropertyNode>();
    const controlGroups = ['Layout', 'Focus', 'Mouse', 'Theme Overrides'];
    const specificProperties = this.properties.filter(property => {
      return !controlGroups.includes(property.group.split('/')[0].trim());
    });
    const controlProperties = controlGroups.flatMap(group => {
      return this.properties.filter(property => property.group.split('/')[0].trim() === group);
    });

    for (const property of [...specificProperties, ...controlProperties]) {
      const groupParts = property.group.split('/').map(part => part.trim()).filter(Boolean);
      const parts = controlGroups.includes(groupParts[0]) ? ['Control', ...groupParts] : groupParts;
      let nodes = roots;
      let path = '';
      let node: PropertyNode | undefined;

      for (const part of parts) {
        path = path ? `${path}/${part}` : part;
        node = nodes.get(part);
        if (!node) {
          node = { name: part, path, properties: [], children: new Map() };
          nodes.set(part, node);
        }
        nodes = node.children;
      }
      node?.properties.push(property);
    }

    return roots;
  }

  private updateTypeHeader (): void {
    this.objectTitle.text = this.type;
    this.description.text = `${this.properties.length} editable properties`;
  }

  private createButton (text: string, pressed: () => void): Button {
    const button = new Button(this.engine, text);

    setFontOverrides(button, { size: 10, weight: 600, color: this.tokens.textPrimary });
    setFlatStyleOverride(button, 'normal', {
      background: this.tokens.panelRaisedBg, border: this.tokens.borderSubtle,
    });
    setFlatStyleOverride(button, 'hover', {
      background: mix(this.tokens.panelRaisedBg, this.tokens.accentSoft, 0.45),
      border: this.tokens.borderSubtle,
    });
    for (const state of ['pressed', 'hoverPressed']) {
      setFlatStyleOverride(button, state, {
        background: this.tokens.accentSoft, border: this.tokens.borderSubtle,
      });
    }
    button.on('pressed', pressed);

    return button;
  }

  private addLabel (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    color: math.Color,
    weight: number,
  ): Label {
    return this.addLabelTo(this, text, x, y, width, height, size, color, weight);
  }

  private addLabelTo (
    parent: Control,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    color: math.Color,
    weight: number,
  ): Label {
    const label = new Label(this.engine, text);

    setFontOverrides(label, { size, weight, color });
    label.textOverflow = TextOverflow.Ellipsis;
    label.verticalAlignment = VerticalAlignment.Center;
    label.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
    label.parent = parent;

    return label;
  }
}

class InspectorTextField extends Control {
  changed?: (value: string) => void;
  stepped?: (direction: number) => void;
  multiline = false;
  numeric = false;
  step = 1;
  private value = '';
  private selectAll = false;

  constructor (engine: Engine, private readonly tokens: ThemeTokens) {
    super(engine);
    this.focusMode = FocusMode.All;
    this.mouseFilter = MouseFilter.Stop;
    this.defaultCursorShape = CursorShape.Ibeam;
  }

  get isEditing (): boolean {
    return this.root?.guiGetFocusOwner() === this;
  }

  setText (value: string): void {
    this.value = value;
  }

  override draw (): void {
    const focused = this.isEditing;
    const background = focused && this.selectAll ? this.tokens.accentSoft : this.tokens.panelRaisedBg;
    const border = focused ? this.tokens.accent : this.tokens.borderSubtle;
    const display = this.value.replaceAll('\n', ' ↵ ');
    const measurement = this.measureText(display, 10);
    const textX = Math.min(6, Math.max(6 - measurement.width + this.width - 12, -measurement.width + 6));
    const textY = Math.max(3, (this.height - measurement.lineHeight) * 0.5);

    this.fillRect(0, 0, this.width, this.height, background);
    this.drawRect(0.5, 0.5, Math.max(0, this.width - 1), Math.max(0, this.height - 1), border, 1);
    this.engine.graphics.pushClipRect(4, 2, Math.max(0, this.width - 8), Math.max(0, this.height - 4));
    this.drawText(textX, textY, display, 10, this.tokens.textPrimary);
    if (focused && !this.selectAll) {
      this.drawLine(textX + measurement.width + 1, textY, textX + measurement.width + 1, textY + measurement.lineHeight, this.tokens.accent, 1);
    }
    this.engine.graphics.popClipRect();
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) {
      this.grabFocus();
      this.selectAll = true;
      event.accept();
    }
  }

  override onKeyDown (event: InputEventKey): void {
    if ((event.ctrlPressed || event.metaPressed) && event.keycode === 'KeyA') {
      this.selectAll = true;
      event.accept();

      return;
    }
    if (event.keycode === 'ArrowUp' || event.keycode === 'ArrowDown') {
      this.stepped?.(event.keycode === 'ArrowUp' ? 1 : -1);
      event.accept();

      return;
    }
    if (event.keycode === 'Backspace' || event.keycode === 'Delete') {
      this.value = this.selectAll ? '' : this.value.slice(0, -1);
      this.selectAll = false;
      this.changed?.(this.value);
      event.accept();

      return;
    }
    if (event.keycode === 'Enter') {
      if (this.multiline) {
        this.insertText('\n');
      } else {
        this.releaseFocus();
      }
      event.accept();

      return;
    }
    if (event.unicode >= 32) {
      const value = String.fromCodePoint(event.unicode);

      if (!this.numeric || /[0-9+\-.eE]/.test(value)) {
        this.insertText(value);
        event.accept();
      }
    }
  }

  override onLostFocus (): void {
    this.selectAll = false;
  }

  private insertText (value: string): void {
    this.value = this.selectAll ? value : `${this.value}${value}`;
    this.selectAll = false;
    this.changed?.(this.value);
  }
}

function getPropertyRowHeight (property: InspectorProperty): number {
  if (property.kind === 'color') {
    return 116;
  }
  if (property.kind === 'flags') {
    return property.options.length > 2 ? 82 : 58;
  }
  if (property.kind === 'rect2') {
    return 60;
  }
  if (property.kind === 'text' && property.multiline) {
    return 62;
  }

  return 36;
}

function humanize (name: string): string {
  return name.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function formatNumber (value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}
