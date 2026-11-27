import { MouseButton, Transform, math, type Camera, type Composition, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey } from '@galacean/effects';
import type { Editor3D } from '../../editor-3d';
import type { Point3 } from '../../../math/types';
import { add3, sub3, mul3, length3, unit3 } from '../../../math/vector3';
import { cameraOrientation, interpolateCamera, orbitEditorCamera, dollyEditorCamera, lookEditorCamera, flyEditorCamera } from './camera-operations';
import type { ViewportCameraState, ViewportCameraEvent } from './viewport-camera-types';
import { getItemWorldBoundsCorners } from '../item-bounds';

const vector = (point: Point3) => new math.Vector3(point.x, point.y, point.z);

function cameraTransform (camera: Camera): Transform {
  return (camera as Camera & { readonly transform: Transform }).transform;
}

/** Owns the viewport camera pose, navigation and temporary scene-camera binding. */
export class ViewportCamera {
  private pose?: ViewportCameraState;
  private sceneId?: string;
  // An identity parent keeps the editor pose in world space and makes a scene camera's
  // parent assignment, including null, detectable even when its local pose is unchanged.
  private readonly viewTransform = new Transform({}, new Transform());
  private editedScene?: { composition: Composition, transform: Transform, fov: number };
  private navigation?: {
    initial: ViewportCameraState,
    current: ViewportCameraState,
    composition: Composition,
    /** Completed edits retain their result while interpolation finishes. */
    committed?: boolean,
  };
  private alignment?: { to: ViewportCameraState, elapsed: number };
  private smoothing = false;
  private start?: math.Vector2;
  private action?: 'orbit' | 'pan' | 'look' | 'dolly';
  private zoomUsesY = true;
  private flyKeys = new Set<string>();
  private flyTime = 0;
  private flySpeed = 5;

  constructor (private readonly viewport: Editor3D) {}

  get isNavigating (): boolean { return !!this.navigation; }

  get state (): ViewportCameraState | undefined {
    const composition = this.viewport.composition;

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
  setState (camera: ViewportCameraState): void {
    this.cancel();
    this.setPose(camera);
  }

  private setPose (camera: ViewportCameraState): void {
    this.sceneId = this.viewport.composition?.id;
    this.pose = camera;
    this.applyToComposition();
    this.viewport.updateGizmos();
  }

  applyToComposition (): void {
    const composition = this.viewport.composition;
    const pose = this.state;

    if (!this.viewport.enabled || !composition || !pose) { return; }
    const camera = composition.camera;

    if (this.editedScene?.composition !== composition) {
      this.restoreSceneCamera();
      const source = cameraTransform(camera);
      const transform = new Transform({ position: source.position, quat: source.quat }, source.parentTransform ?? undefined);

      transform.rotation.copyFrom(source.rotation);
      this.editedScene = { composition, transform, fov: camera.fov };
    }
    this.viewTransform.setTransform({ position: vector(pose.position), quat: cameraOrientation(pose) });
    camera.setTransform(this.viewTransform);
    camera.fov = pose.fov;
    this.sceneId = composition.id;
    this.pose = pose;
  }

  private syncSceneCamera (): void {
    const scene = this.editedScene;

    if (!scene || !this.pose || scene.composition !== this.viewport.composition) { return; }
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
  }

  /** Return rendering and picking to the camera animated by the scene. */
  restoreSceneCamera (): void {
    const scene = this.editedScene;

    if (!scene) { return; }
    const camera = scene.composition.camera;

    camera.setTransform(scene.transform);
    camera.rotation = scene.transform.rotation;
    camera.setQuat(scene.transform.quat);
    camera.fov = scene.fov;
    scene.transform.parentTransform = null;
    this.editedScene = undefined;
  }

  private publish (camera: ViewportCameraState, phase: ViewportCameraEvent['phase']): void {
    if (phase !== 'start') { this.setPose(camera); }
    this.viewport.emit('camerachange', { camera, phase });
  }

  /** Stop interpolation at the displayed pose before another interaction takes over. */
  stopNavigation (): void {
    if (this.navigation) {
      this.navigation.current = this.state ?? this.navigation.current;
      this.finish(false);
    }
  }

  private beginNavigation (): ViewportCameraState | undefined {
    this.stopNavigation();
    const composition = this.viewport.composition;
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
    return !!this.navigation && this.navigation.composition === this.viewport.composition;
  }

  private preview (camera: ViewportCameraState, smooth = false): void {
    if (!this.navigation || !this.valid()) {
      this.cancel();

      return;
    }
    this.navigation.current = camera;
    this.smoothing = smooth;
    if (!smooth) { this.publish(camera, 'update'); }
  }

  private finish (canceled: boolean): void {
    const navigation = this.navigation;

    this.navigation = undefined;
    this.alignment = undefined;
    this.smoothing = false;
    this.start = undefined;
    this.action = undefined;
    this.flyKeys.clear();
    if (navigation && navigation.composition === this.viewport.composition) {
      this.publish(canceled ? navigation.initial : navigation.current, canceled ? 'cancel' : 'commit');
    }
  }

  update (deltaTime?: number): void {
    const composition = this.viewport.composition;

    if (this.editedScene && this.editedScene.composition !== composition) { this.restoreSceneCamera(); }
    if (composition && composition.id !== this.sceneId) { this.applyToComposition(); }
    this.syncSceneCamera();
    const navigation = this.navigation;

    if (!navigation) { return; }
    if (!this.valid()) {
      this.cancel();

      return;
    }
    const now = performance.now(), dt = Math.min(0.05, Math.max(0, (deltaTime ?? now - this.flyTime) / 1000));

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
      const camera = this.navigation.current, distance = dt * this.flySpeed * (this.flyKeys.has('shift') ? 5 : 1);

      this.preview(flyEditorCamera(camera, down('d') - down('a'), down('e') - down('q'), down('w') - down('s'), distance));
    }
    if (this.smoothing && dt > 0) {
      const target = navigation.current;
      const current = interpolateCamera(this.state!, target, Math.min(1, dt / 0.05));
      const tolerance = Math.max(1, length3(sub3(target.position, target.target))) * 1e-6;
      const settled = length3(sub3(current.position, target.position)) + length3(sub3(current.target, target.target)) < tolerance;

      this.publish(settled ? target : current, 'update');
      if (this.navigation !== navigation || navigation.current !== target || !this.smoothing) { return; }
      if (settled) { this.smoothing = false; }
      if (settled && !this.action) { this.finish(false); }
    }
  }
  cancel (): void {
    this.finish(!this.navigation?.committed);
  }
  onMouseDown (event: InputEventMouseButton): void {
    if (!this.viewport.composition) { return; }
    const actionKey = event.ctrlPressed || event.metaPressed;
    let action: typeof this.action;

    if (event.buttonIndex === MouseButton.Middle || event.buttonIndex === MouseButton.Left
      && (event.altPressed && actionKey || this.viewport.tool === 'camera' && !event.altPressed)) {
      action = 'pan';
    } else if (event.buttonIndex === MouseButton.Right && event.altPressed) {
      action = 'dolly';
    } else if (event.buttonIndex === MouseButton.Left && event.altPressed) {
      action = 'orbit';
    } else if (event.buttonIndex === MouseButton.Right && !actionKey) {
      action = 'look';
    }
    if (!action) { return; }
    if (!this.beginNavigation()) { return; }
    this.start = event.position.clone();
    this.action = action;
    if (event.shiftPressed) { this.flyKeys.add('shift'); }
    event.accept();
  }
  onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.navigation || !this.start) { return; }
    const before = this.navigation.current;
    const dx = event.position.x - this.start.x, dy = event.position.y - this.start.y;

    this.start.copyFrom(event.position);

    if (this.action === 'look') {
      this.preview(lookEditorCamera(before, dx, dy));
    } else if (this.action === 'orbit') {
      this.preview(orbitEditorCamera(before, dx, dy));
    } else if (this.action === 'dolly') {
      if (Math.abs(Math.abs(dx) - Math.abs(dy)) > Math.max(Math.abs(dx), Math.abs(dy)) * 0.1) {
        this.zoomUsesY = Math.abs(dy) > Math.abs(dx);
      }
      const delta = -Math.sign(this.zoomUsesY ? dy : dx) * Math.hypot(dx, dy);

      this.preview(dollyEditorCamera(before, Math.exp(delta * 0.003 * (event.shiftPressed ? 3 : 1))));
    } else {
      const from = this.viewport.unproject({ x: event.position.x - dx, y: event.position.y - dy }, before.target);
      const to = this.viewport.unproject(event.position, before.target);

      if (!from || !to) { return; }
      const delta = mul3(sub3(from, to), event.shiftPressed ? 4 : 1);

      this.preview({ ...before, position: add3(before.position, delta), target: add3(before.target, delta) });
    }
    event.accept();
  }
  onMouseUp (event: InputEventMouseButton): void {
    if (!this.navigation || this.alignment) { return; }
    if (!event.isCanceled() && this.valid() && this.smoothing) {
      this.navigation.committed = true;
      this.start = undefined;
      this.action = undefined;
    } else { this.finish(event.isCanceled() || !this.valid()); }
    event.accept();
  }
  onMouseWheel (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.WheelUp && event.buttonIndex !== MouseButton.WheelDown) { return; }
    const direction = event.buttonIndex === MouseButton.WheelUp ? -1 : 1;
    const factor = 1 + Math.abs(event.factor) * 0.08;

    if (this.navigation && !this.alignment) {
      if (this.action === 'look') {
        this.flySpeed = Math.max(0.01, Math.min(10000, this.flySpeed * (direction < 0 ? factor : 1 / factor)));
        event.accept();

        return;
      }
      if (this.action) { return; }
    }
    const camera = this.alignment || !this.navigation ? this.beginNavigation() : this.navigation.current;

    if (!camera) { return; }
    let next = dollyEditorCamera(camera, direction < 0 ? 1 / factor : factor);
    const mousePoint = event.altPressed && this.viewport.unproject(event.position, camera.target);

    if (mousePoint) {
      const ratio = length3(sub3(next.position, next.target)) / length3(sub3(camera.position, camera.target));
      const delta = mul3(sub3(mousePoint, camera.target), 1 - ratio);

      next = { ...next, position: add3(next.position, delta), target: add3(next.target, delta) };
    }
    this.preview(next);
    this.finish(false);
    event.accept();
  }
  onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (this.action === 'look' && ['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(key)) {
      this.flyKeys.add(key); event.accept();

      return;
    }
  }
  onKeyUp (event: InputEventKey): void {
    if (this.flyKeys.delete(event.keycode.toLowerCase())) { event.accept(); }
  }
  focusSelection (): void {
    const selected = this.viewport.transformGizmo.selectedParents;
    const size = this.viewport.viewportSize;
    const composition = this.viewport.composition;

    if (!composition || !selected.length || size.x <= 0 || size.y <= 0) { return; }
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

    if (!(halfFov > 0) || !this.beginNavigation()) { return; }
    this.preview({ ...camera, target: center, position: add3(center, mul3(direction, radius / Math.sin(halfFov) * 1.3)) }, true);
    this.navigation!.committed = true;
  }
  orientToAxis (axis: number, sign: number): void {
    const camera = this.beginNavigation();

    if (!camera) { return; }
    const vector: Point3 = { x: axis === 0 ? sign : 0, y: axis === 1 ? sign : 0, z: axis === 2 ? sign : 0 };
    const distance = Math.max(0.1, length3(sub3(camera.position, camera.target)));

    this.alignment = {
      to: { ...camera, position: add3(camera.target, mul3(vector, distance)), up: axis === 1 ? { x: 0, y: 0, z: -sign } : { x: 0, y: 1, z: 0 } },
      elapsed: 0,
    };
  }
}
