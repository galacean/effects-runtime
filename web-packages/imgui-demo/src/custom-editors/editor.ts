import type { Component, Material } from '@galacean/effects';
import { EffectsObject, getMergedStore, math, RendererComponent } from '@galacean/effects';
import type { FileNode } from '../core/file-node';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { GLMaterial } from '@galacean/effects-webgl';

export class Editor {
  target: object;

  onInspectorGUI () {
    const component = this.target as Component;
    const alignWidth = 150;
    const propertyDecoratorStore = getMergedStore(component);

    for (const propertyName of Object.keys(component)) {
      const key = propertyName as keyof Component;
      const property = component[key];
      const ImGuiID = component.getInstanceId() + propertyName;

      if (typeof property === 'number') {
        EditorGUILayout.FloatField(propertyName, component, key);
      } else if (typeof property === 'boolean') {
        EditorGUILayout.Checkbox(propertyName, component, key);
      } else if (property instanceof math.Vector3) {
        EditorGUILayout.Vector3Field(propertyName, property);
      } else if (property instanceof math.Color) {
        EditorGUILayout.ColorField(propertyName, property);
      } else if (property instanceof EffectsObject) {
        ImGui.Text(propertyName);
        ImGui.SameLine(alignWidth);
        let name = 'EffectsObject';

        if (property.name) {
          name = property.name;
        }
        ImGui.Button(name, new ImGui.Vec2(200, 0));
        if (ImGui.BeginDragDropTarget()) {
          const payload = ImGui.AcceptDragDropPayload(property.constructor.name);

          if (payload) {
            void (payload.Data as FileNode).getFile().then(async (file: File | undefined)=>{
              if (!file) {
                return;
              }
              const effectsPackage = await GalaceanEffects.assetDataBase.loadPackageFile(file);

              if (!effectsPackage) {
                return;
              }
              //@ts-expect-error
              component[key] = effectsPackage.exportObjects[0] as Material;
            });
          }
          ImGui.EndDragDropTarget();
        }
      }
    }
    if (component instanceof RendererComponent) {
      ImGui.Text('Material');
      ImGui.SameLine(alignWidth);
      ImGui.Button(component.material?.name ?? '', new ImGui.Vec2(200, 0));

      if (ImGui.BeginDragDropTarget()) {
        const payload = ImGui.AcceptDragDropPayload(GLMaterial.name);

        if (payload) {
          void (payload.Data as FileNode).getFile().then(async (file: File | undefined)=>{
            if (!file) {
              return;
            }
            const effectsPackage = await GalaceanEffects.assetDataBase.loadPackageFile(file);

            if (!effectsPackage) {
              return;
            }
            component.material = effectsPackage.exportObjects[0] as Material;
          });
        }

        ImGui.EndDragDropTarget();
      }
    }
  }
}
