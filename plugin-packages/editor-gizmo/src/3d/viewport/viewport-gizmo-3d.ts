import { MouseButton, Transform, math, type Camera, type Composition, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey } from '@galacean/effects';
import type { Point2, Point3 } from '../../math/types';
import { add3, sub3, mul3, dot3, cross3, length3, unit3 } from '../../math/vector3';
import { orbitEditorCamera, dollyEditorCamera, lookEditorCamera, flyEditorCamera, type CameraEditData } from './camera-navigation';
import { Gizmo3D, type Viewport3DCameraEvent } from './gizmo-3d';
import { getItemWorldBoundsCorners } from './item-bounds';

const vector = (point: Point3) => new math.Vector3(point.x, point.y, point.z);

function cameraTransform (camera: Camera): Transform {
  return (camera as Camera & { readonly transform: Transform }).transform;
}

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
  // An identity parent keeps the editor pose in world space and makes a scene camera's
  // parent assignment, including null, detectable even when its local pose is unchanged.
  private readonly viewTransform = new Transform({}, new Transform());
  private editedScene?: { composition: Composition, transform: Transform, fov: number, disconnect: () => void };
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
    if (composition.id === this.sceneId && this.pose) { return this.pose; }
    const camera = composition.camera;
    const transform = cameraTransform(camera);
    const world = new math.Matrix4().compose(camera.position, camera.getQuat(), math.Vector3.ONE);

    if (transform.parentTransform) { world.premultiply(transform.parentTransform.getWorldMatrix()); }
    const position = world.getTranslation(new math.Vector3());
    const forward = world.transformNormal(new math.Vector3(0, 0, -1));
    const up = world.transformNormal(new math.Vector3(0, 1, 0));

    return { position, target: add3(position, mul3(forward, length3(position) || 1)), up, fov: camera.fov };
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
    this.owner.updateGizmos();
  }

  applyToComposition (): void {
    const composition = this.owner.composition;
    const pose = this.state;

    if (!this.owner.enabled || !composition || !pose) { return; }
    const camera = composition.camera;

    if (this.editedScene?.composition !== composition) {
      this.restoreSceneCamera();
      const source = cameraTransform(camera);
      const transform = new Transform({ position: source.position, quat: source.quat }, source.parentTransform ?? undefined);

      transform.rotation.copyFrom(source.rotation);
      this.editedScene = {
        composition, transform, fov: camera.fov,
        disconnect: composition.engine.on('update', this.afterSceneUpdate),
      };
    }
    const eye = vector(pose.position);
    const orientation = new math.Quaternion().setFromRotationMatrix(new math.Matrix4().lookAt(eye, vector(pose.target), vector(pose.up)));

    this.viewTransform.setTransform({ position: eye, quat: orientation });
    camera.setTransform(this.viewTransform);
    camera.fov = pose.fov;
    this.sceneId = composition.id;
    this.pose = pose;
  }

  private readonly afterSceneUpdate = (): void => {
    const scene = this.editedScene;

    if (!scene || !this.pose || scene.composition !== this.owner.composition) { return; }
    const camera = scene.composition.camera;
    const source = cameraTransform(camera);
    const rebound = source.parentTransform !== this.viewTransform.parentTransform;
    const position = rebound || !source.position.equals(this.viewTransform.position) ? source.position : undefined;
    const quat = rebound || 1 - Math.abs(source.quat.dot(this.viewTransform.quat)) > 1e-12 ? source.quat : undefined;
    const fovChanged = rebound || camera.fov !== this.pose.fov;

    if (!position && !quat && !fovChanged) { return; }
    if (rebound) { scene.transform.parentTransform = source.parentTransform; }
    scene.transform.setTransform({ position, quat });
    if (quat) { scene.transform.rotation.copyFrom(source.rotation); }
    if (fovChanged) { scene.fov = camera.fov; }
    camera.setTransform(this.viewTransform);
    camera.fov = this.pose.fov;
  };

  /** Return rendering and picking to the camera animated by the scene. */
  restoreSceneCamera (): void {
    const scene = this.editedScene;

    if (!scene) { return; }
    scene.disconnect();
    const camera = scene.composition.camera;

    camera.setTransform(scene.transform);
    camera.rotation = scene.transform.rotation;
    camera.setQuat(scene.transform.quat);
    camera.fov = scene.fov;
    scene.transform.parentTransform = null;
    this.editedScene = undefined;
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
    const composition = this.owner.composition;

    if (this.editedScene && this.editedScene.composition !== composition) { this.restoreSceneCamera(); }
    if (composition && composition.id !== this.sceneId) { this.applyToComposition(); }
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
      const size = this.owner.viewportSize;
      const { camera, editorTransform } = this.navigation.composition;
      const projection = camera.getProjectionMatrix().elements;
      const depth = length3(sub3(before.position, before.target));
      const width = size.x * editorTransform.x * projection[0];
      const height = size.y * editorTransform.y * projection[5];

      if (!width || !height) { return; }
      const delta = add3(mul3(right, -2 * dx * depth / width), mul3(up, 2 * dy * depth / height));

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
    const composition = this.owner.composition;

    if (!composition || !selected.length || size.x <= 0 || size.y <= 0) { return; }
    if (this.navigation) { this.finish(false); }
    const camera = this.state;

    if (!camera) { return; }
    const points = getItemWorldBoundsCorners(selected);
    const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };

    for (const p of points) {
      min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
    }
    const center = mul3(add3(min, max), 0.5);
    const radius = points.reduce((r, p) => Math.max(r, length3(sub3(p, center))), 0.01);
    const projection = composition.camera.getProjectionMatrix().elements;
    const { x, y, z, w } = composition.editorTransform;
    const tanHalfX = (1 - Math.abs(z - x * projection[8])) / Math.abs(x * projection[0]);
    const tanHalfY = (1 - Math.abs(w - y * projection[9])) / Math.abs(y * projection[5]);
    const halfFov = Math.atan(Math.min(tanHalfX, tanHalfY));
    const direction = unit3(sub3(camera.position, camera.target));

    if (!(halfFov > 0)) { return; }
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
