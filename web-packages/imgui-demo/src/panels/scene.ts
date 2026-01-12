import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';
import { OrbitController } from '../core/orbit-controller';
import { Selection } from '../core/selection';

@editorWindow()
export class Scene extends EditorWindow {
  sceneRendederTexture?: WebGLTexture;
  cameraController: OrbitController = new OrbitController();

  @menuItem('Window/Scene')
  static showWindow () {
    EditorWindow.getWindow(Scene).open();
  }

  constructor () {
    super();
    this.title = 'Scene';
    this.open();
  }

  protected override onGUI (): void {
    if (!GalaceanEffects.player.getCompositions()[0]) {
      ImGui.End();

      return;
    }
    const sceneImageSize = ImGui.GetContentRegionAvail();

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
      const frame_padding = 0;                             // -1 === uses default padding (style.FramePadding)
      const uv0: ImGui.Vec2 = new ImGui.Vec2(0.0, 0.0);                        // UV coordinates for lower-left
      const uv1: ImGui.Vec2 = new ImGui.Vec2(1.0, 1.0);// UV coordinates for (32,32) in our texture
      const bg_col: ImGui.Vec4 = new ImGui.Vec4(0.0, 0.0, 0.0, 1.0);         // Black background

      ImGui.ImageButton(GalaceanEffects.sceneRendederTexture, new ImGui.Vec2(sceneImageSize.x, sceneImageSize.y), uv0, uv1, frame_padding, bg_col);

      // 获取鼠标相对于 ImageButton 的像素位置
      if (ImGui.IsItemHovered()) {
        // 检查鼠标释放时的拖动距离，只有拖动距离很小时才认为是单击
        if (ImGui.IsMouseReleased(ImGui.ImGuiMouseButton.Left)) {
          const dragDelta = ImGui.GetMouseDragDelta(ImGui.ImGuiMouseButton.Left, 0.0);
          const dragDistance = Math.sqrt(dragDelta.x * dragDelta.x + dragDelta.y * dragDelta.y);

          // 只有拖动距离小于 5 像素时才认为是单击
          if (dragDistance < 5.0) {
            const buttonRectMin = ImGui.GetItemRectMin();
            const buttonRectSize = ImGui.GetItemRectSize();
            const mousePos = ImGui.GetMousePos();
            const relativeX = (mousePos.x - buttonRectMin.x) / buttonRectSize.x * 2 - 1;
            const relativeY = (1 - (mousePos.y - buttonRectMin.y) / buttonRectSize.y) * 2 - 1;

            const hitResults = player.getCompositions()[0].hitTest(relativeX, relativeY, true);

            if (hitResults.length > 0) {
              Selection.setActiveObject(hitResults[hitResults.length - 1].item || null);
            }
          }
        }

        this.cameraController.update(player.getCompositions()[0].camera, sceneImageSize.x, sceneImageSize.y);
      }
    }
  }
}