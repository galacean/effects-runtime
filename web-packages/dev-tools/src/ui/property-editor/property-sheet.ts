import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion, InputEventKey } from '@galacean/effects';
import type { Control, Label, Checkbox, VBoxContainer } from '@galacean/effects-plugin-gui';
import { Button, ColorPicker, Container, SizeFlags, TextOverflow, Theme, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { append, column, disposeChildren, expand, label, place, row } from '../controls/layout';
import { EditorVerticalScrollContainer } from '../controls/scroll-container';
import { NumberEdit } from '../controls/number-edit';
import type { EditorMenuButton } from '../controls/menu';
import { EditorCollapsiblePanel } from '../controls/section-header';
import { EditorComboBox } from '../controls/combo-box';
import { EditorTextArea, EditorTextField } from '../controls/text-field';
import { EditorCheckbox } from '../controls/checkbox';
import { EditorPopupPanel } from '../controls/popup-panel';
import { EditorIconButton } from '../icons/control-icons';
import type { EditorIcon } from '../icons/control-icons';
import { editorDetailBackground, editorColors as C, editorMetrics, EDITOR_SMALL_FONT_SIZE } from '../theme/control-theme';
import { setTooltip } from '../controls/tooltip';
import { createObjectReferenceControl } from './object-reference-field';

export interface ValueBinding<T> { read(): T, write(value: T): void }
export interface PropertyEditContext {
  change(label: string, owner: Control, action: () => void): void,
  finish(owner: Control): void,
}
export interface NumberOptions { step?: number, min?: number, max?: number, precision?: number, suffix?: string }
export interface PropertyOptions {
  enabled?: () => boolean, reset?: () => void, resetVisible?: () => boolean,
  captionAction?: { icon(): EditorIcon, hint: string, pressed(): void },
}
export function propertyBinding<T> (object: object, key: PropertyKey): ValueBinding<T> {
  return { read: () => Reflect.get(object, key) as T, write: value => { Reflect.set(object, key, value); } };
}

class PropertyLineEdit extends EditorTextField {
  finish?: () => void;
  canceled?: (original: string) => void;
  private original = '';
  acceptText (): void { this.original = this.text; this.finish?.(); }
  override onGotFocus (): void { this.original = this.text; super.onGotFocus(); }
  override onLostFocus (): void { super.onLostFocus(); this.finish?.(); }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape') { this.text = this.original; this.canceled?.(this.original); this.releaseFocus(); event.accept(); } else { super.onKeyDown(event); }
  }
}
class PropertyTextEdit extends EditorTextArea {
  finish?: () => void;
  canceled?: (original: string) => void;
  private original = '';
  acceptText (): void { this.original = this.text; this.finish?.(); }
  override onGotFocus (): void { this.original = this.text; super.onGotFocus(); }
  override onLostFocus (): void { super.onLostFocus(); this.finish?.(); }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape') { this.text = this.original; this.canceled?.(this.original); this.releaseFocus(); event.accept(); } else { super.onKeyDown(event); }
  }
}

class PropertyRow extends Container {
  private readonly caption: Label;
  private readonly reset?: Button;
  private readonly captionAction?: EditorIconButton;
  private resizing = false;
  constructor (engine: Engine, readonly title: string, readonly valueControl: Control, readonly group: PropertyGroup, readonly options: PropertyOptions) {
    super(engine);
    this.caption = append(this, label(engine, title));
    this.caption.verticalAlignment = VerticalAlignment.Center;
    setTooltip(this, () => this.getLocalMousePosition().x < this.divider ? title : '');
    this.caption.textOverflow = TextOverflow.Ellipsis;
    append(this, valueControl);
    if (options.captionAction) {
      this.captionAction = append(this, new EditorIconButton(engine, options.captionAction.icon()));
      setTooltip(this.captionAction, options.captionAction.hint); this.captionAction.on('pressed', options.captionAction.pressed);
    }
    if (options.reset) {
      this.reset = append(this, new EditorIconButton(engine, 'reset'));
      this.reset.on('pressed', () => {
        group.sheet.edit.change(title, this, options.reset!); group.sheet.edit.finish(this); group.sheet.refresh();
      });
    }
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, Math.max(editorMetrics.propertyRowHeight, this.valueControl.getCombinedMinimumSize().y + 5)); }
  override getDesiredSize (): math.Vector2 { return this.getMinimumSize(); }
  private get divider (): number { return Math.max(Math.min(90, this.width * .45), Math.min(this.width * this.group.sheet.columnRatio, this.width - 100)); }
  protected override sortChildren (): void {
    const divider = this.divider;

    place(this.caption, 24 + this.group.depth * 10, 0, divider - 30 - this.group.depth * 10 - (this.captionAction ? 24 : 0), this.height - 1);
    place(this.valueControl, divider + 12, 2, this.width - divider - 42, this.height - 5);
    if (this.captionAction) { place(this.captionAction, divider - 24, 2, 22, 22); }
    if (this.reset) { place(this.reset, this.width - 26, 2, 22, 22); }
  }
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, editorDetailBackground(this.group.depth, this.hasPoint(this.getLocalMousePosition())));
    this.fillRect(this.divider, 0, 1, this.height, C.recessed);
    this.fillRect(0, this.height - 1, this.width, 1, C.recessed);
  }
  refresh (): void {
    if (this.options.enabled) { this.valueControl.enabled = this.options.enabled(); }
    if (this.reset) { this.reset.visible = this.options.resetVisible?.() ?? true; }
    if (this.captionAction) { this.captionAction.iconName = this.options.captionAction!.icon(); }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && Math.abs(event.position.x - this.divider) < 5) { this.resizing = true; event.accept(); }
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    this.defaultCursorShape = this.resizing || Math.abs(event.position.x - this.divider) < 5 ? 'ew-resize' : 'default';
    if (this.resizing) { this.group.sheet.setColumnRatio(event.position.x / Math.max(1, this.width)); event.accept(); }
  }
  override onMouseUp (event: InputEventMouseButton): void { this.resizing = false; event.accept(); }
}

class PropertyColorButton extends Button {
  readonly popup: EditorPopupPanel;
  private readonly picker: ColorPicker;
  private readonly channels: NumberEdit[] = [];
  private rgba = new math.Color(1, 1, 1, 1);
  changed?: (color: math.Color) => void;
  finished?: () => void;
  constructor (engine: Engine) {
    super(engine, '');
    this.popup = new EditorPopupPanel(engine); this.popup.setCustomMinimumSize(250, 0);
    const body = append(this.popup, column(engine, [], 4));

    this.picker = append(body, new ColorPicker(engine));
    this.picker.on('colorChanged', color => { this.rgba = color.clone(); this.syncChannels(); this.changed?.(this.rgba.clone()); });
    const values = append(body, row(engine));

    for (let i = 0; i < 4; i++) {
      const field = append(values, expand(new NumberEdit(engine), true, false));

      field.minimum = 0; field.maximum = i === 3 ? 1 : Infinity; field.step = .005; field.axis = i;
      field.changed = value => {
        const data = [this.rgba.r, this.rgba.g, this.rgba.b, this.rgba.a];

        data[i] = value; this.rgba.set(data[0], data[1], data[2], data[3]); this.picker.color = this.rgba; this.changed?.(this.rgba.clone());
      };
      this.channels.push(field);
    }
    this.on('pressed', () => {
      this.picker.color = this.rgba; this.syncChannels();
      const m = this.getGlobalTransform2D().elements;

      this.popup.popup(new math.Vector2(m[6], m[7] + this.height), this);
    });
    this.popup.onPopup('popupClosed', () => this.finished?.());
  }
  get color (): math.Color { return this.rgba; }
  set color (value: math.Color) { if (!this.popup.visible) { this.rgba = value.clone(); } }
  private syncChannels (): void { [this.rgba.r, this.rgba.g, this.rgba.b, this.rgba.a].forEach((value, i) => this.channels[i].value = value); }
  protected override drawDecoration (): void { this.fillRect(3, 3, this.width - 6, this.height - 6, this.rgba); }
  override onDestroy (): void { this.popup.dispose(); super.onDestroy(); }
}

/** Each section and field is constructed once. Binding refreshes only update existing values. */
export class PropertyGroup extends EditorCollapsiblePanel {
  private readonly fields: PropertyRow[] = [];
  private readonly groups: PropertyGroup[] = [];
  private readonly bindings: (() => void)[] = [];
  private opened: boolean;

  constructor (readonly sheet: PropertySheet, readonly id: string, readonly title: string, readonly depth = 0, defaultOpen = true, icon?: EditorIcon) {
    super(sheet.engine, title, sheet.expansion.get(id) ?? defaultOpen, depth, icon);
    this.opened = sheet.expansion.get(id) ?? defaultOpen;
    this.heading.on('pressed', () => { this.opened = !this.opened; sheet.expansion.set(id, this.opened); this.applyFilter(sheet.query); });
  }
  group (id: string, title: string, defaultOpen = true, icon?: EditorIcon): PropertyGroup {
    const group = append(this.body, new PropertyGroup(this.sheet, this.id + '/' + id, title, this.depth + 1, defaultOpen, icon));

    this.groups.push(group);

    return group;
  }
  add (title: string, control: Control, options: PropertyOptions = {}): Control {
    this.fields.push(append(this.body, new PropertyRow(this.engine, title, control, this, options)));

    return control;
  }
  private change (title: string, control: Control, action: () => void, immediate = false): void {
    this.sheet.edit.change(title, control, action);
    if (immediate) { this.sheet.edit.finish(control); }
  }
  text (title: string, binding: ValueBinding<string>, multiline = false, options: PropertyOptions = {}): Control {
    const field = multiline ? new PropertyTextEdit(this.engine) : new PropertyLineEdit(this.engine);

    if (multiline) { field.setCustomMinimumSize(0, 84); }
    field.text = binding.read(); field.finish = () => this.sheet.edit.finish(field);
    field.canceled = original => this.change(title, field, () => binding.write(original), true);
    field.on('textChanged', text => this.change(title, field, () => binding.write(text)));
    field.on('textSubmitted', () => field.acceptText());
    this.bindings.push(() => { if (!field.hasFocus()) { field.text = binding.read(); } });

    return this.add(title, field, options);
  }
  number (title: string, binding: ValueBinding<number>, numbers: NumberOptions = {}, options: PropertyOptions = {}): NumberEdit {
    const field = new NumberEdit(this.engine);

    if (numbers.step !== undefined) { field.step = numbers.step; }
    if (numbers.min !== undefined) { field.minimum = numbers.min; }
    if (numbers.max !== undefined) { field.maximum = numbers.max; }
    if (numbers.precision !== undefined) { field.precision = numbers.precision; }
    field.suffix = numbers.suffix ?? ''; field.value = binding.read();
    field.changed = value => this.change(title, field, () => binding.write(value));
    field.endEdit = () => this.sheet.edit.finish(field);
    this.bindings.push(() => { if (!field.isEditing) { field.value = binding.read(); } });
    this.add(title, field, options);

    return field;
  }
  boolean (title: string, binding: ValueBinding<boolean>, options: PropertyOptions = {}): Checkbox {
    const field = new EditorCheckbox(this.engine);

    field.setPressedNoSignal(binding.read());
    field.on('toggled', value => this.change(title, field, () => binding.write(value), true));
    this.bindings.push(() => field.setPressedNoSignal(binding.read())); this.add(title, field, options);

    return field;
  }
  choice (title: string, binding: ValueBinding<number>, choices: readonly string[], options: PropertyOptions = {}): EditorMenuButton {
    const field: EditorComboBox<number> = new EditorComboBox(this.engine, choices.map((label, value) => ({ label, value })), () => binding.read(), value => this.change(title, field, () => binding.write(value), true));

    this.add(title, field, options);

    return field;
  }
  vector (title: string, binding: ValueBinding<number[]>, count: number, options: PropertyOptions & { step?: number, precision?: number } = {}): Control {
    const group = row(this.engine);
    const inputs: NumberEdit[] = [];

    for (let axis = 0; axis < count; axis++) {
      const field = append(group, expand(new NumberEdit(this.engine), true, false));

      field.axis = axis; field.step = options.step ?? .01; field.precision = options.precision ?? 3;
      field.value = binding.read()[axis];
      field.changed = value => this.change(title, group, () => {
        const values = [...binding.read()];

        values[axis] = value; binding.write(values);
      });
      field.endEdit = () => this.sheet.edit.finish(group); inputs.push(field);
    }
    this.bindings.push(() => {
      const values = binding.read();

      inputs.forEach((field, index) => { if (!field.isEditing) { field.value = values[index]; } });
    });

    return this.add(title, group, options);
  }
  color (title: string, binding: ValueBinding<math.Color>, options: PropertyOptions = {}): Control {
    const field = new PropertyColorButton(this.engine);

    field.color = binding.read(); field.changed = color => this.change(title, field, () => binding.write(color));
    field.finished = () => this.sheet.edit.finish(field); this.bindings.push(() => field.color = binding.read());

    return this.add(title, field, options);
  }
  readOnly (title: string, read: () => string): Label {
    const field = label(this.engine, read());

    field.textOverflow = TextOverflow.Ellipsis; field.verticalAlignment = VerticalAlignment.Center; this.bindings.push(() => field.text = read()); this.add(title, field);

    return field;
  }
  button (title: string, text: string, action: () => void, icon?: EditorIcon): Button {
    const field = icon ? new EditorIconButton(this.engine, icon, text) : new Button(this.engine, text);

    field.on('pressed', action); this.add(title, field);

    return field;
  }
  reference (title: string, binding: ValueBinding<object | null>, expectedType?: string, readOnly = false, allowEmpty = true): Control {
    const field = createObjectReferenceControl(this.engine, binding, { expectedType, readOnly, allowEmpty,
      changed: action => this.change(title, field, action, true) });

    return this.add(title, field);
  }
  clear (): void {
    disposeChildren(this.body); this.fields.length = 0; this.groups.length = 0; this.bindings.length = 0;
  }
  refresh (): void { this.bindings.forEach(binding => binding()); this.fields.forEach(field => field.refresh()); this.groups.forEach(group => group.refresh()); }
  applyFilter (query: string, path = ''): boolean {
    const scope = path + ' ' + this.title;
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let matched = false;

    for (const field of this.fields) {
      const aliases = field.title === 'Location' ? ' Position' : field.title === 'ID' ? ' GUID' : '';

      field.visible = terms.every(term => (scope + ' ' + field.title + aliases).toLocaleLowerCase().includes(term)); matched ||= field.visible;
    }
    for (const group of this.groups) { matched = group.applyFilter(query, scope) || matched; }
    this.visible = matched || !query;
    this.body.visible = query ? matched : this.opened;
    this.heading.expanded = this.body.visible;

    return matched;
  }
  expandAll (open: boolean): void { this.opened = open; this.sheet.expansion.set(this.id, open); this.groups.forEach(group => group.expandAll(open)); this.applyFilter(this.sheet.query); }
  relayout (): void { this.fields.forEach(field => field.queueSort()); this.groups.forEach(group => group.relayout()); }
}

export class PropertySheet extends EditorVerticalScrollContainer {
  readonly body: VBoxContainer;
  readonly expansion = new Map<string, boolean>();
  private readonly groups: PropertyGroup[] = [];
  columnRatio = .38;
  query = '';

  constructor (engine: Engine, readonly edit: PropertyEditContext) {
    super(engine);
    this.theme = new Theme(); this.theme.setFontSize('Control', 'fontSize', EDITOR_SMALL_FONT_SIZE);
    this.body = append(this, column(engine)); this.body.horizontalSizeFlags = SizeFlags.ExpandFill;
  }
  clear (): void { disposeChildren(this.body); this.groups.length = 0; }
  section (id: string, title: string, defaultOpen = true, icon?: EditorIcon): PropertyGroup {
    const section = append(this.body, new PropertyGroup(this, id, title, 0, defaultOpen, icon));

    this.groups.push(section);

    return section;
  }
  filter (query: string): void { this.query = query; this.groups.forEach(group => group.applyFilter(query)); }
  refresh (): void { this.groups.forEach(group => group.refresh()); }
  expandAll (open: boolean): void { this.groups.forEach(group => group.expandAll(open)); }
  setColumnRatio (ratio: number): void { this.columnRatio = Math.max(.2, Math.min(.6, ratio)); this.groups.forEach(group => group.relayout()); }
  override update (delta: number): void { if (this.visibleInHierarchy) { this.refresh(); } super.update(delta); }
}
