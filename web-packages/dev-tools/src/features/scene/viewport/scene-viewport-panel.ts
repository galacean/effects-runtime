import type { InputEventKey } from '@galacean/effects';
import { GizmoViewportUtils } from '@galacean/effects-plugin-editor-gizmo';
import { editorPanel, menuItem } from '../../../framework/registry/editor-registry';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { EditorWindow } from '../../../framework/windows/editor-window';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { ImGui } from '../../../platform/imgui/index';
import { EditorColors } from '../../../ui/theme/index';
import { sceneWorkspace } from '../scene-workspace';
import { OrbitController } from './orbit-controller';
import { SceneGizmo } from './scene-gizmo';
import { SceneToolbar } from './scene-toolbar';
import { SceneViewportInput } from './scene-viewport-input';

@editorPanel()
export class SceneViewportPanel extends EditorWindow {
  cameraController = new OrbitController();

  private _is2DMode = true;
  private gizmo?: SceneGizmo;
  private input?: SceneViewportInput;
  private showGrid = true;
  private showFPS = false;
  private frameTimeMS = 0;
  private pendingFit = false;
  private pendingSelectionFit = false;
  private viewportVisible = false;
  private updatingInput = false;
  private readonly toolbar = new SceneToolbar();

  get is2DMode (): boolean {
    return this._is2DMode;
  }

  set is2DMode (value: boolean) {
    if (this._is2DMode !== value) {
      this.input?.reset();
      this._is2DMode = value;
      this.gizmo?.set2DMode(value);
    }
  }

  @menuItem('Window/Scene')
  static showWindow () {
    EditorWindow.getWindow(SceneViewportPanel).open();
  }

  constructor () {
    super();
    this.title = 'Scene';
    this.setWindowFlags(ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
    this.open();
  }

  override update (dt: number): void {
    if (dt > 0 && Number.isFinite(dt)) {
      const sample = dt * 1000;

      this.frameTimeMS = this.frameTimeMS > 0 ? this.frameTimeMS * 0.9 + sample * 0.1 : sample;
    }
    this.title = 'Scene' + (sceneWorkspace.current?.dirty ? ' *' : '') + '###Scene';
    const composition = EditorRuntimeSession.player.getCompositions()[0];

    if (composition !== this.gizmo?.composition) {
      this.input?.dispose();
      this.gizmo?.dispose();
      this.input = undefined;
      this.gizmo = undefined;
      this.viewportVisible = false;
      if (composition && this.isOpened()) {
        this.gizmo = new SceneGizmo(composition);
        this.gizmo.set2DMode(this.is2DMode);
        this.gizmo.setVisible(false);
        this.input = new SceneViewportInput(composition.engine, event => this.handleShortcut(event));
        this.cameraController = new OrbitController();
        this.pendingFit = true;
      }
    }
  }

  override draw (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
    super.draw();
    ImGui.PopStyleVar();
  }

  protected override onDisable (): void {
    this.flushEdits();
    this.setViewportVisible(false);
  }

  override flushEdits (): void {
    if (this.updatingInput || !this.input || !this.gizmo) { return; }
    sceneWorkspace.observe('Transform selection', () => {
      this.input?.finish(); this.gizmo?.handler.resetEditMode();
    }, this.gizmo.selectedItems);
    sceneWorkspace.current?.setScopeActive(this, false);
  }

  override onUndoRedo (): void { this.input?.reset(); this.gizmo?.refreshSelection(); }

  frameAll (): void { this.pendingFit = true; }

  frameSelection (): void {
    this.open();
    this.pendingSelectionFit = true;
  }

  protected override onGUI (): void {
    this.toolbar.draw({
      gizmo: this.gizmo,
      is2DMode: this.is2DMode,
      showGrid: this.showGrid,
      showFPS: this.showFPS,
      set2DMode: value => this.is2DMode = value,
      setShowGrid: value => this.showGrid = value,
      setShowFPS: value => this.showFPS = value,
      resetView: () => {
        this.gizmo?.resetView();
        this.cameraController = new OrbitController();
      },
    });

    const player = EditorRuntimeSession.player;
    const origin = ImGui.GetCursorScreenPos();
    const available = ImGui.GetContentRegionAvail();
    const size = new ImGui.Vec2(available.x, available.y);
    let resized = false;

    if (size.x < 1 || size.y < 1) {
      this.setViewportVisible(false);

      return;
    }
    this.setViewportVisible(true);
    if (player.container) {
      player.container.style.left = `${origin.x}px`;
      player.container.style.top = `${origin.y}px`;
      if (player.container.style.width !== `${size.x}px` || player.container.style.height !== `${size.y}px`) {
        player.container.style.width = `${size.x}px`;
        player.container.style.height = `${size.y}px`;
        player.resize(); resized = true;
      }
    }

    const drawList = ImGui.GetWindowDrawList();

    drawList.AddRectFilled(origin, new ImGui.Vec2(origin.x + size.x, origin.y + size.y), ImGui.COL32(22, 24, 27, 255));
    if (this.gizmo) {
      if (this.pendingSelectionFit && this.is2DMode && !resized) {
        this.gizmo.frameSelection(); this.pendingSelectionFit = false; this.pendingFit = false;
      } else if (this.pendingFit && this.is2DMode && !resized) {
        this.pendingFit = !this.gizmo.frameAll();
      }
      if (this.showGrid && this.is2DMode) {
        this.drawGrid(origin, size);
      }
      ImGui.Image(EditorRuntimeSession.viewportTexture, size, new ImGui.Vec2(0, 1), new ImGui.Vec2(1, 0));
    } else {
      const message = 'Open a composition to start editing';
      const textSize = ImGui.CalcTextSize(message);

      drawList.AddText(new ImGui.Vec2(origin.x + (size.x - textSize.x) / 2, origin.y + size.y / 2),
        ImGui.GetColorU32(EditorColors.textSecondary), message);
    }

    if (this.showFPS) { this.drawFPS(origin, size); }
    ImGui.SetCursorScreenPos(origin);
    ImGui.InvisibleButton('##SceneViewport', size,
      ImGui.ButtonFlags.MouseButtonLeft | ImGui.ButtonFlags.MouseButtonRight | ImGui.ButtonFlags.MouseButtonMiddle);
    const hovered = ImGui.IsItemHovered();

    if (this.gizmo && this.is2DMode) {
      const changed = sceneWorkspace.observe('Transform selection', () => {
        this.updatingInput = true;
        try { this.input?.update(origin, hovered, ImGui.IsWindowFocused()); } finally { this.updatingInput = false; }
      }, this.gizmo.selectedItems);
      const editingText = this.gizmo.handler.getActiveEditMode().id === 'text-edit';

      if (changed || editingText) { sceneWorkspace.current?.setScopeActive(this, true); }
      if (!this.gizmo.handler.isMouseButtonPressed() && !editingText) { sceneWorkspace.current?.setScopeActive(this, false); }
    } else if (this.gizmo && hovered) {
      this.updatePerspective(size);
    }
  }

  private drawFPS (origin: ImGui.Vec2, size: ImGui.Vec2): void {
    const frameTime = this.frameTimeMS, fps = frameTime > 0 ? 1000 / frameTime : 0;
    const color = frameTime > 50 ? ImGui.COL32(233, 109, 99, 255) : frameTime > 33.9 ? ImGui.COL32(244, 186, 112, 255) : ImGui.COL32(127, 202, 159, 255);
    const draw = ImGui.GetWindowDrawList();
    const lines = [`${fps.toFixed(2)} FPS`, `${frameTime.toFixed(2)} ms`];

    draw.PushClipRect(origin, new ImGui.Vec2(origin.x + size.x, origin.y + size.y), true);
    lines.forEach((text, index) => {
      const x = origin.x + size.x - ImGui.CalcTextSize(text).x - 16, y = origin.y + 12 + index * ImGui.GetTextLineHeight() * 1.1;

      draw.AddText(new ImGui.Vec2(x + 1, y + 1), ImGui.COL32(0, 0, 0, 220), text);
      draw.AddText(new ImGui.Vec2(x, y), color, text);
    });
    draw.PopClipRect();
  }

  private drawGrid (origin: ImGui.Vec2, size: ImGui.Vec2): void {
    const engine = this.gizmo!.composition.engine;
    const translation = GizmoViewportUtils.getViewportTranslation(engine);
    const scale = this.gizmo!.scale;
    const spacing = 32 * scale * Math.pow(2, -Math.floor(Math.log2(scale)));
    const centerX = origin.x + size.x * (0.5 + translation.x / 2);
    const centerY = origin.y + size.y * (0.5 - translation.y / 2);
    const drawList = ImGui.GetWindowDrawList();
    const color = ImGui.COL32(255, 255, 255, 13);

    drawList.PushClipRect(origin, new ImGui.Vec2(origin.x + size.x, origin.y + size.y), true);
    for (let x = origin.x + ((centerX - origin.x) % spacing + spacing) % spacing; x < origin.x + size.x; x += spacing) {
      drawList.AddLine(new ImGui.Vec2(x, origin.y), new ImGui.Vec2(x, origin.y + size.y), color);
    }
    for (let y = origin.y + ((centerY - origin.y) % spacing + spacing) % spacing; y < origin.y + size.y; y += spacing) {
      drawList.AddLine(new ImGui.Vec2(origin.x, y), new ImGui.Vec2(origin.x + size.x, y), color);
    }
    drawList.AddLine(new ImGui.Vec2(origin.x, centerY), new ImGui.Vec2(origin.x + size.x, centerY), ImGui.COL32(170, 70, 70, 90));
    drawList.AddLine(new ImGui.Vec2(centerX, origin.y), new ImGui.Vec2(centerX, origin.y + size.y), ImGui.COL32(80, 150, 100, 90));
    drawList.PopClipRect();
  }

  private updatePerspective (size: ImGui.Vec2): void {
    if (ImGui.IsMouseReleased(ImGui.MouseButton.Left)) {
      const drag = ImGui.GetMouseDragDelta(ImGui.MouseButton.Left, 0);

      if (Math.hypot(drag.x, drag.y) < 5) {
        const min = ImGui.GetItemRectMin();
        const mouse = ImGui.GetMousePos();
        const hits = this.gizmo!.composition.hitTest((mouse.x - min.x) / size.x * 2 - 1, 1 - (mouse.y - min.y) / size.y * 2, true);

        EditorSelection.select(hits[hits.length - 1]?.item ?? null);
      }
    }
    this.cameraController.update(this.gizmo!.composition.camera, size.x, size.y);
  }

  private handleShortcut (event: InputEventKey): void {
    const gizmo = this.gizmo;

    if (!gizmo || !this.is2DMode || event.echo || event.ctrlPressed || event.metaPressed || event.altPressed) {
      return;
    }
    if (event.physicalKeycode === 'Escape') {
      if (gizmo.handler.getActiveEditMode().id !== 'default-selection') { gizmo.handler.resetEditMode(); } else { EditorSelection.clear(); }
    } else if (gizmo.handler.isMouseButtonPressed()) {
      return;
    } else if (event.physicalKeycode === 'KeyV' || event.physicalKeycode === 'KeyW') {
      gizmo.setTool('transform');
    } else if (event.physicalKeycode === 'KeyH') {
      gizmo.setTool('hand');
    } else if (event.physicalKeycode === 'KeyF') {
      gizmo.frameSelection();
    } else if (event.physicalKeycode === 'Home') {
      gizmo.frameAll();
    } else if (event.physicalKeycode === 'Enter' && gizmo.canEditText) {
      gizmo.editText();
    } else {
      return;
    }
    event.accept();
  }

  private setViewportVisible (visible: boolean): void {
    if (!visible && this.viewportVisible) {
      this.input?.reset();
    }
    this.viewportVisible = visible;
    this.gizmo?.setVisible(visible);
    const showTextOverlay = visible && ImGui.IsWindowFocused() && !ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup);

    EditorRuntimeSession.player.container?.style.setProperty('--scene-text-edit-visibility', showTextOverlay ? 'visible' : 'hidden');
  }
}
