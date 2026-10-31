import type { Engine, InputEventKey, InputEventMouseButton } from '@galacean/effects';
import { InputEventMouseMotion, MouseButton, MouseButtonMask, math } from '@galacean/effects';
import { Control, FocusMode } from '@galacean/effects-plugin-gui';
import { GizmoViewportUtils } from '@galacean/effects-plugin-editor-gizmo';
import { editorPanel, menuItem } from '../../../framework/registry/editor-registry';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { EditorWindow } from '../../../framework/windows/editor-window';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { append, column, expand, screenPosition } from '../../../ui/controls/layout';
import { editorColors, EDITOR_FONT, EDITOR_FONT_SIZE } from '../../../ui/theme/control-theme';
import { TexturePresentation, imageTexturePreview } from '../../assets/preview/texture-preview';
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
  private viewport?: SceneViewport;
  private showGrid = true;
  private showFPS = false;
  private frameTimeMS = 0;
  private pendingFit = false;
  private pendingSelectionFit = false;
  private updatingInput = false;
  private stableViewportFrames = 0;

  get is2DMode (): boolean { return this._is2DMode; }
  set is2DMode (value: boolean) {
    if (this._is2DMode !== value) { this.input?.reset(); this._is2DMode = value; this.gizmo?.set2DMode(value); }
  }
  @menuItem('Window/Scene')
  static showWindow (): void { EditorWindow.getWindow(SceneViewportPanel).open(); }
  constructor () { super(); this.title = 'Scene'; this.open(); }
  override get layoutId (): string { return 'Scene'; }
  protected override createContent (engine: Engine): Control {
    const root = column(engine);
    const toolbar = new SceneToolbar(engine, () => ({
      gizmo: this.gizmo, is2DMode: this.is2DMode, showGrid: this.showGrid, showFPS: this.showFPS,
      set2DMode: value => this.is2DMode = value, setShowGrid: value => this.showGrid = value, setShowFPS: value => this.showFPS = value,
      resetView: () => { this.gizmo?.resetView(); this.cameraController = new OrbitController(); },
    }));

    append(root, toolbar);
    this.viewport = append(root, expand(new SceneViewport(engine, this)));

    return root;
  }
  override update (dt: number): void {
    this.title = 'Scene' + (sceneWorkspace.current?.dirty ? ' *' : '');
    if (dt > 0 && Number.isFinite(dt)) { this.frameTimeMS = this.frameTimeMS ? this.frameTimeMS * .9 + dt * 100 : dt * 1000; }
    const composition = EditorRuntimeSession.player.getCompositions()[0];

    if (composition !== this.gizmo?.composition) {
      this.input?.dispose(); this.gizmo?.dispose(); this.input = undefined; this.gizmo = undefined;
      if (composition) {
        this.gizmo = new SceneGizmo(composition); this.gizmo.set2DMode(this.is2DMode);
        this.input = new SceneViewportInput(composition.engine, event => this.handleShortcut(event));
        this.cameraController = new OrbitController(); this.pendingFit = true;
      }
    }
    this.gizmo?.setVisible(!!this.viewport?.visibleInHierarchy);
  }
  protected override onDisable (): void {
    this.flushEdits(); this.input?.reset(); this.gizmo?.setVisible(false);
    EditorRuntimeSession.player?.container?.style.setProperty('--scene-text-edit-visibility', 'hidden');
  }
  override flushEdits (): void {
    if (this.updatingInput || !this.input || !this.gizmo) { return; }
    sceneWorkspace.observe('Transform selection', () => { this.input?.finish(); this.gizmo?.handler.resetEditMode(); }, this.gizmo.selectedItems);
    sceneWorkspace.current?.setScopeActive(this, false);
  }
  override onUndoRedo (): void { this.input?.reset(); this.gizmo?.refreshSelection(); }
  frameAll (): void { this.pendingFit = true; }
  frameSelection (): void { this.open(); this.pendingSelectionFit = true; }
  resizeViewport (viewport: Control): void {
    const player = EditorRuntimeSession.player, container = player.container;

    if (!container || !viewport.visibleInHierarchy || viewport.width < 1 || viewport.height < 1) { return; }
    const origin = screenPosition(viewport), width = Math.floor(viewport.width), height = Math.floor(viewport.height);

    container.style.left = Math.floor(origin.x) + 'px'; container.style.top = Math.floor(origin.y) + 'px';
    const resized = container.style.width !== width + 'px' || container.style.height !== height + 'px';

    if (resized) { container.style.width = width + 'px'; container.style.height = height + 'px'; player.resize(); }
    this.stableViewportFrames = resized ? 0 : this.stableViewportFrames + 1;
    if (this.gizmo && this.is2DMode && this.stableViewportFrames >= 2) {
      if (this.pendingSelectionFit) { this.gizmo.frameSelection(); this.pendingSelectionFit = this.pendingFit = false; } else if (this.pendingFit) { this.pendingFit = !this.gizmo.frameAll(); }
    }
    if (this.gizmo && !this.is2DMode) { this.cameraController.update(this.gizmo.composition.camera, width, height); }
    container.style.setProperty('--scene-text-edit-visibility', viewport.hasFocus() ? 'visible' : 'hidden');
  }
  mouse (event: InputEventMouseButton | InputEventMouseMotion, click = false): void {
    if (!this.gizmo) { return; }
    if (this.is2DMode) {
      this.updatingInput = true;
      const changed = sceneWorkspace.observe('Transform selection', () => this.input?.mouse(event), this.gizmo.selectedItems);

      this.updatingInput = false;
      const editing = this.gizmo.handler.getActiveEditMode().id === 'text-edit';

      if (changed || editing) { sceneWorkspace.current?.setScopeActive(this, true); }
      if (!this.gizmo.handler.isMouseButtonPressed() && !editing) { sceneWorkspace.current?.setScopeActive(this, false); }
    } else if (event instanceof InputEventMouseMotion) {
      if (event.buttonMask & MouseButtonMask.Left) { this.cameraController.handleRotate(event.relative.x, event.relative.y); }
      if (event.buttonMask & MouseButtonMask.Middle) { this.cameraController.handlePan(event.relative.x, event.relative.y); }
    } else if (event.buttonIndex === MouseButton.WheelUp || event.buttonIndex === MouseButton.WheelDown) {
      this.cameraController.handleZoom(event.factor * (event.buttonIndex === MouseButton.WheelUp ? 1 : -1));
    } else if (click && this.viewport) {
      const hits = this.gizmo.composition.hitTest(event.position.x / this.viewport.width * 2 - 1, 1 - event.position.y / this.viewport.height * 2, true);

      EditorSelection.select(hits[hits.length - 1]?.item ?? null);
    }
    event.accept();
  }
  key (event: InputEventKey): void { this.input?.key(event); }
  leave (): void { this.input?.leave(); }
  drawBackground (control: Control): void {
    control.fillRect(0, 0, control.width, control.height, new math.Color(22 / 255, 24 / 255, 27 / 255, 1));
    if (!this.gizmo) {
      const text = 'Open a composition to start editing', size = control.measureText(text, EDITOR_FONT_SIZE, EDITOR_FONT);

      control.drawText((control.width - size.width) / 2, (control.height - size.lineHeight) / 2, text, EDITOR_FONT_SIZE, editorColors.muted, EDITOR_FONT);

      return;
    }
    if (!this.showGrid || !this.is2DMode) { return; }
    const translation = GizmoViewportUtils.getViewportTranslation(this.gizmo.composition.engine), scale = this.gizmo.scale;
    const spacing = 32 * scale * Math.pow(2, -Math.floor(Math.log2(scale)));
    const cx = control.width * (.5 + translation.x / 2), cy = control.height * (.5 - translation.y / 2);
    const grid = new math.Color(1, 1, 1, .05);

    for (let x = (cx % spacing + spacing) % spacing; x < control.width; x += spacing) { control.drawLine(x, 0, x, control.height, grid); }
    for (let y = (cy % spacing + spacing) % spacing; y < control.height; y += spacing) { control.drawLine(0, y, control.width, y, grid); }
    control.drawLine(0, cy, control.width, cy, new math.Color(.67, .27, .27, .35));
    control.drawLine(cx, 0, cx, control.height, new math.Color(.31, .59, .39, .35));
  }
  drawOverlay (control: Control): void {
    if (!this.showFPS) { return; }
    const ms = this.frameTimeMS, tint = ms > 50 ? new math.Color(.91, .43, .39, 1) : ms > 33.9 ? new math.Color(.96, .73, .44, 1) : new math.Color(.5, .79, .62, 1);

    [(ms > 0 ? 1000 / ms : 0).toFixed(2) + ' FPS', ms.toFixed(2) + ' ms'].forEach((text, index) => {
      control.drawText(control.width - control.measureText(text, EDITOR_FONT_SIZE, EDITOR_FONT).width - 16, 12 + index * 18, text, EDITOR_FONT_SIZE, tint, EDITOR_FONT);
    });
  }
  private handleShortcut (event: InputEventKey): void {
    const gizmo = this.gizmo;

    if (!gizmo || !this.is2DMode || event.echo || event.ctrlPressed || event.metaPressed || event.altPressed) { return; }
    if (event.physicalKeycode === 'Escape') {
      if (gizmo.handler.getActiveEditMode().id !== 'default-selection') { gizmo.handler.resetEditMode(); } else { EditorSelection.clear(); }
    } else if (gizmo.handler.isMouseButtonPressed()) { return; } else if (event.physicalKeycode === 'KeyV' || event.physicalKeycode === 'KeyW') { gizmo.setTool('transform'); } else if (event.physicalKeycode === 'KeyH') { gizmo.setTool('hand'); } else if (event.physicalKeycode === 'KeyF') { gizmo.frameSelection(); } else if (event.physicalKeycode === 'Home') { gizmo.frameAll(); } else if (event.physicalKeycode === 'Enter' && gizmo.canEditText) { gizmo.editText(); } else { return; }
    event.accept();
  }
}

class SceneViewport extends Control {
  private readonly presentation: TexturePresentation;
  private pressedAt?: math.Vector2;
  private dragDistance = 0;
  constructor (engine: Engine, private readonly panel: SceneViewportPanel) {
    super(engine); this.focusMode = FocusMode.All;
    this.presentation = new TexturePresentation(engine);
  }
  override update (dt: number): void {
    this.panel.resizeViewport(this);
    if (this.visibleInHierarchy) { this.presentation.update(imageTexturePreview({ texture: () => EditorRuntimeSession.device.sceneTexture, flipY: true }), undefined, Math.max(this.width, this.height) * window.devicePixelRatio); }
    super.update(dt);
  }
  override draw (): void {
    const graphics = this.engine.renderingServer.graphics;

    graphics.pushClipRect(0, 0, this.width, this.height);
    this.panel.drawBackground(this); this.presentation.draw(this, 0, 0, this.width, this.height); this.panel.drawOverlay(this);
    graphics.popClipRect();
  }
  override onMouseDown (event: InputEventMouseButton): void {
    this.grabFocus(); this.pressedAt = event.position.clone(); this.dragDistance = 0; this.panel.mouse(event);
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.pressedAt) { this.dragDistance = Math.max(this.dragDistance, event.position.clone().subtract(this.pressedAt).length()); }
    this.panel.mouse(event);
  }
  override onMouseUp (event: InputEventMouseButton): void {
    this.panel.mouse(event, !!this.pressedAt && this.dragDistance < 5 && event.buttonIndex === MouseButton.Left && !event.canceled);
    this.pressedAt = undefined;
  }
  override onMouseWheel (event: InputEventMouseButton): void { this.panel.mouse(event); }
  override onMouseLeave (): void { this.panel.leave(); }
  override onKeyDown (event: InputEventKey): void { this.panel.key(event); }
  override onKeyUp (event: InputEventKey): void { this.panel.key(event); }
  override onDestroy (): void { this.presentation.dispose(); super.onDestroy(); }
}
