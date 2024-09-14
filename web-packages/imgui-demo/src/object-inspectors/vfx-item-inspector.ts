import type { Component, Material } from '@galacean/effects';
import { EffectsObject, RendererComponent, SerializationHelper, VFXItem, getMergedStore, spec } from '@galacean/effects';
import { objectInspector } from '../core/decorators';
import { ObjectInspector } from './object-inspectors';
import type { GLMaterial } from '@galacean/effects-webgl';
import { GLTexture } from '@galacean/effects-webgl';
import type { FileNode } from '../core/file-node';
import { UIManager } from '../core/ui-manager';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';

@objectInspector(VFXItem)
export class VFXItemInspector extends ObjectInspector {

  private alignWidth = 150;

  constructor () {
    super();
    this.title = 'VFXItem';
  }

  override onGUI () {
    const activeObject = this.activeObject as VFXItem;
    const alignWidth = this.alignWidth;

    ImGui.Text('Name');
    ImGui.SameLine(alignWidth);
    ImGui.Text(activeObject.name);
    ImGui.Text('GUID');
    ImGui.SameLine(alignWidth);
    ImGui.Text(activeObject.getInstanceId());
    ImGui.Text('Visible');
    ImGui.SameLine(alignWidth);
    ImGui.Checkbox('##Visible', (_ = activeObject.getVisible()) => {
      activeObject.setVisible(_);

      return activeObject.getVisible();
    });

    ImGui.Text('End Behavior');
    ImGui.SameLine(alignWidth);
    ImGui.Text(this.endBehaviorToString(activeObject.endBehavior));

    if (ImGui.CollapsingHeader(('Transform'), ImGui.TreeNodeFlags.DefaultOpen)) {
      const transform = activeObject.transform;

      ImGui.Text('Position');
      ImGui.SameLine(alignWidth);
      ImGui.DragFloat3('##Position', transform.position, 0.03);
      ImGui.Text('Rotation');
      ImGui.SameLine(alignWidth);
      ImGui.DragFloat3('##Rotation', transform.rotation, 0.03);
      ImGui.Text('Scale');
      ImGui.SameLine(alignWidth);
      ImGui.DragFloat3('##Scale', transform.scale, 0.03);

      transform.quat.setFromEuler(transform.rotation);
      transform.quat.conjugate();
      //@ts-expect-error
      transform.dirtyFlags.localData = true;
      //@ts-expect-error
      transform.dispatchValueChange();
    }

    for (const componet of activeObject.components) {
      const customEditor = UIManager.customEditors.get(componet.constructor);

      if (customEditor) {
        if (ImGui.CollapsingHeader(componet.constructor.name, ImGui.TreeNodeFlags.DefaultOpen)) {
          customEditor.onInspectorGUI();
        }
        continue;
      }
      if (ImGui.CollapsingHeader(componet.constructor.name, ImGui.TreeNodeFlags.DefaultOpen)) {

        const propertyDecoratorStore = getMergedStore(componet);

        for (const peopertyName of Object.keys(componet)) {
          const key = peopertyName as keyof Component;
          const property = componet[key];
          const ImGuiID = componet.getInstanceId() + peopertyName;

          if (typeof property === 'number') {
            ImGui.Text(peopertyName);
            ImGui.SameLine(alignWidth);
            //@ts-expect-error
            ImGui.DragFloat('##DragFloat' + ImGuiID, (_ = componet[key]) => componet[key] = _, 0.03);
          } else if (typeof property === 'boolean') {
            ImGui.Text(peopertyName);
            ImGui.SameLine(alignWidth);
            //@ts-expect-error
            ImGui.Checkbox('##Checkbox' + ImGuiID, (_ = componet[key]) => componet[key] = _);
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
          ImGui.Button(componet.material?.name ?? '', new ImGui.Vec2(200, 0));

          if (ImGui.BeginDragDropTarget()) {
            const payload = ImGui.AcceptDragDropPayload('Material');

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
    if (activeObject.getComponent(RendererComponent)) {
      const material = activeObject.getComponent(RendererComponent).material;

      if (material && ImGui.CollapsingHeader(material.name + ' (Material)##CollapsingHeader', ImGui.TreeNodeFlags.DefaultOpen)) {
        this.drawMaterial(material);
      }
    }
  }

  private drawMaterial (material: Material) {
    if (!material) {
      return;
    }
    const glMaterial = material as GLMaterial;
    const serializedData = glMaterial.toData();
    const shaderProperties = material.shader.shaderData.properties;
    const alignWidth = 150;
    let dirtyFlag = false;

    if (!shaderProperties) {
      return;
    }

    // RenderType Combo
    const RenderType: string[] = [spec.RenderType.Opaque, spec.RenderType.Transparent];

    if (!serializedData.stringTags['RenderType']) {
      serializedData.stringTags['RenderType'] = spec.RenderType.Transparent;
    }
    let currentRenderTypeIndex = RenderType.indexOf(serializedData.stringTags['RenderType']);

    ImGui.Text('SurfaceType');
    ImGui.SameLine(alignWidth);
    if (ImGui.Combo('##RenderType', (value = currentRenderTypeIndex)=>currentRenderTypeIndex = value, RenderType)) {
      dirtyFlag = true;
    }
    serializedData.stringTags['RenderType'] = RenderType[currentRenderTypeIndex];

    // RenderFace Combo
    const RenderFace: string[] = [spec.RenderFace.Front, spec.RenderFace.Back, spec.RenderFace.Both];

    if (!serializedData.stringTags['RenderFace']) {
      serializedData.stringTags['RenderFace'] = spec.RenderFace.Both;
    }
    let currentRenderFaceIndex = RenderFace.indexOf(serializedData.stringTags['RenderFace']);

    ImGui.Text('RenderFace');
    ImGui.SameLine(alignWidth);
    if (ImGui.Combo('##RenderFace', (value = currentRenderFaceIndex)=>currentRenderFaceIndex = value, RenderFace)) {
      dirtyFlag = true;
    }
    serializedData.stringTags['RenderFace'] = RenderFace[currentRenderFaceIndex];
    const lines = shaderProperties.split('\n');

    for (const property of lines) {
      // 提取材质属性信息
      // 如 “_Float1("Float2", Float) = 0”
      // 提取出 “_Float1” “Float2” “Float” “0”
      const regex = /\s*(\s*\[[^\]]+\]\s*)*([^\s([\]]+)\s*\(\s*"(.+?)"\s*,\s*(.+?)\s*\)\s*=\s*(.+)\s*/;
      const matchResults = property.match(regex);

      if (!matchResults) {
        continue;
      }

      const attributesMatch = property.matchAll(/\[([^\]]+)\]/g);
      const attributes = Array.from(attributesMatch, m => m[1]);

      const uniformName = matchResults[2];
      const inspectorName = matchResults[3];
      const type = matchResults[4];
      const defaultValue = matchResults[5];

      // 提取 Range(a, b) 的 a 和 b
      const RangeMatch = type.match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);

      ImGui.Text(inspectorName);
      ImGui.SameLine(alignWidth);
      if (RangeMatch) {
        const start = Number(RangeMatch[1]);
        const end = Number(RangeMatch[2]);

        if (serializedData.floats[uniformName] === undefined) {
          serializedData.floats[uniformName] = Number(defaultValue);
        }
        if (ImGui.SliderFloat('##' + uniformName, (value = serializedData.floats[uniformName])=>serializedData.floats[uniformName] = value, start, end)) {
          dirtyFlag = true;
        }
      } else if (type === 'Float') {
        if (serializedData.floats[uniformName] === undefined) {
          serializedData.floats[uniformName] = Number(defaultValue);
        }
        if (attributes.includes('Toggle')) {
          if (ImGui.Checkbox('##' + uniformName, (value = Boolean(serializedData.floats[uniformName])) => (serializedData.floats[uniformName] as unknown as boolean) = value)) {
            dirtyFlag = true;
          }
        } else {
          if (ImGui.DragFloat('##' + uniformName, (value = serializedData.floats[uniformName])=>serializedData.floats[uniformName] = value, 0.02)) {
            dirtyFlag = true;
          }
        }
      } else if (type === 'Color') {
        if (!serializedData.colors[uniformName]) {
          serializedData.colors[uniformName] = { r:1.0, g:1.0, b:1.0, a:1.0 };
        }
        if (ImGui.ColorEdit4('##' + uniformName, serializedData.colors[uniformName])) {
          dirtyFlag = true;
        }
      } else if (type === 'Vector') {
        if (!serializedData.vector4s[uniformName]) {
          serializedData.vector4s[uniformName] = { x:1.0, y:1.0, z:0.0, w:0.0 };
        }
        if (ImGui.DragFloat4('##' + uniformName, serializedData.vector4s[uniformName], 0.02)) {
          dirtyFlag = true;
        }
      } else if (type === '2D') {
        const texture = glMaterial.getTexture(uniformName);

        if (texture) {
          ImGui.Button(texture.id, new ImGui.Vec2(200, 0));
        } else {
          ImGui.Button('  ' + '##' + uniformName, new ImGui.Vec2(200, 0));
        }
        if (ImGui.BeginDragDropTarget()) {
          const payload = ImGui.AcceptDragDropPayload(GLTexture.name);

          if (payload) {
            if (!serializedData.textures[uniformName]) {
              serializedData.textures[uniformName] = {
                texture:{ id:(payload.Data as FileNode).assetObject?.getInstanceId() + '' },
              };
            } else {
              serializedData.textures[uniformName].texture = { id:(payload.Data as FileNode).assetObject?.getInstanceId() + '' };
            }
            dirtyFlag = true;
          }

          ImGui.EndDragDropTarget();
        }
      }
    }

    SerializationHelper.deserializeTaggedProperties(serializedData, glMaterial);
    if (dirtyFlag) {
      GalaceanEffects.assetDataBase.setDirty(glMaterial.getInstanceId());
    }
  }

  private endBehaviorToString (endBehavior: spec.EndBehavior) {
    let result = '';

    switch (endBehavior) {
      case spec.EndBehavior.destroy:
        result = 'Destroy';

        break;
      case spec.EndBehavior.forward:
        result = 'Forward';

        break;
      case spec.EndBehavior.freeze:
        result = 'Freeze';

        break;
      case spec.EndBehavior.restart:
        result = 'Restart';

        break;
    }

    return result;
  }
}