import { MouseButton, type InputEventKey, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../../gizmo';
import type { GizmoOwner } from '../../gizmo-owner';
import { shapeConfig } from '../../configs/builtin-configs';
import type { ShapeConfig } from '../../configs/types';
import { GestureCursorType } from '../../cursor';
import { Vector2 } from '../../math';
import { drawCorners, toColor } from '../../drawing';
import { nextGeometrySession, type GeometryGizmoHost, type ShapeDrawingActionEvent, type ShapeGeometry, type ShapePrimitive } from './geometry';
import { isDragThresholdReached } from '../../drag-threshold';

/** primitive drawing in the local plane supplied by the host. */
export class ShapeModelGizmo extends Gizmo {
  readonly type = 'shape-model';
  createType: ShapePrimitive = 'rect';
  private start?: Vector2;
  private current?: Vector2;
  private startView?: Vector2;
  private currentView?: Vector2;
  private shift = false;
  private centerOrigin = false;
  private creationStarted = false;
  private sessionId = 0;
  private context?: unknown;

  constructor (owner: GizmoOwner, private readonly host: GeometryGizmoHost) { super(owner); }

  /** 当前造型预览与新元素初始化配置。 */
  private get config (): Readonly<ShapeConfig> {
    return this._owner.getConfigManager().get(shapeConfig);
  }

  override onUpdate (): void { if (this.start && !this.valid()) { this.onCancel('context'); } }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Right) {
      this.cancel(true); event.accept();

      return;
    }
    if (event.buttonIndex !== MouseButton.Left || !this.host.canEdit()) { return; }
    const start = this.snapPoint(event.position);

    this.start = this.host.viewToLocal(start);
    if (!this.start) { return; }
    this.current = this.start.clone(); this.startView = event.position.clone(); this.currentView = event.position.clone();
    this.shift = event.shiftPressed; this.centerOrigin = event.altPressed;
    this.creationStarted = false;
    this.sessionId = nextGeometrySession(); this.context = this.host.contextKey?.();
    this._owner.setCursor({ type: GestureCursorType.BOX_SELECT, angle: 0 }); event.accept();
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this._owner.setCursor({ type: GestureCursorType.BOX_SELECT, angle: 0 });
    if (this.start && event.pressed) { this.update(event); }
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    this._owner.setCursor({ type: GestureCursorType.BOX_SELECT, angle: 0 });
    this.update(event);
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.start) { return; }
    event.accept();
    if (event.isCanceled() || !this.valid()) {
      this.onCancel('pointer');

      return;
    }
    this.current = this.host.viewToLocal(this.snapPoint(event.position)); this.currentView = event.position.clone(); this.shift = event.shiftPressed;
    this.centerOrigin = event.altPressed;
    if (!this.current) {
      this.onCancel('projection');

      return;
    }
    if (!this.creationStarted) {
      this.creationStarted = true;
      this.emit('start');
    }
    const action = this.action('commit');

    action.finish = true;
    this.dispose(); this._owner.emit('actioncommit', action);
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.keycode.toLowerCase() === 'escape') {
      this.cancel(true);
      event.accept();
    } else if (event.keycode.toLowerCase() === 'shift') {
      this.shift = true;
      event.accept();
    }
  }
  override onKeyUp (event: InputEventKey): void { this.shift = event.shiftPressed; }
  onCancel (_reason: string): void { this.cancel(false); }

  override draw (control: Control): void {
    if (!this.creationStarted || !this.start || !this.current) { return; }
    const geometry = this.geometry();
    const { width, height, center } = geometry;
    const corners = [
      new Vector2(center.x - width / 2, center.y - height / 2),
      new Vector2(center.x + width / 2, center.y - height / 2),
      new Vector2(center.x + width / 2, center.y + height / 2),
      new Vector2(center.x - width / 2, center.y + height / 2),
    ].map(point => this.host.localToView(point));

    const config = this.config;

    drawCorners(control, corners, toColor((config.previewColor & 0xffffff00) | Math.round(config.previewAlpha * 255)), config.previewLineWidth);
  }

  override dispose (): void {
    this.start = this.current = this.startView = this.currentView = undefined;
    this.shift = false;
    this.centerOrigin = false;
    this.creationStarted = false;
    this._owner.getSnapManager().reset();
    this.context = undefined;
    this.sessionId = 0;
  }

  private geometry (): ShapeGeometry {
    const center = this.start ?? new Vector2();
    const delta = (this.current ?? center).clone().subtract(center);
    const clicked = !this.startView || !this.currentView || this.startView.distance(this.currentView) < 2;
    const { defaultWidth, defaultHeight, minWidth, minHeight, minRadius } = this.config;
    const halfX = clicked ? defaultWidth / 2 : Math.max(Math.abs(delta.x), minWidth / 2);
    const halfY = clicked ? defaultHeight / 2 : Math.max(Math.abs(delta.y), minHeight / 2);
    const radius = clicked ? defaultWidth / 2 : Math.max(delta.length(), minRadius);
    const radial = this.createType === 'polygon' || this.createType === 'star';

    if (radial || clicked) {
      return {
        shapeType: this.createType, center: { x: center.x, y: center.y },
        width: 2 * (radial ? radius : this.shift ? Math.max(halfX, halfY) : halfX),
        height: 2 * (radial ? radius : this.shift ? Math.max(halfX, halfY) : halfY),
      };
    }

    const width = this.shift
      ? Math.max(Math.abs(delta.x), Math.abs(delta.y), minWidth, minHeight)
      : Math.max(Math.abs(delta.x), minWidth);
    const height = this.shift ? width : Math.max(Math.abs(delta.y), minHeight);
    const shapeCenter = this.centerOrigin
      ? center
      : { x: center.x + Math.sign(delta.x) * width / 2, y: center.y + Math.sign(delta.y) * height / 2 };

    return {
      shapeType: this.createType, center: shapeCenter, width: this.centerOrigin ? width * 2 : width,
      height: this.centerOrigin ? height * 2 : height,
    };
  }

  private valid (): boolean { return this.host.canEdit() && this.context === this.host.contextKey?.(); }

  private update (event: InputEventMouseMotion): void {
    if (!this.start || !this.startView) {
      return;
    }
    if (!this.valid()) {
      this.onCancel('context');

      return;
    }
    if (
      !this.creationStarted
      && !isDragThresholdReached(
        this.startView.x,
        this.startView.y,
        event.position.x,
        event.position.y,
      )
    ) {
      event.accept();

      return;
    }
    const current = this.host.viewToLocal(this.snapPoint(event.position));

    this.currentView = event.position.clone();
    this.shift = event.shiftPressed;
    this.centerOrigin = event.altPressed;
    if (!current) {
      this.onCancel('projection');

      return;
    }
    this.current = current;
    event.accept();
    const phase = this.creationStarted ? 'update' : 'start';

    this.creationStarted = true;
    this.emit(phase);
  }

  private snapPoint (point: Vector2): Vector2 {
    const snap = this._owner.getSnapManager();

    snap.clearSnappingVisualizations();
    if (!snap.enabled) { return point.clone(); }
    snap.preparePoint(new Vector2(), point, this.host.snapPoints?.() ?? []);

    return point.clone().subtract(new Vector2(snap.result.x ?? 0, snap.result.y ?? 0));
  }
  private action (phase: ShapeDrawingActionEvent['phase']): ShapeDrawingActionEvent {
    return { source: this, sessionId: this.sessionId, phase, create: { kind: 'shape', geometry: this.geometry() } };
  }
  private emit (phase: 'start' | 'update'): void { this._owner.emit(`action${phase}`, this.action(phase)); }
  private cancel (finish: boolean): void {
    if (!this.start) {
      return;
    }
    const action = this.action('cancel');

    action.canceled = true;
    action.finish = finish;
    this.dispose();
    this._owner.emit('actioncommit', action);
  }
}
