import type { Component } from '@galacean/effects';
import { EffectsObject, getMergedStore, math, RendererComponent } from '@galacean/effects';
import { EditorGUILayout } from '../widgets/editor-gui-layout';

export class Editor {
  target: object;

  onInspectorGUI () {
    const component = this.target as Component;
    const propertyDecoratorStore = getMergedStore(component);

    for (const propertyName of Object.keys(component)) {
      const key = propertyName as keyof Component;
      const property = component[key];

      if (typeof property === 'number') {
        EditorGUILayout.FloatField(propertyName, component, key);
      } else if (typeof property === 'boolean') {
        EditorGUILayout.Checkbox(propertyName, component, key);
      } else if (property instanceof math.Vector3) {
        EditorGUILayout.Vector3Field(propertyName, property);
      } else if (property instanceof math.Color) {
        EditorGUILayout.ColorField(propertyName, property);
      } else if (property instanceof EffectsObject) {
        EditorGUILayout.ObjectField(propertyName, component, key);
      }
    }
    if (component instanceof RendererComponent) {
      EditorGUILayout.ObjectField('Material', component, 'material');
    }
  }
}
