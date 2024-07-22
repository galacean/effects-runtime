import type { VFXItem } from '@galacean/effects';
import { editorWindow } from '../core/decorators';
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