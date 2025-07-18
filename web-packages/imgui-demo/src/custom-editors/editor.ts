import type { Component } from '@galacean/effects';
import { EffectsObject, getMergedStore, isObject, math, RendererComponent } from '@galacean/effects';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { ImGui } from '../imgui';

export class Editor {
  target: object;

  onInspectorGUI () {
    const component = this.target as Component;
    const propertyDecoratorStore = getMergedStore(component);

    this.drawObject(component);
    if (component instanceof RendererComponent) {
      EditorGUILayout.ObjectField('Material', component, 'material');
    }
  }

  private drawObject (object: object) {
    for (const propertyName of Object.keys(object)) {
      const key = propertyName as keyof object;
      const property = object[key] as any;

      if (property === undefined || property === null) {
        continue;
      }

      if (typeof property === 'number') {
        EditorGUILayout.FloatField(propertyName, object, key);
      } else if (typeof property === 'boolean') {
        EditorGUILayout.Checkbox(propertyName, object, key);
      } else if (typeof property === 'string') {
        EditorGUILayout.TextField(propertyName, object, key);
      } else if (property instanceof math.Vector3) {
        EditorGUILayout.Vector3Field(propertyName, property);
      } else if (property instanceof math.Vector2) {
        EditorGUILayout.Vector2Field(propertyName, property);
      } else if (property instanceof math.Color) {
        EditorGUILayout.ColorField(propertyName, property);
      } else if (property instanceof EffectsObject) {
        EditorGUILayout.ObjectField(propertyName, object, key);
      } else if (property.constructor === Object) {
        EditorGUILayout.Label(propertyName);
        if (ImGui.TreeNode('##' + propertyName)) {
          this.drawObject(property);
          ImGui.TreePop();
        }
      }
    }
  }
}
