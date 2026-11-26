import { EventEmitter, math, type Composition, type EventEmitterListener, type InputEventKey, type InputEventMouseButton, type InputEventMouseMotion, type MouseButton, type VFXItem } from '@galacean/effects';
import { Control, FocusMode, MouseFilter, type ControlEvent } from '@galacean/effects-plugin-gui';
import type { Selection } from '../2d/selection/selection';
import type { Editor } from '../editor';
import type { Point2, Point3, Ray3 } from '../math/types';
import type { GizmoComponent } from './gizmo-component';
import type { Gizmo3D, Gizmo3DEvents, Viewport3DSpace, Viewport3DTool } from './viewport/gizmo-3d';
import { GizmoLayer3D } from './viewport/gizmo-layer-3d';
import { SelectionGizmo3D } from './viewport/selection-gizmo-3d';
import { TransformGizmo3D } from './viewport/transform-gizmo-3d';
import { ViewportGizmo3D } from './viewport/viewport-gizmo-3d';
import { ViewportGizmoPicker } from './viewport/viewport-gizmo-picker';

const marqueeFill = math.Color.fromHexString('#79adff26');
const marqueeOutline = math.Color.fromHexString('#79adffff');

type Editor3DEvents = ControlEvent & Gizmo3DEvents;

function isGizmoEvent (name: keyof Editor3DEvents): name is keyof Gizmo3DEvents {
  return name === 'actionstart' || name === 'actionupdate' || name === 'actioncommit' || name === 'camerachange'
    || name === 'toolchange' || name === 'keyDown';
}

interface PointerCapture3D {
  gizmo: Gizmo3D,
  button: MouseButton,
  start: math.Vector2,
  dragging: boolean,
}

/** A full-rect GUI control with its own spatial tools, input capture and drawing lifecycle. */
export class Editor3D extends Control {
  readonly picker: ViewportGizmoPicker;
  readonly transform: TransformGizmo3D;
  readonly camera: ViewportGizmo3D;
  readonly selectionGizmo: SelectionGizmo3D;
  private gizmoLayer?: GizmoLayer3D;
  private readonly offSelectionChange: () => void;
  private offCameraUpdate?: () => void;
  private cameraOnly = false;
  private capture?: PointerCapture3D;
  private readonly gizmoEvents = new EventEmitter<Editor3DEvents>();
  readonly emit: EventEmitter<Gizmo3DEvents>['emit'] = this.gizmoEvents.emit;

  constructor (private readonly editor: Editor) {
    super(editor.engine);
    this.setAnchorsAndOffsetsPreset('fullRect');
    this.mouseFilter = MouseFilter.Stop;
    this.mouseForcePassScrollEvents = false;
    this.focusMode = FocusMode.Click;
    this.picker = new ViewportGizmoPicker(this);
    this.camera = new ViewportGizmo3D(this);
    this.transform = new TransformGizmo3D(this);
    this.selectionGizmo = new SelectionGizmo3D(this);
    this.offSelectionChange = editor.selection.on('selectionchange', () => {
      if (this.enabled) {
        this.cancel('selection');
        this.updateGizmos();
      }
    });
  }

  get selection (): Selection { return this.editor.selection; }

  /** @internal Root of the handles owned by this viewport. */
  get gizmoRoot (): VFXItem | undefined { return this.gizmoLayer?.root; }

  /** @internal Helpers created for the composition currently being edited. */
  get gizmoComponents (): readonly GizmoComponent[] {
    const composition = this.composition;

    return composition && this.gizmoLayer?.root.composition === composition ? this.gizmoLayer.components : [];
  }

  /** @internal Activate viewport input or roll back the current interaction. */
  setActive (active: boolean): void {
    if (!active) {
      this.offCameraUpdate?.();
      this.offCameraUpdate = undefined;
      this.cancel('mode-change');
      this.camera.restoreSceneCamera();
    }
    this.enabled = active;
    this.gizmoLayer?.setActive(active);
    if (active) {
      // Camera navigation must finish before scene components collect their render data.
      this.offCameraUpdate ??= this.engine.on('update', deltaTime => this.camera.onUpdate(deltaTime));
      this.camera.applyToComposition();
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
    if (!this.enabled) { return; }
    const composition = this.composition;

    if (this.gizmoLayer?.root.composition !== composition) {
      this.gizmoLayer?.root.dispose();
      this.gizmoLayer = composition ? new GizmoLayer3D(composition) : undefined;
    }
    this.gizmoLayer?.update(this);
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

  override on<E extends keyof Editor3DEvents> (name: E, listener: EventEmitterListener<Editor3DEvents[E]>): () => void {
    if (isGizmoEvent(name)) { return this.gizmoEvents.on<E>(name, listener); }
    super.on(name, listener as never);

    return () => this.off(name, listener);
  }

  override off<E extends keyof Editor3DEvents> (name: E, listener: EventEmitterListener<Editor3DEvents[E]>): void {
    if (isGizmoEvent(name)) { this.gizmoEvents.off<E>(name, listener); } else { super.off(name, listener as never); }
  }

  get tool (): Viewport3DTool { return this.cameraOnly ? 'camera' : this.transform.operation; }
  get space (): Viewport3DSpace { return this.transform.space; }

  setTool (tool: Viewport3DTool, space: Viewport3DSpace = this.space): void {
    if (tool === this.tool && space === this.space) { return; }
    this.cancel('tool-change');
    this.cameraOnly = tool === 'camera';
    if (tool !== 'camera') { this.transform.setOperation(tool); }
    this.transform.setSpace(space);
    this.updateGizmos();
    this.emit('toolchange', tool, space);
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.isAccepted() || this.capture) { return; }
    if (this.tryCapture(this.camera, event)) { return; }
    this.camera.stopNavigation();
    if (!this.cameraOnly && this.tryCapture(this.transform, event)) { return; }
    this.tryCapture(this.selectionGizmo, event);
  }

  private tryCapture (gizmo: Gizmo3D, event: InputEventMouseButton): boolean {
    const capture = { gizmo, button: event.buttonIndex, start: event.position.clone(), dragging: false };

    this.capture = capture;
    gizmo.onMouseDown(event);
    // An event listener may close this viewport while processing the press.
    if (this.capture !== capture || event.isAccepted()) { return true; }
    this.capture = undefined;

    return false;
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    const capture = this.capture;

    if (!capture || event.isAccepted()) { return; }
    if (capture.gizmo === this.selectionGizmo && !capture.dragging && capture.start.distance(event.position) < 5) { return; }
    capture.dragging = true;
    capture.gizmo.onMouseDrag(event);
  }

  override onMouseUp (event: InputEventMouseButton): void {
    const capture = this.capture;

    if (!capture || event.buttonIndex !== capture.button) { return; }
    this.capture = undefined;
    capture.gizmo.onMouseUp(event);
  }

  override onMouseWheel (event: InputEventMouseButton): void {
    if (!event.isAccepted() && (!this.capture || this.capture.gizmo === this.camera)) {
      this.camera.onMouseWheel(event);
    }
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.isAccepted()) { return; }
    if (event.keycode.toLowerCase() === 'escape') {
      this.cancel('escape');
      event.accept();

      return;
    }
    if (this.capture) {
      this.capture.gizmo.onKeyDown(event);
    } else {
      this.camera.onKeyDown(event);
      if (!event.isAccepted() && !this.cameraOnly) { this.transform.onKeyDown(event); }
    }
    if (!event.isAccepted()) { this.gizmoEvents.emit('keyDown', event); }
  }

  override onKeyUp (event: InputEventKey): void {
    if (!event.isAccepted()) { this.camera.onKeyUp(event); }
  }

  override update (deltaTime: number): void {
    this.transform.onUpdate();
    this.updateGizmos();
    super.update(deltaTime);
  }

  override draw (): void {
    const rect = this.selectionGizmo.marqueeRect;

    if (!rect) { return; }
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;

    this.fillRect(rect.left, rect.top, width, height, marqueeFill);
    this.drawRect(rect.left, rect.top, width, height, marqueeOutline, 1);
  }

  /** Roll back the current preview before changing tool, document or viewport. */
  cancel (reason: string): void {
    this.capture = undefined;
    this.camera.cancel();
    this.transform.cancel(reason);
    this.selectionGizmo.cancel();
  }

  override onLostFocus (): void { this.cancel('focus-lost'); }
  override onDestroy (): void {
    this.offCameraUpdate?.();
    this.offSelectionChange();
    this.cancel('viewport-exit');
    this.camera.restoreSceneCamera();
    this.gizmoLayer?.root.dispose();
    this.gizmoLayer = undefined;
  }
}
