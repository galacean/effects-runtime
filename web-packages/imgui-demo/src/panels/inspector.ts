import type { Material } from '@galacean/effects';
import { EffectsObject, RendererComponent, SerializationHelper, VFXItem, math, spec } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { UIManager } from '../core/ui-manager';
import { ImGui, ImGui_Impl } from '../imgui';
import { EditorGUILayout, createImguiTextureFromImage } from '../widgets/editor-gui-layout';
import { EditorWindow } from './editor-window';
import { Editor } from '../custom-editors/editor';
import type { GLMaterial } from '@galacean/effects-webgl';
import { GLTexture } from '@galacean/effects-webgl';
import type { FileNode } from '../core/file-node';
import { GalaceanEffects } from '../ge';

@editorWindow()
export class Inspector extends EditorWindow {

  private locked: boolean;
  private lockedObject: object;

  private defaultComponentEditor = new Editor();

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
    let activeObject = Selection.activeObject;

    if (this.locked) {
      activeObject = this.lockedObject;
    }

    if (activeObject instanceof VFXItem) {
      this.drawObjectTitle('VFXItem');
      this.drawVFXItemInspector(activeObject);
    } else {
      this.drawDefaultInspector(activeObject);
    }
  }

  private drawDefaultInspector (activeObject: object) {
    for (const propertyName of Object.keys(activeObject)) {
      const key = propertyName as keyof object;
      const property: any = activeObject[key];

      if (typeof property === 'number') {
        EditorGUILayout.FloatField(propertyName, activeObject, key);
      } else if (typeof property === 'string') {
        EditorGUILayout.TextField(propertyName, activeObject, key);
      } else if (typeof property === 'boolean') {
        EditorGUILayout.Checkbox(propertyName, activeObject, key);
      } else if (property instanceof math.Vector3) {
        EditorGUILayout.Vector3Field(propertyName, property);
      } else if (property instanceof math.Color) {
        EditorGUILayout.ColorField(propertyName, property);
      } else if (property instanceof EffectsObject) {
        EditorGUILayout.ObjectField(propertyName, activeObject, key);
      }
    }
  }

  private drawObjectTitle (title: string) {
    ImGui.Text(title);
    // draw Lock check box
    const rightOffset = ImGui.GetWindowWidth() - 85 - ImGui.GetStyle().ItemSpacing.x;

    ImGui.SameLine(rightOffset);
    ImGui.Text('Lock');
    ImGui.SameLine();
    if (ImGui.Checkbox('##Lock', (value = this.locked)=>this.locked = value)) {
      if (Selection.activeObject) {
        this.lockedObject = Selection.activeObject;
      }
    }
    ImGui.Separator();
  }

  private drawVFXItemInspector (activeObject: VFXItem) {
    EditorGUILayout.TextField('Name', activeObject, 'name');
    EditorGUILayout.TextField('GUID', activeObject, 'guid');

    EditorGUILayout.Label('Is Active');
    ImGui.Checkbox('##IsActive', (_ = activeObject.isActive) => {
      activeObject.setActive(_);

      return activeObject.isActive;
    });

    EditorGUILayout.FloatField('Duration', activeObject, 'duration');

    EditorGUILayout.Text('End Behavior', this.endBehaviorToString(activeObject.endBehavior));

    if (ImGui.CollapsingHeader(('Transform'), ImGui.TreeNodeFlags.DefaultOpen)) {
      const transform = activeObject.transform;

      EditorGUILayout.Vector3Field('Position', transform.position);
      EditorGUILayout.Vector3Field('Rotation', transform.rotation);
      EditorGUILayout.Vector3Field('Scale', transform.scale);

      transform.quat.setFromEuler(transform.rotation);
      transform.quat.conjugate();
      //@ts-expect-error
      transform.dirtyFlags.localData = true;
      //@ts-expect-error
      transform.dispatchValueChange();
    }

    for (const componet of activeObject.components) {
      const customEditor = UIManager.customEditors.get(componet.constructor);

      if (ImGui.CollapsingHeader(componet.constructor.name, ImGui.TreeNodeFlags.DefaultOpen)) {
        ImGui.PushID(componet.getInstanceId());

        EditorGUILayout.Checkbox('Enabled', componet, 'enabled');

        let editor = this.defaultComponentEditor;

        if (customEditor) {
          editor = customEditor;
        }

        editor.target = componet;
        editor.onInspectorGUI();

        ImGui.PopID();
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

    EditorGUILayout.Label('SurfaceType');
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

    EditorGUILayout.Label('RenderFace');
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

      EditorGUILayout.Label(inspectorName);
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

        if (texture instanceof GLTexture) {
          let __inspectorTexture = (texture as any).__imguiInspectorTexture as WebGLTexture;

          if (!__inspectorTexture && texture.defination.image) {
            __inspectorTexture = createImguiTextureFromImage(texture.defination.image);
            (texture as any).__imguiInspectorTexture = __inspectorTexture;
          }
          ImGui.ImageButton(__inspectorTexture, new ImGui.Vec2(100, 100));
        } else {
          ImGui.Button(inspectorName + '##' + uniformName, new ImGui.Vec2(100, 100));
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

    SerializationHelper.deserialize(serializedData, glMaterial);
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