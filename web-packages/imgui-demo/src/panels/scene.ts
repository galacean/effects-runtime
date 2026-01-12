import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';
import { OrbitController } from '../core/orbit-controller';
import { Camera2DController } from '../core/camera-2d-controller';
import { Selection } from '../core/selection';

@editorWindow()
export class Scene extends EditorWindow {
  sceneRendederTexture?: WebGLTexture;
  cameraController: OrbitController = new OrbitController();
  camera2DController: Camera2DController = new Camera2DController();
  is2DMode: boolean = false;

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

    const toolbarBgColor = new ImGui.Vec4(0.22, 0.22, 0.22, 1.0);
    const toolbarHeight = 22;

    // 绘制工具栏背景
    const drawList = ImGui.GetWindowDrawList();
    const cursorPos = ImGui.GetCursorScreenPos();
    const toolbarMin = new ImGui.Vec2(cursorPos.x, cursorPos.y);
    const toolbarMax = new ImGui.Vec2(cursorPos.x + ImGui.GetContentRegionAvail().x, cursorPos.y + toolbarHeight);

    drawList.AddRectFilled(toolbarMin, toolbarMax, ImGui.GetColorU32(toolbarBgColor));

    // 工具栏按钮样式
    const buttonActiveColor = new ImGui.Vec4(0.26, 0.37, 0.48, 1.0);
    const buttonNormalColor = new ImGui.Vec4(0.20, 0.20, 0.20, 0.0); // 透明（未选中状态）
    const buttonHoverColor = new ImGui.Vec4(0.30, 0.30, 0.30, 1.0); // 浅灰色（悬停状态） 70，96，124

    // 设置按钮位置在工具栏内
    ImGui.SetCursorPosY(ImGui.GetCursorPosY() + 1);
    ImGui.SetCursorPosX(ImGui.GetCursorPosX() + 4);

    // 2D 切换按钮
    ImGui.PushStyleColor(ImGui.ImGuiCol.Button, this.is2DMode ? buttonActiveColor : buttonNormalColor);
    ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonHovered, this.is2DMode ? new ImGui.Vec4(0.30, 0.63, 1.0, 1.0) : buttonHoverColor);
    ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonActive, buttonActiveColor);
    ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FrameRounding, 2.0);
    ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FramePadding, new ImGui.Vec2(8, 2));

    if (ImGui.Button('2D', new ImGui.Vec2(32, 18))) {
      this.is2DMode = !this.is2DMode;
      if (!this.is2DMode) {
        // 切换回 3D 模式时重置 2D 控制器
        this.camera2DController.reset();
      }
    }
    ImGui.PopStyleVar(2);
    ImGui.PopStyleColor(3);

    // 移动光标到工具栏后面
    ImGui.SetCursorPosY(ImGui.GetCursorPosY() + 2);

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

        // 根据当前模式使用不同的相机控制器
        if (this.is2DMode) {
          this.camera2DController.update(player.getCompositions()[0].camera, sceneImageSize.x, sceneImageSize.y);
        } else {
          this.cameraController.update(player.getCompositions()[0].camera, sceneImageSize.x, sceneImageSize.y);
        }
      }
    }
  }
}