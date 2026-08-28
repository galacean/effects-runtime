import {
  MouseButton,
  math,
} from '@galacean/effects';
import type {
  Engine,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
} from '@galacean/effects';
import {
  Button,
  Checkbox,
  ColorPickerButton,
  Container,
  GridContainer,
  HBoxContainer,
  HSeparator,
  HorizontalAlignment,
  Label,
  LineEdit,
  MarginContainer,
  MouseFilter,
  OptionButton,
  PanelContainer,
  PopupMenu,
  ScrollContainer,
  ScrollMode,
  SizeFlags,
  TextEdit,
  TextOverflow,
  VBoxContainer,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { PopupMenuItemId,
  Control } from '@galacean/effects-plugin-gui';
import type { InspectorControlType } from '../state';
import type { ThemeTokens } from '../theme';
import type { InspectorProperty } from './schema';

type RefreshBinding = {
  control: Control,
  bottom: boolean,
  refresh(): void,
};

type PropertyNode = {
  name: string,
  path: string,
  properties: InspectorProperty[],
  children: Map<string, PropertyNode>,
};

type PropertyClipboard = {
  kind: InspectorProperty['kind'],
  value: unknown,
} | null;

const CONTROL_GROUPS = ['Layout', 'Focus', 'Mouse', 'Theme Overrides'];
let propertyClipboard: PropertyClipboard = null;

export class ControlInspectorPanel extends PanelContainer {
  static override readonly themeType: string = 'EditorInspector';
  private readonly objectTitle: Label;
  private readonly propertyCount: Label;
  private readonly search: LineEdit;
  private readonly inspector: EditorInspector;

  constructor (
    engine: Engine,
    type: InspectorControlType,
    _tokens: ThemeTokens,
    resetControl: () => void,
  ) {
    super(engine);
    this.clipContents = true;
    const root = new VBoxContainer(engine);

    root.themeTypeVariation = 'EditorInspectorContainer';
    root.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    root.parent = this;
    const headerMargin = new MarginContainer(engine);

    headerMargin.setThemeConstantOverride('marginLeft', 10);
    headerMargin.setThemeConstantOverride('marginTop', 8);
    headerMargin.setThemeConstantOverride('marginRight', 10);
    headerMargin.setThemeConstantOverride('marginBottom', 8);
    headerMargin.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    headerMargin.parent = root;
    const header = new VBoxContainer(engine);

    header.setThemeConstantOverride('separation', 6);
    header.parent = headerMargin;
    const titleRow = new HBoxContainer(engine);

    titleRow.setThemeConstantOverride('separation', 6);
    titleRow.parent = header;
    this.objectTitle = new Label(engine, type);
    this.objectTitle.themeTypeVariation = 'EditorInspectorTitle';
    this.objectTitle.verticalAlignment = VerticalAlignment.Center;
    this.objectTitle.textOverflow = TextOverflow.Ellipsis;
    this.objectTitle.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    this.objectTitle.parent = titleRow;
    const reset = new Button(engine, 'Reset');

    reset.themeTypeVariation = 'EditorInspectorFlatButton';
    reset.setSizeFlags(SizeFlags.ShrinkEnd, SizeFlags.Fill);
    reset.on('pressed', resetControl);
    reset.parent = titleRow;
    this.propertyCount = new Label(engine);
    this.propertyCount.themeTypeVariation = 'EditorInspectorHint';
    this.propertyCount.parent = header;
    this.search = new LineEdit(engine);
    this.search.placeholderText = 'Filter Properties';
    this.search.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    this.search.parent = header;
    const separator = new HSeparator(engine);

    separator.parent = root;
    this.inspector = new EditorInspector(engine);
    this.inspector.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    this.inspector.parent = root;
    this.search.on('textChanged', value => this.inspector.setFilter(value));
  }

  setTarget (type: InspectorControlType, target: Control, properties: InspectorProperty[]): void {
    this.objectTitle.text = type;
    this.propertyCount.text = `${properties.length} editable properties`;
    this.search.text = '';
    this.inspector.setTarget(type, target, properties);
  }

  refresh (): void {
    this.inspector.refresh();
  }
}

export class EditorInspector extends ScrollContainer {
  static override readonly themeType: string = 'EditorInspector';
  private readonly foldStates = new Map<InspectorControlType, Map<string, boolean>>();
  private readonly baselines = new Map<string, unknown>();
  private content: VBoxContainer | null = null;
  private target: Control | null = null;
  private properties: InspectorProperty[] = [];
  private propertyRows: EditorProperty[] = [];
  private type: InspectorControlType = 'Button';
  private filter = '';

  constructor (engine: Engine) {
    super(engine);
    this.horizontalScrollMode = ScrollMode.Disabled;
    this.verticalScrollMode = ScrollMode.Auto;
  }

  setTarget (type: InspectorControlType, target: Control, properties: InspectorProperty[]): void {
    this.type = type;
    this.target = target;
    this.properties = properties;
    this.baselines.clear();
    for (const property of properties) {
      this.baselines.set(getPropertyPath(property), cloneValue(property.getValue(target)));
    }
    this.filter = '';
    this.rebuild();
  }

  setFilter (value: string): void {
    const normalized = value.trim().toLowerCase();

    if (this.filter !== normalized) {
      this.filter = normalized;
      this.rebuild();
    }
  }

  refresh (): void {
    for (const row of this.propertyRows) {row.refresh();}
  }

  private rebuild (): void {
    this.content?.dispose();
    this.propertyRows = [];
    const content = new VBoxContainer(this.engine);

    content.themeTypeVariation = 'EditorInspectorContainer';
    content.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    this.content = content;
    content.parent = this;
    if (!this.target) {return;}
    const properties = this.filter
      ? this.properties.filter(property => this.propertyMatches(property))
      : this.properties;
    const categories = buildPropertyTree(properties);

    for (const category of categories.values()) {
      const categoryControl = new EditorInspectorCategory(this.engine, category.name);

      categoryControl.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
      categoryControl.parent = content;
      this.appendPropertyRows(categoryControl.body, category.properties);
      for (const section of category.children.values()) {
        this.appendSection(categoryControl.body, section, 0);
      }
    }
    this.vScroll = 0;
  }

  private appendSection (parent: VBoxContainer, node: PropertyNode, depth: number): void {
    const states = this.foldStates.get(this.type) ?? new Map<string, boolean>();
    const open = this.filter.length > 0 || states.get(node.path) === true;
    const section = new EditorInspectorSection(this.engine, node.name, depth, open, value => {
      states.set(node.path, value);
      this.foldStates.set(this.type, states);
    });

    section.parent = parent;
    section.setContentBuilder(() => {
      this.appendPropertyRows(section.body, node.properties);
      for (const child of node.children.values()) {
        this.appendSection(section.body, child, depth + 1);
      }
    });
  }

  private appendPropertyRows (parent: VBoxContainer, properties: InspectorProperty[]): void {
    if (!this.target) {return;}
    for (const property of properties) {
      const path = getPropertyPath(property);
      const row = new EditorProperty(
        this.engine,
        this.target,
        property,
        this.baselines.get(path),
        () => this.refresh(),
      );

      this.propertyRows.push(row);
      row.refresh();
      row.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
      row.parent = parent;
    }
  }

  private propertyMatches (property: InspectorProperty): boolean {
    return `${property.name} ${getPropertyPath(property)} ${property.hint ?? ''}`.toLowerCase().includes(this.filter);
  }
}

export class EditorInspectorCategory extends VBoxContainer {
  static override readonly themeType: string = 'EditorInspectorCategory';
  readonly body: VBoxContainer;

  constructor (engine: Engine, title: string) {
    super(engine);
    this.setThemeConstantOverride('separation', 0);
    const header = new PanelContainer(engine);

    header.themeTypeVariation = 'EditorInspectorCategoryPanel';
    header.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    header.parent = this;
    const margin = new MarginContainer(engine);

    margin.setThemeConstantOverride('marginLeft', 10);
    margin.setThemeConstantOverride('marginTop', 5);
    margin.setThemeConstantOverride('marginRight', 10);
    margin.setThemeConstantOverride('marginBottom', 5);
    margin.parent = header;
    const label = new Label(engine, title);

    label.themeTypeVariation = 'EditorInspectorCategoryLabel';
    label.verticalAlignment = VerticalAlignment.Center;
    label.parent = margin;
    this.body = new VBoxContainer(engine);
    this.body.themeTypeVariation = 'EditorPropertyContainer';
    this.body.parent = this;
  }
}

export class EditorInspectorSection extends VBoxContainer {
  static override readonly themeType: string = 'EditorInspectorSection';
  readonly body: VBoxContainer;
  private readonly header: Button;
  private open: boolean;
  private contentBuilder: (() => void) | null = null;
  private contentBuilt = false;

  constructor (
    engine: Engine,
    title: string,
    depth: number,
    open: boolean,
    changed: (open: boolean) => void,
  ) {
    super(engine);
    this.open = open;
    this.setThemeConstantOverride('separation', 0);
    this.header = new Button(engine);
    this.header.themeTypeVariation = 'EditorInspectorFlatButton';
    this.header.textAlignment = HorizontalAlignment.Left;
    this.header.on('pressed', () => {
      this.open = !this.open;
      if (this.open) {this.ensureContent();}
      this.body.visible = this.open;
      this.updateHeader(title, depth);
      changed(this.open);
    });
    this.header.parent = this;
    this.body = new VBoxContainer(engine);
    this.body.themeTypeVariation = 'EditorPropertyContainer';
    this.body.visible = open;
    this.body.parent = this;
    this.updateHeader(title, depth);
  }

  setContentBuilder (builder: () => void): void {
    this.contentBuilder = builder;
    if (this.open) {this.ensureContent();}
  }

  private updateHeader (title: string, depth: number): void {
    this.header.text = `${'  '.repeat(depth)}${this.open ? '▾' : '▸'}  ${title}`;
  }

  private ensureContent (): void {
    if (!this.contentBuilt && this.contentBuilder) {
      this.contentBuilt = true;
      this.contentBuilder();
    }
  }
}

export class EditorProperty extends Container {
  static override readonly themeType: string = 'EditorProperty';
  private readonly nameLabel: Label;
  private readonly revertButton: Button;
  private readonly binding: RefreshBinding;
  private contextMenu: PopupMenu | null = null;
  private hovered = false;
  private pressed = false;

  constructor (
    engine: Engine,
    private readonly target: Control,
    private readonly property: InspectorProperty,
    private readonly baseline: unknown,
    changed: () => void,
  ) {
    super(engine);
    this.mouseFilter = MouseFilter.Stop;
    this.nameLabel = new Label(engine, humanize(property.name));
    this.nameLabel.themeTypeVariation = 'EditorPropertyLabel';
    this.nameLabel.textOverflow = TextOverflow.Ellipsis;
    this.nameLabel.verticalAlignment = VerticalAlignment.Center;
    this.nameLabel.mouseFilter = MouseFilter.Ignore;
    this.revertButton = new Button(engine, '↶');
    this.revertButton.themeTypeVariation = 'EditorInspectorFlatButton';
    this.revertButton.on('pressed', () => {
      this.revert();
      changed();
    });
    this.binding = createPropertyEditor(engine, target, property, changed);
    this.nameLabel.parent = this;
    this.revertButton.parent = this;
    this.binding.control.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    this.binding.control.parent = this;
  }

  refresh (): void {
    this.binding.refresh();
    this.revertButton.visible = this.isModified();
  }

  override getMinimumSize (): math.Vector2 {
    const rowHeight = this.getThemeConstant('rowHeight');
    const padding = this.getThemeConstant('padding');
    const editor = this.binding.control.getBoundMinimumSize();
    const label = this.nameLabel.getBoundMinimumSize();

    if (this.binding.bottom) {
      return new math.Vector2(Math.max(label.x, editor.x) + padding * 2, rowHeight + editor.y + padding * 2);
    }

    return new math.Vector2(label.x + editor.x + padding * 3, Math.max(rowHeight, editor.y + padding * 2));
  }

  override draw (): void {
    const style = this.pressed ? 'backgroundSelected' : this.hovered ? 'hover' : 'background';

    this.drawStyleBox(this.getThemeStyleBox(style), 0, 0, this.width, this.height);
  }

  override onMouseEnter (): void { this.hovered = true; }
  override onMouseLeave (): void {
    this.hovered = false;
    this.pressed = false;
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Right) {
      this.showContextMenu(event.globalPosition);
      event.accept();
    } else if (event.buttonIndex === MouseButton.Left) {
      this.pressed = true;
    }
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) {
      this.pressed = false;
    }
  }

  override onDestroy (): void {
    this.contextMenu?.dispose();
    this.contextMenu = null;
  }

  protected override sortChildren (): void {
    const padding = this.getThemeConstant('padding');
    const separation = this.getThemeConstant('separation');
    const rowHeight = this.getThemeConstant('rowHeight');
    const revertWidth = this.getThemeConstant('revertWidth');
    const contentWidth = Math.max(0, this.width - padding * 2);
    const narrow = contentWidth < this.getThemeConstant('wideThreshold');
    const split = narrow ? contentWidth : contentWidth * this.getThemeConstant('splitRatio');
    const labelWidth = Math.max(0, split - revertWidth - separation);

    this.fitChildInRect(this.nameLabel, {
      position: new math.Vector2(padding, padding),
      size: new math.Vector2(labelWidth, rowHeight),
    });
    this.fitChildInRect(this.revertButton, {
      position: new math.Vector2(padding + labelWidth, padding),
      size: new math.Vector2(revertWidth, rowHeight),
    });
    if (this.binding.bottom || narrow) {
      this.fitChildInRect(this.binding.control, {
        position: new math.Vector2(padding, padding + rowHeight),
        size: new math.Vector2(contentWidth, Math.max(0, this.height - rowHeight - padding * 2)),
      });
    } else {
      this.fitChildInRect(this.binding.control, {
        position: new math.Vector2(padding + split + separation, padding),
        size: new math.Vector2(Math.max(0, contentWidth - split - separation), Math.max(rowHeight, this.height - padding * 2)),
      });
    }
  }

  private isModified (): boolean {
    const override = this.property.themeOverride;

    if (override?.type === 'color') {return this.target.hasThemeColorOverride(override.name);}
    if (override?.type === 'constant') {return this.target.hasThemeConstantOverride(override.name);}
    if (override?.type === 'fontSize') {return this.target.hasThemeFontSizeOverride(override.name);}

    return !valuesEqual(this.property.getValue(this.target), this.baseline);
  }

  private revert (): void {
    const override = this.property.themeOverride;

    if (override?.type === 'color') {this.target.removeThemeColorOverride(override.name);} else if (override?.type === 'constant') {this.target.removeThemeConstantOverride(override.name);} else if (override?.type === 'fontSize') {this.target.removeThemeFontSizeOverride(override.name);} else {setPropertyValue(this.property, this.target, cloneValue(this.baseline));}
    this.refresh();
  }

  private showContextMenu (position: math.Vector2): void {
    this.contextMenu?.dispose();
    const menu = new PopupMenu(this.engine);

    menu.addItem('Copy Value', 'copy');
    menu.addItem('Paste Value', 'paste');
    menu.setItemDisabled(1, !propertyClipboard || propertyClipboard.kind !== this.property.kind);
    menu.addItem('Copy Property Path', 'copyPath');
    menu.addSeparator();
    menu.addItem('Revert', 'revert');
    menu.setItemDisabled(4, !this.isModified());
    menu.on('idPressed', id => this.handleMenu(id));
    this.contextMenu = menu;
    menu.popup(position, this);
  }

  private handleMenu (id: PopupMenuItemId): void {
    if (id === 'copy') {
      propertyClipboard = { kind: this.property.kind, value: cloneValue(this.property.getValue(this.target)) };
    } else if (id === 'paste' && propertyClipboard?.kind === this.property.kind) {
      setPropertyValue(this.property, this.target, cloneValue(propertyClipboard.value));
      this.refresh();
    } else if (id === 'copyPath') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(getPropertyPath(this.property));
      }
    } else if (id === 'revert') {
      this.revert();
    }
  }
}

export class EditorSpinSlider extends LineEdit {
  static override readonly themeType: string = 'EditorSpinSlider';
  minValue = Number.NEGATIVE_INFINITY;
  maxValue = Number.POSITIVE_INFINITY;
  step = 1;
  suffix = '';
  changed?: (value: number) => void;
  private currentValue = 0;
  private dragging = false;
  private dragOrigin = 0;
  private dragValue = 0;

  constructor (engine: Engine) {
    super(engine);
    this.on('textChanged', value => {
      const number = this.parseValue(value);

      if (number !== null) {this.setValue(number, true, false);}
    });
    this.on('textSubmitted', value => {
      const number = this.parseValue(value);

      if (number !== null) {this.setValue(number, true);}
    });
  }

  get value (): number { return this.currentValue; }
  set value (value: number) { this.setValue(value, true); }

  setValueNoSignal (value: number): void {
    this.setValue(value, false);
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) {
      this.dragging = true;
      this.dragOrigin = event.position.x;
      this.dragValue = this.currentValue;
    }
    super.onMouseDown(event);
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.dragging && Math.abs(event.position.x - this.dragOrigin) > 3) {
      this.setValue(this.dragValue + (event.position.x - this.dragOrigin) * this.step, true);
      event.accept();

      return;
    }
    super.onMouseMove(event);
  }

  override onMouseUp (event: InputEventMouseButton): void {
    this.dragging = false;
    super.onMouseUp(event);
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'ArrowUp' || event.keycode === 'ArrowDown') {
      this.setValue(this.currentValue + (event.keycode === 'ArrowUp' ? this.step : -this.step), true);
      event.accept();

      return;
    }
    super.onKeyDown(event);
  }

  override onLostFocus (): void {
    this.updateText();
    super.onLostFocus();
  }

  private setValue (value: number, signal: boolean, updateText = true): void {
    const stepped = this.step > 0 ? Math.round(value / this.step) * this.step : value;
    const next = Math.max(this.minValue, Math.min(this.maxValue, stepped));

    if (this.currentValue !== next) {
      this.currentValue = next;
      if (signal) {this.changed?.(next);}
    }
    if (updateText) {this.updateText();}
  }

  private updateText (): void {
    const value = Number.isInteger(this.currentValue)
      ? String(this.currentValue)
      : String(Number(this.currentValue.toFixed(4)));

    this.text = `${value}${this.suffix}`;
  }

  private parseValue (value: string): number | null {
    const number = Number(value.replace(this.suffix, '').trim());

    return Number.isFinite(number) ? number : null;
  }
}

function createPropertyEditor (
  engine: Engine,
  target: Control,
  property: InspectorProperty,
  changed: () => void,
): RefreshBinding {
  if (property.kind === 'boolean') {
    const editor = new Checkbox(engine);

    editor.mouseFilter = MouseFilter.Pass;
    editor.on('toggled', value => {
      property.setValue(target, value);
      changed();
    });

    return {
      control: editor,
      bottom: false,
      refresh: () => editor.setPressedNoSignal(property.getValue(target)),
    };
  }
  if (property.kind === 'number') {
    const editor = createSpinSlider(engine, property.min, property.max, property.step, property.suffix);

    editor.changed = value => {
      property.setValue(target, value);
      changed();
    };

    return {
      control: editor,
      bottom: false,
      refresh: () => editor.setValueNoSignal(property.getValue(target)),
    };
  }
  if (property.kind === 'vector2' || property.kind === 'rect2') {
    return createVectorEditor(engine, target, property, changed);
  }
  if (property.kind === 'enum') {
    const editor = new OptionButton(engine);

    editor.mouseFilter = MouseFilter.Pass;
    for (const option of property.options) {editor.addItem(option.label, option.value);}
    editor.onOption('itemSelected', value => {
      property.setValue(target, value);
      changed();
    });

    return {
      control: editor,
      bottom: false,
      refresh: () => editor.selectId(property.getValue(target), false),
    };
  }
  if (property.kind === 'flags') {
    const editor = new VBoxContainer(engine);
    const checks: Checkbox[] = [];

    editor.setThemeConstantOverride('separation', 2);
    for (const option of property.options) {
      const check = new Checkbox(engine, option.label);

      check.mouseFilter = MouseFilter.Pass;
      check.on('toggled', () => {
        const value = checks.reduce((result, current, index) => {
          return current.buttonPressed ? result | Number(property.options[index].value) : result;
        }, 0);

        property.setValue(target, value);
        changed();
      });
      check.parent = editor;
      checks.push(check);
    }

    return {
      control: editor,
      bottom: true,
      refresh: () => {
        const value = property.getValue(target);

        for (let index = 0; index < checks.length; index++) {
          checks[index].setPressedNoSignal((value & Number(property.options[index].value)) !== 0);
        }
      },
    };
  }
  if (property.kind === 'text') {
    const editor = property.multiline ? new TextEdit(engine) : new LineEdit(engine);

    editor.mouseFilter = MouseFilter.Pass;
    editor.on('textChanged', value => {
      property.setValue(target, value);
      changed();
    });

    return {
      control: editor,
      bottom: property.multiline ?? false,
      refresh: () => {
        if (!editor.hasFocus()) {editor.text = property.getValue(target);}
      },
    };
  }
  const editor = new ColorPickerButton(engine);

  editor.mouseFilter = MouseFilter.Pass;
  editor.on('colorChanged', value => {
    property.setValue(target, value);
    changed();
  });

  return {
    control: editor,
    bottom: false,
    refresh: () => { editor.color = property.getValue(target); },
  };
}

function createVectorEditor (
  engine: Engine,
  target: Control,
  property: Extract<InspectorProperty, { kind: 'vector2' | 'rect2' }>,
  changed: () => void,
): RefreshBinding {
  const editor = new GridContainer(engine);
  const axes = property.kind === 'vector2' ? ['X', 'Y'] : ['X', 'Y', 'W', 'H'];
  const fields: EditorSpinSlider[] = [];

  editor.columns = 2;
  editor.setThemeConstantOverride('horizontalSeparation', 5);
  editor.setThemeConstantOverride('verticalSeparation', 4);
  for (let index = 0; index < axes.length; index++) {
    const fieldRow = new HBoxContainer(engine);
    const axis = new Label(engine, axes[index]);
    const field = createSpinSlider(engine, undefined, property.max, property.step, property.suffix);

    axis.themeTypeVariation = `EditorAxis${axes[index]}`;
    axis.setCustomMinimumSize(14, 0);
    axis.verticalAlignment = VerticalAlignment.Center;
    axis.parent = fieldRow;
    field.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    field.parent = fieldRow;
    fieldRow.parent = editor;
    field.changed = value => {
      const vector = property.getValue(target);

      vector[index] = property.kind === 'rect2' && index >= 2 && property.sizeMin !== undefined
        ? Math.max(property.sizeMin, value)
        : value;
      setPropertyValue(property, target, vector);
      changed();
    };
    fields.push(field);
  }

  return {
    control: editor,
    bottom: true,
    refresh: () => {
      const vector = property.getValue(target);

      for (let index = 0; index < fields.length; index++) {fields[index].setValueNoSignal(vector[index]);}
    },
  };
}

function createSpinSlider (
  engine: Engine,
  min?: number,
  max?: number,
  step?: number,
  suffix?: string,
): EditorSpinSlider {
  const editor = new EditorSpinSlider(engine);

  editor.minValue = min ?? Number.NEGATIVE_INFINITY;
  editor.maxValue = max ?? Number.POSITIVE_INFINITY;
  editor.step = step ?? 1;
  editor.suffix = suffix ?? '';
  editor.mouseFilter = MouseFilter.Pass;

  return editor;
}

function buildPropertyTree (properties: InspectorProperty[]): Map<string, PropertyNode> {
  const roots = new Map<string, PropertyNode>();
  const specific = properties.filter(property => !CONTROL_GROUPS.includes(property.group.split('/')[0].trim()));
  const shared = CONTROL_GROUPS.flatMap(group => {
    return properties.filter(property => property.group.split('/')[0].trim() === group);
  });

  for (const property of [...specific, ...shared]) {
    const groupParts = property.group.split('/').map(part => part.trim()).filter(Boolean);
    const parts = CONTROL_GROUPS.includes(groupParts[0]) ? ['Control', ...groupParts] : groupParts;
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

function getPropertyPath (property: InspectorProperty): string {
  return property.path ?? `${property.group}/${property.name}`;
}

function humanize (name: string): string {
  return name.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function cloneValue (value: unknown): unknown {
  if (value instanceof math.Color) {return value.clone();}
  if (Array.isArray(value)) {return value.slice();}

  return value;
}

function valuesEqual (left: unknown, right: unknown): boolean {
  if (left instanceof math.Color && right instanceof math.Color) {return left.equals(right);}
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  return left === right;
}

function setPropertyValue (property: InspectorProperty, target: Control, value: unknown): void {
  if (property.kind === 'boolean') {property.setValue(target, value as boolean);} else if (property.kind === 'number') {property.setValue(target, value as number);} else if (property.kind === 'vector2') {property.setValue(target, value as [number, number]);} else if (property.kind === 'rect2') {property.setValue(target, value as [number, number, number, number]);} else if (property.kind === 'enum') {property.setValue(target, value as number | string);} else if (property.kind === 'flags') {property.setValue(target, value as number);} else if (property.kind === 'text') {property.setValue(target, value as string);} else {property.setValue(target, value as math.Color);}
}
