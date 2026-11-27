import { EventEmitter, math, spec, type VFXItem, type Composition, type EventEmitterListener, type InputEventKey, type InputEventMouseButton, type InputEventMouseMotion, type MouseButton } from '@galacean/effects';
import { Control, FocusMode, MouseFilter, type ControlEvent } from '@galacean/effects-plugin-gui';
import type { Selection } from '../2d/selection/selection';
import type { Editor } from '../editor';
import type { Point2, Point3, Ray3 } from '../math/types';
import { rayPlanePoint } from '../math/plane';
import type { Gizmo3D } from './gizmo/gizmo-3d';
import { EditorPrimitives } from './gizmo/editor-primitives';
import { GridGizmo } from './gizmo/grid-gizmo';
import { BoxSelection3D } from './gizmo/box-selection-3d';
import { TransformGizmo, type PivotType, type TransformSpace, type TransformActionEvent, type TransformMode } from './gizmo/transform-gizmo';
import { ViewportCamera } from './viewport/cameras/viewport-camera';
import type { ViewportCameraEvent } from './viewport/cameras/viewport-camera-types';
import { DirectionGizmo } from './gizmo/direction-gizmo';
import { transformGizmoStyle } from './gizmo/gizmo-settings';

export type ViewportTool = TransformMode | 'camera';

export type Editor3DInteractionEvents = {
  keyDown: [event: InputEventKey],
  actionstart: [event: TransformActionEvent],
  actionupdate: [event: TransformActionEvent],
  actioncommit: [event: TransformActionEvent],
  camerachange: [event: ViewportCameraEvent],
  toolchange: [tool: ViewportTool, space: TransformSpace],
};

export type Editor3DEvents = ControlEvent & Editor3DInteractionEvents;

const marqueeFill = math.Color.fromHexString('#79adff26');
const marqueeOutline = math.Color.fromHexString('#79adffff');

function isInteractionEvent (name: keyof Editor3DEvents): name is keyof Editor3DInteractionEvents {
  return name === 'actionstart' || name === 'actionupdate' || name === 'actioncommit' || name === 'camerachange'
    || name === 'toolchange' || name === 'keyDown';
}

interface PointerCapture {
  handler: {
    onMouseDown(event: InputEventMouseButton): void,
    onMouseDrag?(event: InputEventMouseMotion): void,
    onMouseUp?(event: InputEventMouseButton): void,
    onKeyDown?(event: InputEventKey): void,
  },
  button: MouseButton,
  start: math.Vector2,
  dragging: boolean,
}

/** A full-rect GUI control with its own spatial tools, input capture and drawing lifecycle. */
export class Editor3D extends Control {
  readonly gizmos: Gizmo3D[] = [];
  readonly transformGizmo: TransformGizmo;
  readonly viewportCamera: ViewportCamera;
  readonly directionGizmo: DirectionGizmo;
  readonly boxSelection: BoxSelection3D;
  readonly grid: GridGizmo;
  private _activeGizmo?: Gizmo3D;
  private gizmoRenderer?: EditorPrimitives;
  private readonly offSelectionChange: () => void;
  private offCameraUpdate?: () => void;
  private capture?: PointerCapture;
  private readonly gizmoEvents = new EventEmitter<Editor3DEvents>();
  readonly emit: EventEmitter<Editor3DInteractionEvents>['emit'] = this.gizmoEvents.emit;

  constructor (private readonly editor: Editor) {
    super(editor.engine);
    this.setAnchorsAndOffsetsPreset('fullRect');
    this.mouseFilter = MouseFilter.Stop;
    this.mouseForcePassScrollEvents = false;
    this.focusMode = FocusMode.Click;
    this.viewportCamera = new ViewportCamera(this);
    this.directionGizmo = this.addChild(new DirectionGizmo(this));
    this.transformGizmo = new TransformGizmo(this);
    this.boxSelection = new BoxSelection3D(this);
    this.grid = new GridGizmo(this);
    this.activeGizmo = this.transformGizmo;
    this.offSelectionChange = editor.selection.on('selectionchange', () => {
      if (this.enabled) {
        this.cancel('selection');
        this.gizmos.forEach(gizmo => gizmo.onSelectionChanged());
        this.updateGizmos();
      }
    });
  }

  get activeGizmo (): Gizmo3D | undefined { return this._activeGizmo; }
  set activeGizmo (gizmo: Gizmo3D | undefined) {
    if (gizmo === this._activeGizmo) { return; }
    if (gizmo && !this.gizmos.includes(gizmo)) { throw new Error('The active gizmo must belong to this viewport.'); }
    const previous = this._activeGizmo;

    this._activeGizmo = undefined;
    previous?.onDeactivated();
    this._activeGizmo = gizmo;
    gizmo?.onActivated();
  }

  get selection (): Selection { return this.editor.selection; }

  /** Optional document roots used for picking and selection. */
  selectableItems?: ReadonlySet<VFXItem>;
  lockedItems: ReadonlySet<VFXItem> = new Set();

  get selectedItems (): readonly VFXItem[] {
    return this.selection.getSelectedPlayerItems().filter(item => !this.selectableItems || this.selectableItems.has(item));
  }

  select (items: readonly VFXItem[], active?: VFXItem): void {
    const hits = new Set(items);
    const roots = items.filter(item => {
      for (let parent = item.parent; parent; parent = parent.parent) {
        if (hits.has(parent)) { return false; }
      }

      return true;
    });
    const ordered = active && roots.includes(active) ? [...roots.filter(item => item !== active), active] : roots;

    this.selection.setSelectedItems(ordered.map(item => item.getInstanceId()));
  }

  canTransform (item: VFXItem): boolean {
    if (item.composition !== this.composition || this.selectableItems && !this.selectableItems.has(item)) { return false; }
    for (let node: VFXItem | undefined = item; node; node = node.parent) {
      if (!node.isVisible || !node.isActive || this.lockedItems.has(node)) { return false; }
    }

    return true;
  }

  getSelectionCandidates (): VFXItem[] {
    const composition = this.composition;

    if (!composition) { return []; }

    return Array.from(this.selectableItems ?? composition.items).filter(item => {
      if (item.composition !== composition || item.type === spec.ItemType.skybox) { return false; }
      for (let node: VFXItem | undefined = item; node; node = node.parent) {
        if (!node.isActive || !node.isVisible) { return false; }
      }

      return true;
    });
  }

  /** @internal Activate viewport input or roll back the current interaction. */
  setActive (active: boolean): void {
    if (!active) {
      this.offCameraUpdate?.();
      this.offCameraUpdate = undefined;
      this.cancel('mode-change');
      this.viewportCamera.restoreSceneCamera();
    }
    this.enabled = active;
    if (active) {
      if (!this.gizmoRenderer) {
        this.gizmoRenderer = new EditorPrimitives(this);
        this.engine.renderer.addRendererFeature(this.gizmoRenderer);
      }
      // Camera navigation must finish before scene components collect their render data.
      this.offCameraUpdate ??= this.engine.on('update', deltaTime => this.viewportCamera.update(deltaTime));
      this.viewportCamera.applyToComposition();
      this.updateGizmos();
    }
    this.visible = active;
    if (active) { this.grabFocus(true); }
  }

  get composition (): Composition | undefined {
    const composition = this.engine.sceneServer.compositions[0];

    return composition?.isDestroyed ? undefined : composition;
  }

  /** @internal Keep the visible handles and their hit regions current between frames. */
  updateGizmos (): void {
    if (!this.enabled || this.isDisposed) { return; }
    this.gizmos.forEach(gizmo => gizmo.update());
    this.directionGizmo.updateDrawing();
  }

  get viewportSize (): math.Vector2 {
    const { width, height } = this.engine.canvas.getBoundingClientRect();

    return new math.Vector2(width, height);
  }

  /** Convert a canvas-local CSS pixel to the composition hit-test coordinates. */
  toNDC (point: Point2): math.Vector2 | undefined {
    const size = this.viewportSize;

    if (size.x > 0 && size.y > 0) { return new math.Vector2(2 * point.x / size.x - 1, 1 - 2 * point.y / size.y); }
  }

  ray (point: Point2): Ray3 | undefined {
    const ndc = this.toNDC(point);

    return ndc && this.composition?.getHitTestRay(ndc.x, ndc.y);
  }

  project (point: Point3): math.Vector2 | undefined {
    const composition = this.composition;

    if (!composition) { return; }
    const ndc = new math.Vector3(point.x, point.y, point.z).applyProjectionMatrix(composition.camera.getViewProjectionMatrix());
    const size = this.viewportSize;
    const { x, y, z, w } = composition.editorTransform;

    if (size.x > 0 && size.y > 0 && Number.isFinite(ndc.x) && Number.isFinite(ndc.y)) {
      return new math.Vector2((1 + x * ndc.x + z) * size.x / 2, (1 - y * ndc.y - w) * size.y / 2);
    }
  }

  /** Unproject a CSS pixel onto the camera-facing plane through a world point. */
  unproject (point: Point2, worldPoint: Point3): math.Vector3 | undefined {
    const ray = this.ray(point);
    const camera = this.composition?.camera;

    if (!ray || !camera) { return; }
    const normal = camera.getInverseViewMatrix().transformNormal(new math.Vector3(0, 0, 1));
    const hit = rayPlanePoint(ray, worldPoint, normal);

    return hit && new math.Vector3(hit.x, hit.y, hit.z);
  }

  /** World length of a fixed CSS-pixel handle at this depth. */
  getHandleSize (worldPoint: Point3): number {
    const screen = this.project(worldPoint);
    const edge = screen && this.unproject({ x: screen.x + transformGizmoStyle.size, y: screen.y }, worldPoint);

    return edge ? edge.distance(new math.Vector3(worldPoint.x, worldPoint.y, worldPoint.z)) : 0;
  }

  /** Convert a mouse displacement to world units along a projected unit axis. */
  getLineTranslation (start: Point2, end: Point2, worldPoint: Point3, axis: Point3): number {
    const camera = this.composition?.camera;

    if (!camera) { return 0; }
    const forward = camera.getInverseViewMatrix().transformNormal(new math.Vector3(0, 0, -1));
    const sign = forward.dot(new math.Vector3(axis.x, axis.y, axis.z)) < 0 ? -1 : 1;
    const from = this.project(worldPoint);
    const to = this.project({ x: worldPoint.x + axis.x * sign, y: worldPoint.y + axis.y * sign, z: worldPoint.z + axis.z * sign });

    if (!from || !to) { return 0; }
    const direction = to.subtract(from);

    return direction.lengthSquared() > 1e-8
      ? ((end.x - start.x) * direction.x + (end.y - start.y) * direction.y) / direction.lengthSquared() * sign : 0;
  }

  override on<E extends keyof Editor3DEvents> (name: E, listener: EventEmitterListener<Editor3DEvents[E]>): () => void {
    if (isInteractionEvent(name)) { return this.gizmoEvents.on<E>(name, listener); }
    super.on(name, listener as never);

    return () => this.off(name, listener);
  }

  override off<E extends keyof Editor3DEvents> (name: E, listener: EventEmitterListener<Editor3DEvents[E]>): void {
    if (isInteractionEvent(name)) { this.gizmoEvents.off<E>(name, listener); } else { super.off(name, listener as never); }
  }

  get tool (): ViewportTool { return this.activeGizmo === this.transformGizmo ? this.transformGizmo.mode : 'camera'; }
  get space (): TransformSpace { return this.transformGizmo.space; }
  get pivotType (): PivotType { return this.transformGizmo.pivotType; }

  setPivotType (pivot: PivotType): void {
    if (pivot === this.pivotType) { return; }
    this.cancel('pivot-change');
    this.transformGizmo.pivotType = pivot;
    this.updateGizmos();
    this.emit('toolchange', this.tool, this.space);
  }

  setTool (tool: ViewportTool, space: TransformSpace = this.space): void {
    if (tool === this.tool && space === this.space) { return; }
    this.cancel('tool-change');
    this.activeGizmo = tool === 'camera' ? undefined : this.transformGizmo;
    if (tool !== 'camera') { this.transformGizmo.setMode(tool); }
    this.transformGizmo.setSpace(space);
    this.updateGizmos();
    this.emit('toolchange', tool, space);
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.isAccepted() || this.capture) { return; }
    if (this.tryCapture(this.directionGizmo, event)) { return; }
    if (this.tryCapture(this.viewportCamera, event)) { return; }
    this.viewportCamera.stopNavigation();
    if (this.activeGizmo?.visible && this.tryCapture(this.activeGizmo, event)) { return; }
    this.tryCapture(this.boxSelection, event);
  }

  private tryCapture (handler: PointerCapture['handler'], event: InputEventMouseButton): boolean {
    const capture = { handler, button: event.buttonIndex, start: event.position.clone(), dragging: false };

    this.capture = capture;
    handler.onMouseDown(event);
    // An event listener may close this viewport while processing the press.
    if (this.capture !== capture || event.isAccepted()) { return true; }
    this.capture = undefined;

    return false;
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    const capture = this.capture;

    if (event.isAccepted()) { return; }
    if (!capture) {
      this.transformGizmo.hover(event.position);
      this.directionGizmo.hover(event.position);

      return;
    }
    if (capture.handler === this.boxSelection && !capture.dragging && capture.start.distance(event.position) < 5) { return; }
    capture.dragging = true;
    capture.handler.onMouseDrag?.(event);
  }

  override onMouseUp (event: InputEventMouseButton): void {
    const capture = this.capture;

    if (!capture || event.buttonIndex !== capture.button) { return; }
    this.capture = undefined;
    capture.handler.onMouseUp?.(event);
  }

  override onMouseWheel (event: InputEventMouseButton): void {
    if (!event.isAccepted() && (!this.capture || this.capture.handler === this.viewportCamera)) {
      this.viewportCamera.onMouseWheel(event);
    }
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.isAccepted()) { return; }
    if (event.keycode.toLowerCase() === 'escape') {
      this.cancel('escape');
      event.accept();

      return;
    }
    const handler = this.capture?.handler ?? this.viewportCamera;

    handler.onKeyDown?.(event);
    if (!event.isAccepted()) { this.handleShortcut(event); }
    if (!event.isAccepted()) { this.gizmoEvents.emit('keyDown', event); }
  }

  private handleShortcut (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (key === 'f') {
      this.viewportCamera.focusSelection();
      event.accept();
    } else if (key === '1' || key === '3' || key === '7') {
      this.viewportCamera.orientToAxis(key === '1' ? 2 : key === '3' ? 0 : 1, event.ctrlPressed ? -1 : 1);
      event.accept();
    } else if (!event.ctrlPressed && !event.metaPressed) {
      if (key === 'q') {
        this.setTool('camera');
      } else if (key === 'w' || key === 'e' || key === 'r') {
        this.setTool(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale');
      } else if (key === 'x') {
        this.setTool(this.transformGizmo.mode, this.space === 'world' ? 'local' : 'world');
      } else if (key === 'z') {
        this.setPivotType(this.pivotType === 'selection-center' ? 'object-center' : 'selection-center');
      } else {
        return;
      }
      event.accept();
    }
  }

  override onKeyUp (event: InputEventKey): void {
    if (!event.isAccepted()) { this.viewportCamera.onKeyUp(event); }
  }

  override update (deltaTime: number): void {
    this.gizmos.forEach(gizmo => gizmo.update(deltaTime));
    this.directionGizmo.updateDrawing();
    super.update(deltaTime);
  }

  override draw (): void {
    const rect = this.boxSelection.marqueeRect;

    if (!rect) { return; }
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;

    this.fillRect(rect.left, rect.top, width, height, marqueeFill);
    this.drawRect(rect.left, rect.top, width, height, marqueeOutline, 1);
  }

  /** Roll back the current preview before changing tool, document or viewport. */
  cancel (reason: string): void {
    this.capture = undefined;
    this.viewportCamera.cancel();
    this.gizmos.forEach(gizmo => gizmo.cancel(reason));
    this.boxSelection.cancel();
    this.transformGizmo.hover();
    this.directionGizmo.hover();
  }

  override onMouseLeave (): void {
    this.transformGizmo.hover();
    this.directionGizmo.hover();
  }

  override onLostFocus (): void { this.cancel('focus-lost'); }
  override onDestroy (): void {
    this.offCameraUpdate?.();
    this.offSelectionChange();
    this.cancel('viewport-exit');
    this.viewportCamera.restoreSceneCamera();
    this.gizmoRenderer?.dispose();
    this.activeGizmo = undefined;
    for (const gizmo of this.gizmos.slice()) { gizmo.dispose(); }
    this.gizmos.length = 0;
  }
}
