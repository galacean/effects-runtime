import { editorTooltip } from '../widgets/editor-tooltip';
import type { Texture } from '@galacean/effects';
import { ImGui } from '../../platform/imgui/index';
import { drawEditorChevron } from '../widgets/editor-arrow';
import type { PropertyHeaderIcon, PropertyRowAction } from './property-grid';
import { PROPERTY_COLORS, PropertyGrid } from './property-grid';
import { PropertyHandle } from './property-handle';

import { objectReferenceField } from './object-reference-field';

type VectorDefaults = number[] | { values: number[], reset: () => void };

function access (object: object, property: string): (next?: any) => any { return new PropertyHandle<any>(object, property).access; }

function dragNumber (id: string, value: ImGui.Bind.ImAccess<number>, width: number, speed: number, min: number, max: number, format: string): boolean {
  const formatted = format.replace(/%\.(\d+)f/, (_, precision: string) => value().toFixed(Number(precision))).replace(/%%/g, '%');
  const space = Math.max(1, ImGui.CalcTextSize(' ').x);
  const padding = Math.max(0, Math.min(Math.max(0, 63 - formatted.length), Math.floor((width - ImGui.GetStyle().FramePadding.x * 2 - ImGui.CalcTextSize(formatted).x) / space)));

  ImGui.SetNextItemWidth(width);
  let current = value();
  const changed = ImGui.DragFloat(id, next => {
    if (next !== undefined) { current = next; }

    return current;
  }, speed, min, max, format + ' '.repeat(padding), ImGui.SliderFlags.NoRoundToFormat);

  if (changed) { value(current); }

  return changed;
}

export class PropertyFields {
  static alignWidth = 200;

  static Label (label: string): void {
    ImGui.AlignTextToFramePadding();
    ImGui.Text(label);
    ImGui.SameLine(PropertyFields.alignWidth);
    ImGui.SetNextItemWidth(-1);
  }

  static Property (label: string, draw: (width: number) => boolean | void, guiID = label, reset?: () => void, action?: PropertyRowAction): boolean {
    if (PropertyGrid.active) { return PropertyGrid.row(label, draw, guiID, reset, action); }
    ImGui.PushID(guiID);
    this.Label(label);
    const changed = draw(ImGui.GetContentRegionAvail().x) === true;

    ImGui.PopID();

    return changed;
  }

  static TextField (label: string, object: object, property: string, guiID?: string): boolean {
    return this.Property(label, width => {
      ImGui.SetNextItemWidth(width);

      return ImGui.InputText('##Value', access(object, property));
    }, guiID);
  }

  static Text (label: string, text: string): void {
    this.Property(label, width => {
      const point = ImGui.GetCursorScreenPos(), dl = ImGui.GetWindowDrawList();

      dl.PushClipRect(point, new ImGui.Vec2(point.x + width, point.y + ImGui.GetFrameHeight()), true);
      dl.AddText(new ImGui.Vec2(point.x + 7, point.y + (ImGui.GetFrameHeight() - ImGui.GetFontSize()) / 2), ImGui.GetColorU32(PROPERTY_COLORS.text), text);
      dl.PopClipRect();
      ImGui.Dummy(new ImGui.Vec2(width, ImGui.GetFrameHeight()));
      if (ImGui.IsItemHovered() && ImGui.CalcTextSize(text).x > width) { editorTooltip(text); }
    });
  }

  static Checkbox (label: string, object: object, property: string, guiID?: string): boolean {
    return this.Property(label, () => ImGui.Checkbox('##Value', access(object, property)), guiID);
  }

  static NumberField (label: string, value: ImGui.Bind.ImAccess<number>, speed = 0.03, min = 0, max = 0, format = '%.3f', guiID?: string): boolean {
    return this.Property(label, width => {
      return dragNumber('##Value', value, width, speed, min, max, format);
    }, guiID);
  }

  static FloatField (label: string, object: object, property: string, guiID?: string): boolean {
    return this.NumberField(label, access(object, property), 0.03, 0, 0, '%.3f', guiID);
  }

  static ComboField (label: string, value: ImGui.Bind.ImAccess<number>, items: string[], guiID?: string): boolean {
    return this.Property(label, width => {
      const origin = ImGui.GetCursorScreenPos();
      const selected = value();
      let changed = false;

      ImGui.SetNextItemWidth(width);
      ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(8, 4));
      if (ImGui.BeginCombo('##Value', items[selected] ?? 'None', ImGui.ComboFlags.NoArrowButton)) {
        items.forEach((item, index) => {
          if (ImGui.Selectable(item, index === selected) && index !== selected) { value(index); changed = true; }
          if (index === selected) { ImGui.SetItemDefaultFocus(); }
        });
        ImGui.EndCombo();
      }
      ImGui.PopStyleVar();
      drawEditorChevron(origin.x + width - 21, origin.y + (ImGui.GetFrameHeight() - 14) / 2, 14, PROPERTY_COLORS.text);

      return changed;
    }, guiID);
  }

  static Vector2Field (label: string, value: ImGui.XY | ImGui.Bind.ImTuple2<number>, guiID?: string, defaults?: number[]): boolean {
    return this.vectorField(label, value, 2, guiID, defaults);
  }

  static Vector3Field (label: string, value: ImGui.XYZ | ImGui.XYZW | ImGui.Bind.ImTuple3<number> | ImGui.Bind.ImTuple4<number>, guiID?: string, defaults?: VectorDefaults, action?: PropertyRowAction): boolean {
    return this.vectorField(label, value, 3, guiID, defaults, action);
  }

  private static vectorField (label: string, value: object, count: number, guiID?: string, defaults?: VectorDefaults, action?: PropertyRowAction): boolean {
    const vector = value as Record<string, number>;
    const fields = 'x' in value ? ['x', 'y', 'z'] : ['0', '1', '2'];
    const values = fields.slice(0, count).map(key => vector[key]);
    const defaultValues = Array.isArray(defaults) ? defaults : defaults?.values;
    const reset = defaultValues && values.some((number, index) => Math.abs(number - defaultValues[index]) > 1e-6)
      ? () => {
        defaultValues.forEach((number, index) => values[index] = number);
        if (defaults && !Array.isArray(defaults)) { defaults.reset(); }
      } : undefined;
    const changed = this.Property(label, width => {
      const spacing = 4, inputWidth = Math.max(20, (width - (count - 1) * spacing) / count);
      let edited = false;

      for (let axis = 0; axis < count; axis++) {
        if (axis) { ImGui.SameLine(0, spacing); }
        ImGui.PushID(axis);
        let precision = 3;

        while (precision > 1 && ImGui.CalcTextSize(values[axis].toFixed(precision)).x + ImGui.GetStyle().FramePadding.x * 2 > inputWidth) { precision--; }
        if (dragNumber('##Axis', next => {
          if (next !== undefined && Number.isFinite(next)) { values[axis] = next; }

          return values[axis];
        }, inputWidth, label === 'Rotation' ? 0.1 : 0.01, 0, 0, '%.' + precision + 'f')) { edited = true; }
        const min = ImGui.GetItemRectMin(), max = ImGui.GetItemRectMax();

        ImGui.GetWindowDrawList().AddRectFilled(new ImGui.Vec2(min.x + 2, min.y + 3), new ImGui.Vec2(min.x + 4, max.y - 3), ImGui.GetColorU32(PROPERTY_COLORS.axes[axis]), 1);
        if (precision < 3 && values[axis] !== Number(values[axis].toFixed(precision))) { editorTooltip(['X', 'Y', 'Z'][axis] + ': ' + values[axis]); }
        ImGui.PopID();
      }

      return edited;
    }, guiID, reset, action);

    if (changed) { fields.slice(0, count).forEach((key, index) => vector[key] = values[index]); }

    return changed;
  }

  static ColorField (label: string, color: ImGui.RGBA | ImGui.Bind.ImTuple4<number> | ImGui.Bind.interface_ImVec4, guiID?: string): boolean {
    return this.Property(label, width => {
      ImGui.SetNextItemWidth(width);
      ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(8, 4));
      const changed = ImGui.ColorEdit4('##Value', color, ImGui.ColorEditFlags.Float | ImGui.ColorEditFlags.HDR | ImGui.ColorEditFlags.NoInputs);

      ImGui.PopStyleVar();

      return changed;
    }, guiID);
  }

  static BeginFoldoutHeaderGroup (label: string, defaultOpen = true): boolean {
    if (PropertyGrid.active) { return PropertyGrid.beginGroup(label, defaultOpen); }
    ImGui.Indent();

    return ImGui.TreeNodeEx(label, ImGui.TreeNodeFlags.SpanAvailWidth | ImGui.TreeNodeFlags.NoTreePushOnOpen |
      (defaultOpen ? ImGui.TreeNodeFlags.DefaultOpen : 0));
  }

  static EndFoldoutHeaderGroup (): void {
    if (PropertyGrid.active) { PropertyGrid.endGroup(); } else { ImGui.Unindent(); }
  }

  static ObjectField (label: string, object: object, property: string, expectedType?: string, readOnly = false, icon?: PropertyHeaderIcon, onAssetDrop?: (texture: Texture) => void): boolean {
    return this.Property(label, width => objectReferenceField(object, property, width, expectedType, readOnly, icon, onAssetDrop));
  }
}
