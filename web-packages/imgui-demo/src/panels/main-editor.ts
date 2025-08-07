import type { VFXItem } from '@galacean/effects';
import { editorWindow } from '../core/decorators';
import { OrbitController } from '../core/orbit-controller';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';

type char = number;
type int = number;
type short = number;
type float = number;
type double = number;

@editorWindow()
export class MainEditor extends EditorWindow {
  sceneRendederTexture?: WebGLTexture;
  cameraController: OrbitController = new OrbitController();

  // Inspector
  private locked: boolean;
  private lockedObject: object;
  private alignWidth = 150;

  private lightBlue = new ImGui.ImVec4(0.25, 0.34, 0.43, 1.0);
  private highlightBlue = new ImGui.ImVec4(0.000, 0.43, 0.87, 1.000);

  constructor () {
    super();
    this.open();
  }

  override draw () {
    this.drawHierarchyGUI();
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

    const pos = ImGui.GetWindowPos();
    const windowSize = ImGui.GetWindowSize();
    const divElement = player.container;

    if (divElement) {
      divElement.style.position = 'absolute';
      divElement.style.left = (pos.x + windowSize.x / 2) + 'px';
      divElement.style.top = (pos.y + windowSize.y * 0.9) + 'px';
    }

    if (player.container && (player.container.style.width !== sceneImageSize.x + 'px' ||
      player.container.style.height !== sceneImageSize.y + 'px')
    ) {
      player.container.style.width = sceneImageSize.x + 'px';
      player.container.style.height = sceneImageSize.y + 'px';
      player.resize();
    }
    if (GalaceanEffects.sceneRendederTexture && player.container && player.container.style.zIndex !== '999') {
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

    const highlightBlue = this.highlightBlue;
    const lightBlue = this.lightBlue;

    if (ImGui.IsWindowFocused()) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, highlightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, highlightBlue);
    } else {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, lightBlue);
    }

    if (ImGui.TreeNodeEx('Composition', base_flags.value | ImGui.TreeNodeFlags.DefaultOpen)) {
      this.generateHierarchyTree(GalaceanEffects.player.getCompositions()[0].rootItem, base_flags.value);
      ImGui.TreePop();
    }

    ImGui.PopStyleColor(3);

    ImGui.End();
  }

  private generateHierarchyTree (item: VFXItem, baseFlags: ImGui.TreeNodeFlags) {
    let nodeFlags: ImGui.TreeNodeFlags = baseFlags;
    let isSelected = false;

    if (Selection.activeObject === item) {
      isSelected = true;
      nodeFlags |= ImGui.TreeNodeFlags.Selected;
    }
    if (item.children.length === 0) {
      nodeFlags |= ImGui.TreeNodeFlags.Leaf;
    }
    if (item.name === 'rootItem') {
      nodeFlags |= ImGui.TreeNodeFlags.DefaultOpen;
    }

    if (isSelected && ImGui.IsWindowFocused()) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, this.highlightBlue);
    }
    const node_open: boolean = ImGui.TreeNodeEx(item.id, nodeFlags, item.name);

    if (ImGui.IsItemClicked() && !ImGui.IsItemToggledOpen()) {
      Selection.setActiveObject(item);
    }

    if (isSelected && ImGui.IsWindowFocused()) {
      ImGui.PopStyleColor(1);
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