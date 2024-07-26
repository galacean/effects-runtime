import type { Component, Material } from '@galacean/effects';
import { EffectsObject, RendererComponent, SerializationHelper, VFXItem, getMergedStore, spec } from '@galacean/effects';
import type { FileNode } from '../core/file-node';
import { OrbitController } from '../core/orbit-controller';
import { EditorWindow, editorWindow } from './editor-window';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import type { Editor } from './editor';
import { editorStore } from './editor';
import { GLTexture, type GLMaterial } from '@galacean/effects-webgl';

type char = number;
type int = number;
type short = number;
type float = number;
type double = number;

@editorWindow()
export class MainEditor extends EditorWindow {
  sceneRendederTexture?: WebGLTexture;
  cameraController: OrbitController = new OrbitController();
  private customEditors = new Map<Function, Editor>();

  // Inspector
  private locked: boolean;
  private lockedObject: object;
  private alignWidth = 150;

  constructor () {
    super();
    for (const key of editorStore.keys()) {
      const customEditorClass = editorStore.get(key);

      if (!customEditorClass) {
        continue;
      }
      this.customEditors.set(key, new customEditorClass());
    }
    this.open();
  }

  override draw () {
    this.drawHierarchyGUI();
    this.drawInspectorGUI();
    this.drawSceneGUI();
  }

  private drawSceneGUI () {
    ImGui.Begin('Scene', null, ImGui.ImGuiWindowFlags.NoCollapse);
    if (!GalaceanEffects.player.getCompositions()[0]) {
      ImGui.End();

      return;
    }
    const sceneImageSize = ImGui.GetWindowSize();

    sceneImageSize.x -= 15;
    sceneImageSize.y -= 40;
    const player = GalaceanEffects.player;

    if (player.container && (player.container.style.width !== sceneImageSize.x + 'px' ||
      player.container.style.height !== sceneImageSize.y + 'px')
    ) {
      player.container.style.width = sceneImageSize.x + 'px';
      player.container.style.height = sceneImageSize.y + 'px';
      player.resize();
    }
    if (GalaceanEffects.sceneRendederTexture) {
      const frame_padding: int = 0;                             // -1 === uses default padding (style.FramePadding)
      const uv0: ImGui.Vec2 = new ImGui.Vec2(0.0, 0.0);                        // UV coordinates for lower-left
      const uv1: ImGui.Vec2 = new ImGui.Vec2(1.0, 1.0);// UV coordinates for (32,32) in our texture
      const bg_col: ImGui.Vec4 = new ImGui.Vec4(0.0, 0.0, 0.0, 1.0);         // Black background

      ImGui.ImageButton(GalaceanEffects.sceneRendederTexture, new ImGui.Vec2(sceneImageSize.x, sceneImageSize.y), uv0, uv1, frame_padding, bg_col);
      if (ImGui.IsItemHovered()) {
        this.cameraController.update(player.getCompositions()[0].camera, sceneImageSize.x, sceneImageSize.y);
      }

    }
    ImGui.End();
  }

  private drawHierarchyGUI () {
    ImGui.Begin('Hierarchy');
    if (!GalaceanEffects.player.getCompositions()[0]) {
      ImGui.End();

      return;
    }
    const base_flags = STATIC<ImGui.TreeNodeFlags>(UNIQUE('base_flags#f8c171be'),
      ImGui.TreeNodeFlags.OpenOnArrow |
      ImGui.TreeNodeFlags.OpenOnDoubleClick |
      ImGui.TreeNodeFlags.SpanAvailWidth |
      ImGui.TreeNodeFlags.SpanFullWidth
    );

    if (ImGui.TreeNodeEx('Composition', base_flags.value | ImGui.TreeNodeFlags.DefaultOpen)) {
      this.generateHierarchyTree(GalaceanEffects.player.getCompositions()[0].rootItem, base_flags.value);
      ImGui.TreePop();
    }

    ImGui.End();
  }

  private drawInspectorGUI () {
    ImGui.Begin('Inspector');
    if (!Selection.activeObject) {
      ImGui.End();

      return;
    }
    const alignWidth = this.alignWidth;
    let activeObject = Selection.activeObject;

    if (this.locked) {
      activeObject = this.lockedObject;
    }

    if (activeObject instanceof VFXItem) {
      ImGui.Text('VFXItem');
      // draw Lock check box
      const rightOffset = ImGui.GetWindowWidth() - 85 - ImGui.GetStyle().ItemSpacing.x;

      ImGui.SameLine(rightOffset);
      ImGui.Text('Lock');
      ImGui.SameLine();
      if (ImGui.Checkbox('##Lock', (value = this.locked)=>this.locked = value)) {
        this.lockedObject = Selection.activeObject;
      }
      ImGui.Separator();

      ImGui.Text('Name');
      ImGui.SameLine(alignWidth);
      ImGui.Text(activeObject.name);
      ImGui.Text('GUID');
      ImGui.SameLine(alignWidth);
      ImGui.Text(activeObject.getInstanceId());
      ImGui.Text('Visible');
      ImGui.SameLine(alignWidth);
      //@ts-expect-error
      ImGui.Checkbox('##Visible', (_ = activeObject.visible) => activeObject.visible = _);

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
        const customEditor = this.customEditors.get(componet.constructor);

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
      if (activeObject.getComponent(RendererComponent)) {
        const material = activeObject.getComponent(RendererComponent).material;

        if (ImGui.CollapsingHeader(material.name + ' (Material)##CollapsingHeader', ImGui.TreeNodeFlags.DefaultOpen)) {
          this.drawMaterial(material);
        }

      }
    }
    ImGui.End();
  }

  private generateHierarchyTree (item: VFXItem, baseFlags: ImGui.TreeNodeFlags) {
    let nodeFlags: ImGui.TreeNodeFlags = baseFlags;

    if (Selection.activeObject === item) {
      nodeFlags |= ImGui.TreeNodeFlags.Selected;
    }
    if (item.children.length === 0) {
      nodeFlags |= ImGui.TreeNodeFlags.Leaf;
    }
    if (item.name === 'rootItem') {
      nodeFlags |= ImGui.TreeNodeFlags.DefaultOpen;
    }
    const node_open: boolean = ImGui.TreeNodeEx(item.id, nodeFlags, item.name);

    if (ImGui.IsItemClicked() && !ImGui.IsItemToggledOpen()) {
      Selection.setActiveObject(item);
    }

    if (node_open) {
      for (const child of item.children) {
        this.generateHierarchyTree(child, baseFlags);
      }
      ImGui.TreePop();
    }
  }

  private drawMaterial (material: Material) {
    const glMaterial = material as GLMaterial;
    const serializedData = glMaterial.toData();
    const shaderProperties = material.shader.shaderData.properties;
    const alignWidth = 150;
    let dirtyFlag = false;

    if (!shaderProperties) {
      return;
    }
    const RenderType: string[] = [spec.RenderType.Opaque, spec.RenderType.Transparent];

    if (!serializedData.stringTags['RenderType']) {
      serializedData.stringTags['RenderType'] = spec.RenderType.Transparent;
    }
    let currentRenderTypeIndex = RenderType.indexOf(serializedData.stringTags['RenderType']);

    ImGui.Text('RenderType');
    ImGui.SameLine(alignWidth);
    if (ImGui.Combo('##RenderFace', (value = currentRenderTypeIndex)=>currentRenderTypeIndex = value, RenderType)) {
      dirtyFlag = true;
    }
    serializedData.stringTags['RenderType'] = RenderType[currentRenderTypeIndex];
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
          }
          dirtyFlag = true;

          ImGui.EndDragDropTarget();
        }
      }
    }

    SerializationHelper.deserializeTaggedProperties(serializedData, glMaterial);
    if (dirtyFlag) {
      GalaceanEffects.assetDataBase.setDirty(glMaterial.getInstanceId());
    }
  }
}

function UNIQUE (key: string): string { return key; }

class Static<T> {
  constructor (public value: T) {}
  access: ImGui.Access<T> = (value: T = this.value): T => this.value = value;
}

const _static_map: Map<string, Static<any>> = new Map();

function STATIC<T> (key: string, init: T): Static<T> {
  let value: Static<T> | undefined = _static_map.get(key);

  if (value === undefined) { _static_map.set(key, value = new Static<T>(init)); }

  return value;
}