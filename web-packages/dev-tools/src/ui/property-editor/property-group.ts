import type { math } from '@galacean/effects';
import type { Engine, InputEventKey } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Button, TextOverflow, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { append, expand, label, row } from '../controls/layout';
import { NumberEdit } from '../controls/number-edit';
import type { MenuAction } from '../controls/menu';
import { EditorComboBox } from '../controls/combo-box';
import { EditorTextArea, EditorTextField } from '../controls/text-field';
import { EditorCheckbox } from '../controls/checkbox';
import { EditorColorButton } from '../controls/color-picker';
import { EditorIconButton } from '../icons/control-icons';
import type { EditorIcon } from '../icons/control-icons';
import { editorMetrics } from '../theme/control-theme';
import { createObjectReferenceControl } from './object-reference-field';
import type { NumberOptions, PropertyOptions, PropertySheet, ValueBinding } from './property-sheet';

export interface PropertyWidget { control: Control, refresh?: () => void }

/** Property data outlives its viewport widget. Factories run only when a row is mounted. */
export class PropertyField {
  visible = true;
  height: number;
  constructor (readonly group: PropertyGroup, readonly title: string, readonly create: () => PropertyWidget, readonly options: PropertyOptions) {
    this.height = options.height ?? editorMetrics.propertyRowHeight;
  }
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

export class PropertyGroup {
  readonly entries: (PropertyGroup | PropertyField)[] = [];
  private readonly fields: PropertyField[] = [];
  private readonly groups: PropertyGroup[] = [];
  actions?: (owner: Control) => MenuAction[];
  visible = true;
  private opened: boolean;

  constructor (readonly sheet: PropertySheet, readonly id: string, readonly title: string, readonly depth = 0, defaultOpen = true, readonly icon?: EditorIcon, readonly parent?: PropertyGroup) {
    this.opened = sheet.expansion.get(id) ?? defaultOpen;
  }
  get engine (): Engine { return this.sheet.engine; }
  get expanded (): boolean { return this.sheet.query ? this.visible : this.opened; }
  set expanded (open: boolean) { this.opened = open; this.sheet.expansion.set(this.id, open); this.sheet.invalidateRows(); }
  group (id: string, title: string, defaultOpen = true, icon?: EditorIcon): PropertyGroup {
    const group = new PropertyGroup(this.sheet, this.id + '/' + id, title, this.depth + 1, defaultOpen, icon, this);

    this.entries.push(group); this.groups.push(group); this.sheet.invalidateRows();

    return group;
  }
  private field (title: string, create: () => PropertyWidget, options: PropertyOptions): PropertyField {
    const field = new PropertyField(this, title, create, options);

    this.entries.push(field); this.fields.push(field); this.sheet.invalidateRows();

    return field;
  }
  add (title: string, create: (engine: Engine) => Control, options: PropertyOptions = {}): PropertyField {
    return this.field(title, () => ({ control: create(this.engine) }), options);
  }
  private change (title: string, control: Control, action: () => void, immediate = false): void {
    this.sheet.edit.change(title, control, action);
    if (immediate) { this.sheet.edit.finish(control); }
  }
  text (title: string, binding: ValueBinding<string>, multiline = false, options: PropertyOptions = {}): PropertyField {
    return this.field(title, () => {
      const field = multiline ? new PropertyTextEdit(this.engine) : new PropertyLineEdit(this.engine);

      if (multiline) { field.setCustomMinimumSize(0, 84); }
      field.text = binding.read(); field.finish = () => this.sheet.edit.finish(field);
      field.canceled = original => this.change(title, field, () => binding.write(original), true);
      field.on('textChanged', text => this.change(title, field, () => binding.write(text)));
      field.on('textSubmitted', () => field.acceptText());

      return { control: field, refresh: () => { if (!field.hasFocus()) { field.text = binding.read(); } } };
    }, { height: multiline ? 89 : undefined, ...options });
  }
  number (title: string, binding: ValueBinding<number>, numbers: NumberOptions = {}, options: PropertyOptions = {}): PropertyField {
    return this.field(title, () => {
      const field = new NumberEdit(this.engine);

      if (numbers.step !== undefined) { field.step = numbers.step; }
      if (numbers.min !== undefined) { field.minimum = numbers.min; }
      if (numbers.max !== undefined) { field.maximum = numbers.max; }
      if (numbers.precision !== undefined) { field.precision = numbers.precision; }
      field.suffix = numbers.suffix ?? ''; field.value = binding.read();
      field.changed = value => this.change(title, field, () => binding.write(value));
      field.endEdit = () => this.sheet.edit.finish(field);

      return { control: field, refresh: () => { if (!field.isEditing) { field.value = binding.read(); } } };
    }, options);
  }
  boolean (title: string, binding: ValueBinding<boolean>, options: PropertyOptions = {}): PropertyField {
    return this.field(title, () => {
      const field = new EditorCheckbox(this.engine);

      field.setPressedNoSignal(binding.read());
      field.on('toggled', value => this.change(title, field, () => binding.write(value), true));

      return { control: field, refresh: () => field.setPressedNoSignal(binding.read()) };
    }, options);
  }
  choice (title: string, binding: ValueBinding<number>, choices: readonly string[], options: PropertyOptions = {}): PropertyField {
    return this.field(title, () => {
      const field: EditorComboBox<number> = new EditorComboBox(this.engine, choices.map((label, value) => ({ label, value })), () => binding.read(), value => this.change(title, field, () => binding.write(value), true));

      return { control: field, refresh: () => field.refresh() };
    }, options);
  }
  vector (title: string, binding: ValueBinding<number[]>, count: number, options: PropertyOptions & { step?: number, precision?: number } = {}): PropertyField {
    return this.field(title, () => {
      const group = row(this.engine), inputs: NumberEdit[] = [];
      const values = binding.read();

      for (let axis = 0; axis < count; axis++) {
        const field = append(group, expand(new NumberEdit(this.engine), true, false));

        field.axis = axis; field.step = options.step ?? .01; field.precision = options.precision ?? 3; field.value = values[axis];
        field.changed = value => this.change(title, group, () => {
          const values = [...binding.read()];

          values[axis] = value; binding.write(values);
        });
        field.endEdit = () => this.sheet.edit.finish(group); inputs.push(field);
      }

      return { control: group, refresh: () => {
        const values = binding.read();

        inputs.forEach((field, index) => { if (!field.isEditing) { field.value = values[index]; } });
      } };
    }, options);
  }
  color (title: string, binding: ValueBinding<math.Color>, options: PropertyOptions = {}): PropertyField {
    return this.field(title, () => {
      const field = new EditorColorButton(this.engine);

      field.color = binding.read(); field.changed = color => this.change(title, field, () => binding.write(color));
      field.finished = () => this.sheet.edit.finish(field);

      return { control: field, refresh: () => field.color = binding.read() };
    }, options);
  }
  readOnly (title: string, read: () => string): PropertyField {
    return this.field(title, () => {
      const field = label(this.engine, read());

      field.textOverflow = TextOverflow.Ellipsis; field.verticalAlignment = VerticalAlignment.Center;

      return { control: field, refresh: () => field.text = read() };
    }, {});
  }
  button (title: string, text: string, action: (button: Button) => void, icon?: EditorIcon, options: PropertyOptions = {}): PropertyField {
    return this.add(title, engine => {
      const field = icon ? new EditorIconButton(engine, icon, text) : new Button(engine, text);

      field.on('pressed', () => action(field));

      return field;
    }, options);
  }
  reference (title: string, binding: ValueBinding<object | null>, expectedType?: string, readOnly = false, allowEmpty = true): PropertyField {
    return this.add(title, engine => {
      const field = createObjectReferenceControl(engine, binding, { expectedType, readOnly, allowEmpty,
        changed: action => this.change(title, field, action, true) });

      return field;
    });
  }
  clear (): void {
    this.sheet.releaseGroup(this); this.entries.length = 0; this.fields.length = 0; this.groups.length = 0; this.actions = undefined;
    this.sheet.invalidateRows();
  }
  applyFilter (query: string, path = ''): boolean {
    const scope = path + ' ' + this.title, terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let matched = false;

    for (const field of this.fields) {
      const aliases = field.title === 'Location' ? ' Position' : field.title === 'ID' ? ' GUID' : '';

      field.visible = terms.every(term => (scope + ' ' + field.title + aliases).toLocaleLowerCase().includes(term)); matched ||= field.visible;
    }
    for (const group of this.groups) { matched = group.applyFilter(query, scope) || matched; }
    this.visible = matched || !query;

    return matched;
  }
  expandAll (open: boolean): void {
    this.opened = open; this.sheet.expansion.set(this.id, open); this.groups.forEach(group => group.expandAll(open)); this.sheet.invalidateRows();
  }
}
