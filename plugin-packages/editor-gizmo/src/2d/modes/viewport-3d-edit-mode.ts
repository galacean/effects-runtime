import { MouseButton, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { createSelectionInteractionGizmo } from '../selection/create-selection-interaction-gizmo';
import { Vector2 } from '../math';
import { toColor } from '../drawing';
import type { EditMode } from './edit-mode';
import type { SpatialEditHost, CameraEditData, Point3 } from './spatial-edit-host';
import { orbitEditorCamera, dollyEditorCamera, lookEditorCamera, flyEditorCamera, clipEditorSegment } from './camera-math';
import { SpatialEditSession } from './spatial-edit-session';
import { add3, sub3, mul3, dot3, cross3, length3, unit3 } from './spatial-math';

function lerpPoint (a: Point3, b: Point3, t: number): Point3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function slerpDirection (from: Point3, to: Point3, t: number): Point3 {
  const a = unit3(from), b = unit3(to), dot = Math.max(-1, Math.min(1, dot3(a, b)));

  if (dot > 0.9995) { return unit3(lerpPoint(a, b, t)); }
  if (dot < -0.9995) {
    const basis = Math.abs(a.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const orthogonal = unit3(cross3(a, basis));

    return unit3(add3(mul3(a, Math.cos(Math.PI * t)), mul3(orthogonal, Math.sin(Math.PI * t))));
  }
  const angle = Math.acos(dot), sine = Math.sin(angle);

  return unit3(add3(mul3(a, Math.sin((1 - t) * angle) / sine), mul3(b, Math.sin(t * angle) / sine)));
}

function interpolateCamera (from: CameraEditData, to: CameraEditData, t: number): CameraEditData {
  const target = lerpPoint(from.target, to.target, t);
  const direction = slerpDirection(sub3(from.position, from.target), sub3(to.position, to.target), t);
  const distance = length3(sub3(from.position, from.target)) + (length3(sub3(to.position, to.target)) - length3(sub3(from.position, from.target))) * t;
  const up = lerpPoint(from.up, to.up, t);

  return { ...to, position: add3(target, mul3(direction, distance)), target, up: length3(up) > 1e-6 ? unit3(up) : to.up };
}

/** Orbit/pan/dolly, selected-item focus and clickable six-axis view helper. */
export class Viewport3DGizmo extends Gizmo {
  readonly type = 'viewport-3d';
  private session?: SpatialEditSession<'viewport-3d'>;
  private alignment?: { session: SpatialEditSession<'viewport-3d'>, from: CameraEditData, to: CameraEditData, elapsed: number };
  private start?: Vector2;
  private action?: 'orbit' | 'pan' | 'look';
  private flyKeys = new Set<string>();
  private flyTime = 0;
  private flySpeed = 1;
  constructor (owner: GizmoOwner, private readonly host: SpatialEditHost) { super(owner); }
  override onUpdate (): void {
    if (this.session && !this.session.valid()) { this.cancel('context'); }
    const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - this.flyTime) / 1000));

    this.flyTime = now;
    if (this.alignment) {
      const alignment = this.alignment;

      alignment.elapsed += dt;
      const progress = Math.min(1, alignment.elapsed / 0.24);
      const eased = progress * progress * (3 - 2 * progress);

      if (!alignment.session.update(interpolateCamera(alignment.from, alignment.to, eased))) {
        this.alignment = undefined;
      } else if (progress >= 1) {
        alignment.session.commit();
        this.alignment = undefined;
      }
    }
    if (this.session && this.action === 'look' && this.flyKeys.size) {
      const down = (key: string) => this.flyKeys.has(key) ? 1 : 0;
      const camera = this.session.after, distance = Math.max(0.1, length3(sub3(camera.position, camera.target))) * dt * this.flySpeed;

      this.session.update(flyEditorCamera(camera, down('d') - down('a'), down('e') - down('q'), down('w') - down('s'), distance));
    }
  }
  cancel (reason: string): void {
    this.alignment?.session.cancel(reason); this.alignment = undefined;
    this.session?.cancel(reason); this.session = undefined; this.start = undefined; this.action = undefined; this.flyKeys.clear(); this.flySpeed = 1;
  }
  override dispose (): void { this.cancel('dispose'); }
  override onMouseDown (event: InputEventMouseButton): void {
    const target = this.host.read('viewport-3d');

    if (!target || !this.host.canEdit('viewport-3d', target.id)) { return; }
    if (event.buttonIndex === MouseButton.Left) {
      const native = this.host.nativeGizmoHit?.(event.position, 'view-helper');
      const nativeHit = native && this.nativeAxis(native.key);
      const hit = nativeHit ?? (this.host.nativeGizmoVisible?.('view-helper') ? undefined : this.helperPoints(target.data).filter(value => value.position.distance(event.position) < 10).sort((a, b) => b.depth - a.depth)[0]);

      if (hit) {
        this.align(hit.axis, hit.sign); event.accept();

        return;
      }
    }
    const pan = event.buttonIndex === MouseButton.Middle || (event.buttonIndex === MouseButton.Right && event.shiftPressed);
    const orbit = event.buttonIndex === MouseButton.Right || (event.buttonIndex === MouseButton.Left && event.altPressed);

    if (!pan && !orbit) { return; }
    this.cancel('restart'); this.session = new SpatialEditSession('viewport-3d', target, this.host); this.start = event.position.clone(); this.action = pan ? 'pan' : event.buttonIndex === MouseButton.Right && !event.altPressed && !event.metaPressed ? 'look' : 'orbit'; this.flyTime = performance.now(); event.accept();
  }
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.session || !this.start) { return; }
    const before = this.action === 'look' ? this.session.after : this.session.before, dx = event.position.x - this.start.x, dy = event.position.y - this.start.y;

    if (this.action === 'look') { this.session.update(lookEditorCamera(before, dx, dy)); this.start = event.position.clone(); } else if (this.action === 'orbit') { this.session.update(orbitEditorCamera(before, dx, dy)); } else {
      const forward = unit3(sub3(before.target, before.position)), right = unit3(cross3(forward, before.up)), up = unit3(cross3(right, forward));
      const scale = 2 * length3(sub3(before.position, before.target)) * Math.tan(before.fov * Math.PI / 360) / Math.max(this.host.viewportSize().y, 1);
      const delta = add3(mul3(right, -dx * scale), mul3(up, dy * scale));

      this.session.update({ ...before, position: add3(before.position, delta), target: add3(before.target, delta) });
    }
    event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.session) { return; } const session = this.session;

    this.session = undefined;
    if (event.isCanceled()) { session.cancel('pointer'); } else { session.commit(); } this.cancel('finished'); event.accept();
  }
  onMouseWheel (event: InputEventMouseButton): void {
    const target = this.host.read('viewport-3d');

    if (!target) { return; }
    if (event.buttonIndex !== MouseButton.WheelUp && event.buttonIndex !== MouseButton.WheelDown) { return; }
    const direction = event.buttonIndex === MouseButton.WheelUp ? -1 : 1;

    if (this.session) {
      if (this.action === 'look') { this.flySpeed = Math.max(0.1, Math.min(100, this.flySpeed * Math.exp(-direction * 0.2))); event.accept(); }

      return;
    }
    const session = new SpatialEditSession('viewport-3d', target, this.host);

    session.update(dollyEditorCamera(target.data, Math.exp(direction * Math.min(0.5, Math.abs(event.factor) * 0.12)))); session.commit(); event.accept();
  }
  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (this.action === 'look' && ['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
      this.flyKeys.add(key); event.accept();

      return;
    }
    if (key === 'escape') { this.cancel('escape'); event.accept(); } else if (key === 'f') { this.focus(); event.accept(); } else if (key === '1' || key === '3' || key === '7') { this.align(key === '1' ? 2 : key === '3' ? 0 : 1, event.ctrlPressed ? -1 : 1); event.accept(); }
  }
  override onKeyUp (event: InputEventKey): void {
    if (this.flyKeys.delete(event.keycode.toLowerCase())) { event.accept(); }
  }
  focus (): void {
    const target = this.host.read('viewport-3d'); const selected = this._owner.getSelection().getSelectedPlayerItems();

    if (!target || !selected.length) { return; }
    let points = this.host.focusBounds?.(selected.map(item => item.getInstanceId())) ?? [];

    if (!points.length) {
      points = selected.flatMap(item => [-0.5, 0.5].flatMap(x => [-0.5, 0.5].map(y =>
        this.host.localToWorld({ x: item.transform.size.x * x, y: item.transform.size.y * y, z: 0 }, item.getInstanceId()))));
    }
    const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };

    for (const p of points) {
      min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
    }
    const center = mul3(add3(min, max), 0.5);
    const radius = Math.max(0.01, ...points.map(p => length3(sub3(p, center))));
    const size = this.host.viewportSize(), vertical = target.data.fov * Math.PI / 360;
    const halfFov = Math.min(vertical, Math.atan(Math.tan(vertical) * size.x / Math.max(size.y, 1)));
    const direction = unit3(sub3(target.data.position, target.data.target));
    const session = new SpatialEditSession('viewport-3d', target, this.host);

    session.update({ ...target.data, target: center, position: add3(center, mul3(direction, radius / Math.sin(halfFov) * 1.3)) }); session.commit();
  }
  align (axis: number, sign: number): void {
    const target = this.host.read('viewport-3d');

    if (!target) { return; }
    const vector: Point3 = { x: axis === 0 ? sign : 0, y: axis === 1 ? sign : 0, z: axis === 2 ? sign : 0 };
    const distance = Math.max(0.1, length3(sub3(target.data.position, target.data.target)));

    this.cancel('align-restart');
    const session = new SpatialEditSession('viewport-3d', target, this.host);

    this.alignment = {
      session,
      from: target.data,
      to: { ...target.data, position: add3(target.data.target, mul3(vector, distance)), up: axis === 1 ? { x: 0, y: 0, z: -sign } : { x: 0, y: 1, z: 0 } },
      elapsed: 0,
    };
    this.flyTime = performance.now();
  }
  private helperPoints (camera: CameraEditData) {
    const forward = unit3(sub3(camera.target, camera.position)), right = unit3(cross3(forward, camera.up)), up = unit3(cross3(right, forward));
    const size = this.host.viewportSize(), center = new Vector2(size.x - 64, 96);
    const points: Array<{ axis: number, sign: number, depth: number, position: Vector2 }> = [];

    for (const axis of [0, 1, 2]) {
      for (const sign of [-1, 1]) {
        const direction = { x: axis === 0 ? sign : 0, y: axis === 1 ? sign : 0, z: axis === 2 ? sign : 0 };

        points.push({ axis, sign, depth: -dot3(direction, forward), position: new Vector2(center.x + dot3(direction, right) * 35, center.y - dot3(direction, up) * 35) });
      }
    }

    return points;
  }
  private nativeAxis (key: string): { axis: number, sign: number } | undefined {
    const match: Record<string, { axis: number, sign: number }> = {
      posX: { axis: 0, sign: 1 }, negX: { axis: 0, sign: -1 },
      posY: { axis: 1, sign: 1 }, negY: { axis: 1, sign: -1 },
      posZ: { axis: 2, sign: 1 }, negZ: { axis: 2, sign: -1 },
    };

    return match[key];
  }
  override draw (control: Control): void {
    if (this.host.nativeGizmoVisible?.('view-helper')) { return; }
    const target = this.host.read('viewport-3d');

    if (!target) { return; }
    const size = this.host.viewportSize(), center = new Vector2(size.x - 64, 96);
    const points = this.helperPoints(this.session?.after ?? target.data).sort((a, b) => a.depth - b.depth);

    control.fillCircle(center.x, center.y, 49, toColor(0x252832a6));
    for (const p of points) {
      const color = toColor(([0xe05252, 0x55bf69, 0x549cfa][p.axis] << 8) | (p.sign > 0 ? 0xff : 0x80));

      control.drawLine(center.x, center.y, p.position.x, p.position.y, color, 2);
      control.fillCircle(p.position.x, p.position.y, p.sign > 0 ? 7 : 5, color);
    }
  }
}

/** The grid is an overlay, with no selectable or serializable scene objects. */
export class FloorGridGizmo extends Gizmo {
  readonly type = 'floor-grid';
  constructor (owner: GizmoOwner, private readonly host: SpatialEditHost) { super(owner); }
  override draw (control: Control): void {
    if (this.host.nativeGizmoVisible?.('floor-grid')) { return; }
    const camera = this.host.read('viewport-3d')?.data;

    if (!camera) { return; }
    for (let i = -10; i <= 10; i++) {
      for (const points of [[{ x: i, y: 0, z: -10 }, { x: i, y: 0, z: 10 }], [{ x: -10, y: 0, z: i }, { x: 10, y: 0, z: i }]]) {
        const clipped = clipEditorSegment(camera, points[0], points[1]);

        if (!clipped) { continue; }
        const a = this.host.project(clipped[0]), b = this.host.project(clipped[1]);

        if (a && b) { control.drawLine(a.x, a.y, b.x, b.y, toColor(i ? 0x88888833 : 0xaaaaaa80), 1); }
      }
    }
  }
}
export class Viewport3DEditMode implements EditMode {
  readonly id = 'viewport-3d';
  private gizmo?: Viewport3DGizmo;
  constructor (private readonly owner: GizmoOwner, private readonly host: SpatialEditHost) {}
  canRemainActiveForTool (tool: GizmoTool): boolean { return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool; }
  createGizmos (): Gizmo[] {
    this.gizmo?.cancel('rebuild');
    this.gizmo = new Viewport3DGizmo(this.owner, this.host);

    return [this.gizmo, new FloorGridGizmo(this.owner, this.host), createSelectionInteractionGizmo(this.owner, { allowTransform: false })];
  }
  onEnter (): void { this.owner.getSelection().clearHover(); }
  onMouseWheel (event: InputEventMouseButton): void { this.gizmo?.onMouseWheel(event); }
  onExit (): void { this.gizmo?.cancel('mode-exit'); }
}
