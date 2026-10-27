import { EffectsObject, MaskableGraphic, RendererComponent, SpriteComponent, math } from '@galacean/effects';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { PropertyGrid } from '../widgets/property-grid';

const HIDDEN_PROPERTIES = new Set([
  'engine', 'item', 'guid', 'definition', 'name', 'id', 'isRegistered', 'isAwakeCalled', 'isStartCalled',
  'isEnableCalled', 'isDuringPlay', 'enabled', 'materials', 'material', 'frameClipMasks', 'maskManager',
  'boundingBoxInfo', 'geometry', 'defaultGeometry', 'canvas', 'context', 'isDirty', 'maxLineWidth',
  'ALPHA_FIX_VALUE', 'eventEmitter', 'eventProcessor', 'disposed', 'visible', 'renderer',
  'controlNode', 'linkedItemTransform', 'linkedControl', 'syncingLocation', 'timelineDirty', 'isEndCalled',
]);

export function propertyLabel (name: string): string {
  const label = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export class Editor {
  target: object;

  getSearchTerms (): string[] {
    const terms = this.objectTerms(this.target);

    if (this.target instanceof RendererComponent) { terms.push('Render Order'); }
    if (this.target instanceof MaskableGraphic) { terms.push('Color'); }
    if (this.target instanceof SpriteComponent) { terms.push('Sprite'); }

    return terms;
  }

  onInspectorGUI (): void {
    this.drawObject(this.target);
    this.drawRenderingProperties();
  }

  protected drawRenderingProperties (): void {
    const component = this.target;

    if (component instanceof MaskableGraphic) {
      const color = component.color.clone();

      if (EditorGUILayout.ColorField('Color', color)) { component.color = color; }
    }
    if (component instanceof SpriteComponent) { EditorGUILayout.ObjectField('Sprite', component, 'sprite', 'Sprite'); }
    if (component instanceof RendererComponent) {
      EditorGUILayout.NumberField('Render Order', next => {
        if (next !== undefined) { component.priority = Math.round(next); }

        return component.priority;
      }, 1, 0, 0, '%.0f');
    }
  }

  private properties (object: object): [string, any][] {
    return Object.entries(object).filter(([name, value]) => !name.startsWith('_') && !HIDDEN_PROPERTIES.has(name) &&
      value !== undefined && value !== null && typeof value !== 'function' && !ArrayBuffer.isView(value));
  }

  private isGroup (value: object): boolean {
    return Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype;
  }

  private objectTerms (object: object, visited = new Set<object>(), depth = 0): string[] {
    if (visited.has(object) || depth > 4) { return []; }
    visited.add(object);

    return this.properties(object).flatMap(([name, value]) => [propertyLabel(name),
      ...(typeof value === 'object' && this.isGroup(value) ? this.objectTerms(value, visited, depth + 1) : [])]);
  }

  private drawObject (object: object, visited = new Set<object>(), depth = 0): void {
    if (visited.has(object) || depth > 4) { return; }
    visited.add(object);
    for (const [key, value] of this.properties(object)) {
      const label = propertyLabel(key);

      if (typeof value === 'number' && Number.isFinite(value)) {
        EditorGUILayout.FloatField(label, object, key);
      } else if (typeof value === 'boolean') {
        EditorGUILayout.Checkbox(label, object, key);
      } else if (typeof value === 'string') {
        EditorGUILayout.TextField(label, object, key);
      } else if (value instanceof math.Vector3) {
        EditorGUILayout.Vector3Field(label, value);
      } else if (value instanceof math.Vector2) {
        EditorGUILayout.Vector2Field(label, value);
      } else if (value instanceof math.Color) {
        EditorGUILayout.ColorField(label, value);
      } else if (value instanceof EffectsObject) {
        EditorGUILayout.ObjectField(label, object, key);
      } else if (typeof value === 'object' && this.isGroup(value) && PropertyGrid.matches(label, ...this.objectTerms(value))) {
        if (EditorGUILayout.BeginFoldoutHeaderGroup(label + '##' + key, false)) { this.drawObject(value, visited, depth + 1); }
        EditorGUILayout.EndFoldoutHeaderGroup();
      }
    }
  }
}
