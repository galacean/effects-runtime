import type { Component, Material } from '@galacean/effects';
import { EffectsObject, RendererComponent, VFXItem, getMergedStore } from '@galacean/effects';
import { editorWindow } from '../core/decorators';
import type { FileNode } from '../core/file-node';
import { OrbitController } from '../core/orbit-controller';
import { EditorWindow } from '../core/panel';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';

type char = number;
type int = number;
type short = number;
type float = number;
type double = number;

@editorWindow()
export class Editor extends EditorWindow {
  sceneRendederTexture?: WebGLTexture;
  cameraController: OrbitController = new OrbitController();

  constructor () {
    super();
    this.open();
  }

  override draw () {
    this.onGUI();
    this.onHierarchyGUI();
    this.onInspectorGUI();
    this.onSceneGUI();
  }

  onSceneGUI () {
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

  onHierarchyGUI () {
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

  onInspectorGUI () {
    ImGui.Begin('Inspector');
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
              ImGui.DragFloat('##DragFloat' + peopertyName, (_ = componet[key]) => componet[key] = _);
            } else if (typeof property === 'boolean') {
              ImGui.Text(peopertyName);
              ImGui.SameLine(alignWidth);
              //@ts-expect-error
              ImGui.Checkbox('##Checkbox' + peopertyName, (_ = componet[key]) => componet[key] = _);
            } else if (property instanceof EffectsObject) {
              ImGui.Text(peopertyName);
              ImGui.SameLine(alignWidth);
              ImGui.Button(property.name, new ImGui.Vec2(200, 0));
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
    ImGui.End();
  }

  generateHierarchyTree (item: VFXItem, baseFlags: ImGui.TreeNodeFlags) {
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

class StaticArray<T> {
  constructor (public count: number, public value: T[]) {}
  access (index: float): ImGui.Access<T> { return (value: T = this.value[index]): T => this.value[index] = value; }
}

const _static_array_map: Map<string, StaticArray<any>> = new Map();

function STATIC_ARRAY<T, N extends number = number> (count: N, key: string, init: T[]): StaticArray<T> {
  let value: StaticArray<T> | undefined = _static_array_map.get(key);

  if (value === undefined) { _static_array_map.set(key, value = new StaticArray<T>(count, init)); }

  return value;
}