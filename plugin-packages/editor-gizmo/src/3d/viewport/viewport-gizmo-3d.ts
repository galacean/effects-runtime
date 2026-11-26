import { MouseButton, math, type Composition, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey } from '@galacean/effects';
import { Gizmo3D, type Viewport3DCameraEvent } from './gizmo-3d';
import { orbitEditorCamera, dollyEditorCamera, lookEditorCamera, flyEditorCamera, type CameraEditData } from './camera-math';
import { add3, sub3, mul3, dot3, cross3, length3, unit3, getBoundsPoints, type Point2, type Point3 } from './gizmo-3d-math';

const vector = (point: Point3) => new math.Vector3(point.x, point.y, point.z);

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
export class ViewportGizmo3D extends Gizmo3D {
  readonly type = 'viewport-3d';
  private pose?: CameraEditData;
  private sceneId?: string;
  private navigation?: { initial: CameraEditData, current: CameraEditData, composition: Composition };
  private alignment?: { to: CameraEditData, elapsed: number };
  private start?: math.Vector2;
  private action?: 'orbit' | 'pan' | 'look';
  private flyKeys = new Set<string>();
  private flyTime = 0;
  private flySpeed = 1;
  get state (): CameraEditData | undefined {
    const composition = this.owner.composition;

    if (!composition) { return; }
    if (composition.id !== this.sceneId || !this.pose) {
      const { position, fov } = composition.camera;
      const rotation = composition.camera.getQuat();
      const forward = new math.Vector3(0, 0, -1).applyQuaternion(rotation);
      const up = new math.Vector3(0, 1, 0).applyQuaternion(rotation);

      this.sceneId = composition.id;
      this.pose = { position, target: add3(position, mul3(forward, length3(position) || 1)), up, fov };
    }

    return this.pose;
  }

  /** Set the orbit target and update the real viewport camera. */
  setState (camera: CameraEditData): void {
    this.cancel();
    this.setPose(camera);
  }

  private setPose (camera: CameraEditData): void {
    this.sceneId = this.owner.composition?.id;
    this.pose = camera;
    this.applyToComposition();
  }

  applyToComposition (): void {
    const composition = this.owner.composition;
    const pose = this.state;

    if (!composition || !pose) { return; }
    const eye = vector(pose.position);
    const orientation = new math.Quaternion().setFromRotationMatrix(new math.Matrix4().lookAt(eye, vector(pose.target), vector(pose.up)));

    composition.camera.position = eye;
    composition.camera.setQuat(orientation);
    composition.camera.fov = pose.fov;
  }

  private publish (camera: CameraEditData, phase: Viewport3DCameraEvent['phase']): void {
    if (phase !== 'start') { this.setPose(camera); }
    this.owner.emit('camerachange', { camera, phase });
  }

  private beginNavigation (): CameraEditData | undefined {
    this.cancel();
    const composition = this.owner.composition;
    const camera = this.state;

    if (!composition || !camera) { return; }
    const initial = { ...camera, position: { ...camera.position }, target: { ...camera.target }, up: { ...camera.up } };
    const navigation = { initial, current: initial, composition };

    this.navigation = navigation;
    this.flyTime = performance.now();
    this.publish(initial, 'start');

    return this.navigation === navigation ? initial : undefined;
  }

  private valid (): boolean {
    return !!this.navigation && this.navigation.composition === this.owner.composition;
  }

  private preview (camera: CameraEditData): void {
    if (!this.navigation || !this.valid()) {
      this.cancel();

      return;
    }
    this.navigation.current = camera;
    this.publish(camera, 'update');
  }

  private finish (canceled: boolean): void {
    const navigation = this.navigation;

    this.navigation = undefined;
    this.alignment = undefined;
    this.start = undefined;
    this.action = undefined;
    this.flyKeys.clear();
    this.flySpeed = 1;
    if (navigation && navigation.composition === this.owner.composition) {
      this.publish(canceled ? navigation.initial : navigation.current, canceled ? 'cancel' : 'commit');
    }
  }

  override onUpdate (): void {
    const navigation = this.navigation;

    if (!navigation) { return; }
    if (!this.valid()) {
      this.cancel();

      return;
    }
    const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - this.flyTime) / 1000));

    this.flyTime = now;
    if (this.alignment) {
      const alignment = this.alignment;

      alignment.elapsed += dt;
      const progress = Math.min(1, alignment.elapsed / 0.24);
      const eased = progress * progress * (3 - 2 * progress);

      this.preview(interpolateCamera(navigation.initial, alignment.to, eased));
      if (progress >= 1 && this.navigation === navigation) { this.finish(false); }
    }
    if (this.navigation && this.action === 'look' && this.flyKeys.size) {
      const down = (key: string) => this.flyKeys.has(key) ? 1 : 0;
      const camera = this.navigation.current, distance = Math.max(0.1, length3(sub3(camera.position, camera.target))) * dt * this.flySpeed;

      this.preview(flyEditorCamera(camera, down('d') - down('a'), down('e') - down('q'), down('w') - down('s'), distance));
    }
  }
  override cancel (): void {
    this.finish(true);
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (!this.owner.composition) { return; }
    if (event.buttonIndex === MouseButton.Left) {
      const hit = this.pickAxis(event.position);

      if (hit) {
        this.align(hit.axis, hit.sign); event.accept();

        return;
      }
    }
    const pan = event.buttonIndex === MouseButton.Middle || (event.buttonIndex === MouseButton.Right && event.shiftPressed);
    const orbit = event.buttonIndex === MouseButton.Right || (event.buttonIndex === MouseButton.Left && event.altPressed);

    if (!pan && !orbit) { return; }
    if (!this.beginNavigation()) { return; }
    this.start = event.position.clone();
    this.action = pan ? 'pan' : event.buttonIndex === MouseButton.Right && !event.altPressed && !event.metaPressed ? 'look' : 'orbit';
    event.accept();
  }
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.navigation || !this.start) { return; }
    const before = this.action === 'look' ? this.navigation.current : this.navigation.initial;
    const dx = event.position.x - this.start.x, dy = event.position.y - this.start.y;

    if (this.action === 'look') {
      this.start = event.position.clone();
      this.preview(lookEditorCamera(before, dx, dy));
    } else if (this.action === 'orbit') {
      this.preview(orbitEditorCamera(before, dx, dy));
    } else {
      const forward = unit3(sub3(before.target, before.position)), right = unit3(cross3(forward, before.up)), up = unit3(cross3(right, forward));
      const scale = 2 * length3(sub3(before.position, before.target)) * Math.tan(before.fov * Math.PI / 360) / Math.max(this.owner.viewportSize.y, 1);
      const delta = add3(mul3(right, -dx * scale), mul3(up, dy * scale));

      this.preview({ ...before, position: add3(before.position, delta), target: add3(before.target, delta) });
    }
    event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.navigation || this.alignment) { return; }
    this.finish(event.isCanceled() || !this.valid());
    event.accept();
  }
  onMouseWheel (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.WheelUp && event.buttonIndex !== MouseButton.WheelDown) { return; }
    const direction = event.buttonIndex === MouseButton.WheelUp ? -1 : 1;

    if (this.navigation && !this.alignment) {
      if (this.action === 'look') { this.flySpeed = Math.max(0.1, Math.min(100, this.flySpeed * Math.exp(-direction * 0.2))); event.accept(); }

      return;
    }
    if (this.alignment) { this.finish(false); }
    const camera = this.state;

    if (!camera) { return; }
    this.publish(dollyEditorCamera(camera, Math.exp(direction * Math.min(0.5, Math.abs(event.factor) * 0.12))), 'commit');
    event.accept();
  }
  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (this.action === 'look' && ['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
      this.flyKeys.add(key); event.accept();

      return;
    }
    if (key === 'escape') { this.cancel(); event.accept(); } else if (key === 'f') { this.focus(); event.accept(); } else if (key === '1' || key === '3' || key === '7') { this.align(key === '1' ? 2 : key === '3' ? 0 : 1, event.ctrlPressed ? -1 : 1); event.accept(); }
  }
  override onKeyUp (event: InputEventKey): void {
    if (this.flyKeys.delete(event.keycode.toLowerCase())) { event.accept(); }
  }
  focus (): void {
    const selected = this.owner.selectionGizmo.items;
    const size = this.owner.viewportSize;

    if (!selected.length || size.x <= 0 || size.y <= 0) { return; }
    if (this.navigation) { this.finish(false); }
    const camera = this.state;

    if (!camera) { return; }
    const points = getBoundsPoints(selected);
    const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };

    for (const p of points) {
      min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
    }
    const center = mul3(add3(min, max), 0.5);
    const radius = points.reduce((r, p) => Math.max(r, length3(sub3(p, center))), 0.01);
    const vertical = camera.fov * Math.PI / 360;
    const halfFov = Math.min(vertical, Math.atan(Math.tan(vertical) * size.x / size.y));
    const direction = unit3(sub3(camera.position, camera.target));

    this.publish({ ...camera, target: center, position: add3(center, mul3(direction, radius / Math.sin(halfFov) * 1.3)) }, 'commit');
  }
  align (axis: number, sign: number): void {
    const camera = this.beginNavigation();

    if (!camera) { return; }
    const vector: Point3 = { x: axis === 0 ? sign : 0, y: axis === 1 ? sign : 0, z: axis === 2 ? sign : 0 };
    const distance = Math.max(0.1, length3(sub3(camera.position, camera.target)));

    this.alignment = {
      to: { ...camera, position: add3(camera.target, mul3(vector, distance)), up: axis === 1 ? { x: 0, y: 0, z: -sign } : { x: 0, y: 1, z: 0 } },
      elapsed: 0,
    };
  }
  pickAxis (point: Point2): { axis: number, sign: number } | undefined {
    const hit = this.owner.picker.hit(point, 'view-helper');

    return hit && this.nativeAxis(hit.key);
  }
  private nativeAxis (key: string): { axis: number, sign: number } | undefined {
    const match: Record<string, { axis: number, sign: number }> = {
      posX: { axis: 0, sign: 1 }, negX: { axis: 0, sign: -1 },
      posY: { axis: 1, sign: 1 }, negY: { axis: 1, sign: -1 },
      posZ: { axis: 2, sign: 1 }, negZ: { axis: 2, sign: -1 },
    };

    return match[key];
  }
}
