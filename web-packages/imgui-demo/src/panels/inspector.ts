import type { Component, Material } from '@galacean/effects';
import { EffectsObject, RendererComponent, VFXItem, getMergedStore } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import type { FileNode } from '../core/file-node';
import { EditorWindow } from '../core/panel';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';

@editorWindow()
export class Inspector extends EditorWindow {

  @menuItem('Window/Inspector')
  static showWindow () {
    EditorWindow.getWindow(Inspector).open();
  }

  constructor () {
    super();
    this.title = 'Inspector';
    this.open();
  }

  protected override onGUI (): void {
    if (!Selection.activeObject) {
      ImGui.End();

      return;
    }
    const activeObject = Selection.activeObject;

    if (activeObject instanceof VFXItem) {
      ImGui.Text(activeObject.name);
      ImGui.Text(activeObject.getInstanceId());
      //@ts-expect-error
      ImGui.Checkbox('Visiable', (_ = activeObject.visible) => activeObject.visible = _);

      if (ImGui.CollapsingHeader(('Transform'), ImGui.TreeNodeFlags.DefaultOpen)) {
        const transform = activeObject.transform;

        ImGui.Text('Position');
        ImGui.SameLine(100);
        ImGui.DragFloat3('##Position', transform.position, 0.03);
        ImGui.Text('Rotation');
        ImGui.SameLine(100);
        ImGui.DragFloat3('##Rotation', transform.rotation, 0.03);
        ImGui.Text('Scale');
        ImGui.SameLine(100);
        ImGui.DragFloat3('##Scale', transform.scale, 0.03);

        transform.quat.setFromEuler(transform.rotation);
        transform.quat.conjugate();
        //@ts-expect-error
        transform.dirtyFlags.localData = true;
        //@ts-expect-error
        transform.dispatchValueChange();
      }

      const alignWidth = 150;

      for (const componet of activeObject.components) {
        if (ImGui.CollapsingHeader(componet.constructor.name, ImGui.TreeNodeFlags.DefaultOpen)) {

          const propertyDecoratorStore = getMergedStore(componet);

          for (const peopertyName of Object.keys(componet)) {
            const key = peopertyName as keyof Component;
            const property = componet[key];

            if (typeof property === 'number') {
              ImGui.Text(peopertyName);
              ImGui.SameLine(alignWidth);
              //@ts-expect-error
              ImGui.DragFloat('##DragFloat' + peopertyName, (_ = componet[key]) => componet[key] = _, 0.03);
            } else if (typeof property === 'boolean') {
              ImGui.Text(peopertyName);
              ImGui.SameLine(alignWidth);
              //@ts-expect-error
              ImGui.Checkbox('##Checkbox' + peopertyName, (_ = componet[key]) => componet[key] = _);
            } else if (property instanceof EffectsObject) {
              ImGui.Text(peopertyName);
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
                    componet[key] = effectsPackage.exportObjects[0] as Material;
                  });
                }
                ImGui.EndDragDropTarget();
              }
            }
          }
          if (componet instanceof RendererComponent) {
            ImGui.Text('Material');
            ImGui.SameLine(alignWidth);
            ImGui.Button(componet.material.name, new ImGui.Vec2(200, 0));

            if (ImGui.BeginDragDropTarget()) {
              const payload = ImGui.AcceptDragDropPayload(componet.material.constructor.name);

              if (payload) {
                void (payload.Data as FileNode).getFile().then(async (file: File | undefined)=>{
                  if (!file) {
                    return;
                  }
                  const effectsPackage = await GalaceanEffects.assetDataBase.loadPackageFile(file);

                  if (!effectsPackage) {
                    return;
                  }
                  componet.material = effectsPackage.exportObjects[0] as Material;
                });
              }

              ImGui.EndDragDropTarget();
            }
          }
        }
      }
    }
  }
}