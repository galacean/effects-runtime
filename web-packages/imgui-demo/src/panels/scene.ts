import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui, ImGui_Impl } from '../imgui';
import { EditorWindow } from './editor-window';
import { OrbitController } from '../core/orbit-controller';
import { Selection } from '../core/selection';
import { CanvasGizmo } from '../core/canvas-gizmo';
import { VFXItem } from '@galacean/effects-core';
import { beginToolbar, endToolbar, toggleButton } from '../widgets';

@editorWindow()
export class Scene extends EditorWindow {
  sceneRendederTexture?: WebGLTexture;
  cameraController: OrbitController = new OrbitController();

  private _is2DMode: boolean = false;

  get is2DMode (): boolean {
    return this._is2DMode;
  }

  set is2DMode (value: boolean) {
    this._is2DMode = value;
    if (value) {
      GalaceanEffects.player.getCompositions()[0]?.getComponent(CanvasGizmo)?.reset2DCamera();
    }
  }

  @menuItem('Window/Scene')
  static showWindow () {
    EditorWindow.getWindow(Scene).open();
  }

  constructor () {
    super();
    this.title = 'Scene';
    this.open();

    this.is2DMode = true;
  }

  protected override onGUI (): void {
    if (!GalaceanEffects.player.getCompositions()[0]) {
      ImGui.End();

      return;
    }
    const player = GalaceanEffects.player;

    beginToolbar('##SceneToolbar');
    this.is2DMode = toggleButton('2D', this.is2DMode, { size: new ImGui.Vec2(32, 20) });
    endToolbar();

    const screenPos = ImGui.GetCursorScreenPos();

    const divElement = player.container;

    if (divElement) {
      divElement.style.left = screenPos.x + 'px';
      divElement.style.top = screenPos.y + 'px';
    }

    const sceneImageSize = ImGui.GetContentRegionAvail();

    if (player.container && (player.container.style.width !== sceneImageSize.x + 'px' ||
          player.container.style.height !== sceneImageSize.y + 'px')
    ) {
      player.container.style.width = sceneImageSize.x + 'px';
      player.container.style.height = sceneImageSize.y + 'px';
      player.resize();
    }

    if (GalaceanEffects.sceneRendederTexture) {
      const frame_padding = 0;                             // -1 === uses default padding (style.FramePadding)
      const uv0: ImGui.Vec2 = new ImGui.Vec2(0.0, 0.0);                        // UV coordinates for lower-left
      const uv1: ImGui.Vec2 = new ImGui.Vec2(1.0, 1.0);// UV coordinates for (32,32) in our texture
      const bg_col: ImGui.Vec4 = new ImGui.Vec4(0.0, 0.0, 0.0, 1.0);         // Black background
      const tint_col: ImGui.Vec4 = new ImGui.Vec4(1.0, 1.0, 1.0, 1.0);       // No tint

      if (this.is2DMode) {
        // 2D 模式：渲染 ImageButton 但将事件转发到 player.canvas
        ImGui.ImageButton(GalaceanEffects.sceneRendederTexture, new ImGui.Vec2(sceneImageSize.x, sceneImageSize.y), uv0, uv1, frame_padding, bg_col);

        const imguiCanvas = ImGui_Impl.getCanvas();

        // 转发鼠标事件到 player.canvas
        if (ImGui.IsItemHovered()) {
          const canvas = player.canvas;
          const buttonRectMin = ImGui.GetItemRectMin();
          const mousePos = ImGui.GetMousePos();
          const localX = mousePos.x - buttonRectMin.x;
          const localY = mousePos.y - buttonRectMin.y;

          // 转发鼠标按下事件
          for (let button = 0; button < 3; button++) {
            if (ImGui.IsMouseClicked(button)) {
              this.dispatchMouseEvent(canvas, 'mousedown', localX, localY, button);
            }
            if (ImGui.IsMouseReleased(button)) {
              this.dispatchMouseEvent(canvas, 'mouseup', localX, localY, button);
              this.dispatchMouseEvent(canvas, 'click', localX, localY, button);
            }
          }

          // 转发鼠标移动事件
          const io = ImGui.GetIO();

          if (io.MouseDelta.x !== 0 || io.MouseDelta.y !== 0) {
            this.dispatchMouseEvent(canvas, 'mousemove', localX, localY, 0);
          }

          // 转发滚轮事件
          const mouseWheel = io.MouseWheel || 0;
          const mouseWheelH = io.MouseWheelH || 0;

          if (mouseWheel !== 0 || mouseWheelH !== 0) {
            this.dispatchWheelEvent(canvas, localX, localY, mouseWheelH * 100, mouseWheel * -100);
          }

          // 同步 player.canvas 的 cursor 到 ImGui canvas
          if (imguiCanvas) {
            imguiCanvas.style.cursor = canvas.style.cursor || 'default';
          }
        } else {
          // 鼠标不在 ImageButton 上时，恢复 ImGui 默认 cursor
          if (imguiCanvas) {
            imguiCanvas.style.cursor = '';
          }
        }
      } else {
        // 3D 模式：正常的 ImageButton 交互
        ImGui.ImageButton(GalaceanEffects.sceneRendederTexture, new ImGui.Vec2(sceneImageSize.x, sceneImageSize.y), uv0, uv1, frame_padding, bg_col);

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
                const selectedObject = hitResults[hitResults.length - 1].item;

                Selection.select(selectedObject);
              }
            }
          }

          this.cameraController.update(player.getCompositions()[0].camera, sceneImageSize.x, sceneImageSize.y);
        }
      }
    }
  }

  private dispatchMouseEvent (
    target: HTMLCanvasElement,
    type: string,
    localX: number,
    localY: number,
    button: number
  ): void {
    const rect = target.getBoundingClientRect();
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + localX,
      clientY: rect.top + localY,
      button,
      buttons: button === 0 ? 1 : button === 1 ? 4 : 2,
    });

    target.dispatchEvent(event);
  }

  private dispatchWheelEvent (
    target: HTMLCanvasElement,
    localX: number,
    localY: number,
    deltaX: number,
    deltaY: number
  ): void {
    // 确保 delta 值是有限数
    const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
    const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;

    const rect = target.getBoundingClientRect();
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + localX,
      clientY: rect.top + localY,
      deltaX: safeDeltaX,
      deltaY: safeDeltaY,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    });

    target.dispatchEvent(event);
  }
}