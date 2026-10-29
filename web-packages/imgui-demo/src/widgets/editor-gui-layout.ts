import { Sprite, Texture } from '@galacean/effects';
import { ImGui } from '../imgui';
import { Selection } from '../core/selection';
import { PropertyGrid, PROPERTY_COLORS } from './property-grid';
import type { PropertyHeaderIcon, PropertyRowAction } from './property-grid';
import { drawEditorChevron } from './editor-arrow';
import { getOrCreateTexturePreview } from './texture-preview';
import { getSpriteThumbnail } from './sprite-thumbnail';
import { contentLibrary } from '../core/content-library/content-library';
import { CONTENT_ASSET_PAYLOAD } from '../core/content-library/asset-drag';
import type { ContentAssetDrag } from '../core/content-library/asset-drag';
import { GalaceanEffects } from '../ge';
import { sceneWorkspace } from '../core/scene-document/scene-workspace';
import { openTextureAsset } from '../core/content-library/asset-editor';

type VectorDefaults = number[] | { values: number[], reset: () => void };

function openReference (reference: object): void {
  if (reference instanceof Texture && contentLibrary.entry(reference.getInstanceId())?.kind === 'texture' && openTextureAsset(reference.getInstanceId())) { return; }
  Selection.select(reference);
}

function access (object: object, property: string) {
  const target = object as Record<string, any>;

  return (next?: any) => {
    if (next !== undefined) { target[property] = next; }

    return target[property];
  };
}

function dragNumber (id: string, value: ImGui.Bind.ImAccess<number>, width: number, speed: number, min: number, max: number, format: string): boolean {
  const formatted = format.replace(/%\.(\d+)f/, (_, precision: string) => value().toFixed(Number(precision))).replace(/%%/g, '%');
  const space = Math.max(1, ImGui.CalcTextSize(' ').x);
  const padding = Math.max(0, Math.min(Math.max(0, 63 - formatted.length), Math.floor((width - ImGui.GetStyle().FramePadding.x * 2 - ImGui.CalcTextSize(formatted).x) / space)));

  ImGui.SetNextItemWidth(width);

  return ImGui.DragFloat(id, value, speed, min, max, format + ' '.repeat(padding), ImGui.SliderFlags.NoRoundToFormat);
}

export class EditorGUILayout {
  static alignWidth = 200;

  static Label (label: string): void {
    ImGui.AlignTextToFramePadding();
    ImGui.Text(label);
    ImGui.SameLine(EditorGUILayout.alignWidth);
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
      if (ImGui.IsItemHovered() && ImGui.CalcTextSize(text).x > width) { ImGui.SetTooltip(text); }
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
        if (ImGui.IsItemHovered() && !ImGui.IsItemActive()) { ImGui.SetTooltip(['X', 'Y', 'Z'][axis] + ': ' + values[axis] + '\nClick to type, or drag to adjust.'); }
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
    const target = object as Record<string, any>;
    const reference = target[property];

    return this.Property(label, width => {
      let changed = false;

      ImGui.BeginGroup();
      const origin = ImGui.GetCursorScreenPos();
      const preview = reference instanceof Texture ? getOrCreateTexturePreview(reference) : reference instanceof Sprite ? getSpriteThumbnail(reference) : null;
      let thumbnailWidth = 0;

      if (preview) {
        const size = 54, position = ImGui.GetCursorScreenPos();

        if (ImGui.InvisibleButton('##Thumbnail', new ImGui.Vec2(size, size))) { openReference(reference); }
        const draw = ImGui.GetWindowDrawList(), hovered = ImGui.IsItemHovered();
        const texture = reference instanceof Texture ? reference : (reference as Sprite).texture;
        const imageWidth = Math.max(1, (texture.width || 1) * (reference instanceof Sprite ? reference.rect[2] : 1));
        const imageHeight = Math.max(1, (texture.height || 1) * (reference instanceof Sprite ? reference.rect[3] : 1));
        const scale = Math.min((size - 6) / imageWidth, (size - 6) / imageHeight);
        const width = imageWidth * scale, height = imageHeight * scale;
        const min = new ImGui.Vec2(position.x + (size - width) / 2, position.y + (size - height) / 2);

        draw.AddRectFilled(position, new ImGui.Vec2(position.x + size, position.y + size), ImGui.GetColorU32(PROPERTY_COLORS.input), 3);
        draw.AddRect(position, new ImGui.Vec2(position.x + size, position.y + size), ImGui.GetColorU32(hovered ? PROPERTY_COLORS.hover : PROPERTY_COLORS.inputBorder), 3);
        draw.AddImage(preview.tex, min, new ImGui.Vec2(min.x + width, min.y + height), preview.uv0, preview.uv1);
        thumbnailWidth = size + 6;
        ImGui.SameLine(0, 6);
      }
      ImGui.SetNextItemWidth(width - thumbnailWidth);
      const caption = reference?.name || reference?.constructor.name || 'None';
      const buttonOrigin = ImGui.GetCursorScreenPos();

      ImGui.PushStyleColor(ImGui.Col.Button, PROPERTY_COLORS.input);
      ImGui.PushStyleVar(ImGui.StyleVar.ButtonTextAlign, new ImGui.Vec2(0, 0.5));
      ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(icon ? 28 : ImGui.GetStyle().FramePadding.x, ImGui.GetStyle().FramePadding.y));
      if (ImGui.Button(caption + '##Reference', new ImGui.Vec2(Math.max(20, width - thumbnailWidth), ImGui.GetFrameHeight())) && reference) { openReference(reference); }
      ImGui.PopStyleVar(2); ImGui.PopStyleColor();
      if (icon) { icon(buttonOrigin.x + 6, buttonOrigin.y + (ImGui.GetFrameHeight() - 16) / 2, 16); }
      if (thumbnailWidth) { ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + 54)); ImGui.Dummy(new ImGui.Vec2(width, 0)); }
      ImGui.EndGroup();
      if (ImGui.IsItemHovered(ImGui.HoveredFlags.DelayNormal)) { ImGui.SetTooltip(reference ? 'Open ' + caption + (readOnly ? '.' : '. Drop an asset here to replace it.') : 'Drop an asset here.'); }
      if (!readOnly && ImGui.BeginDragDropTarget()) {
        const type = expectedType ?? reference?.constructor.name ?? 'EffectsObject';
        const payload = ImGui.AcceptDragDropPayload(type);

        if (payload?.Data) { target[property] = payload.Data; changed = true; }
        if (type === Texture.name) {
          const asset = ImGui.AcceptDragDropPayload<ContentAssetDrag>(CONTENT_ASSET_PAYLOAD);
          const id = asset?.Data?.ids.length === 1 ? asset.Data.ids[0] : undefined;

          if (id && contentLibrary.entry(id)?.kind === 'texture') {
            const engine = GalaceanEffects.player.engine, texture = contentLibrary.texture(engine, id);

            if (texture?.isRegistered && !texture.isDestroyed) { target[property] = texture; changed = true; } else {
              const selection = [...Selection.getSelectedObjects()], document = sceneWorkspace.current;

              void contentLibrary.loadTexture(engine, id).then(loaded => {
                const currentSelection = Selection.getSelectedObjects();

                if (document !== sceneWorkspace.current || selection.length !== currentSelection.length || selection.some((entry, index) => entry !== currentSelection[index])) { return; }
                if (onAssetDrop) { onAssetDrop(loaded); } else { sceneWorkspace.observe('Assign texture', () => target[property] = loaded, [object]); }
              }).catch(error => contentLibrary.report(error));
            }
          }
        }
        ImGui.EndDragDropTarget();
      }

      return changed;
    }, label + ' ' + (reference?.name ?? ''));
  }
}
