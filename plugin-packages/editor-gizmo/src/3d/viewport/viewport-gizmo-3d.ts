import { MouseButton, PluginSystem, Transform, glContext, math, type Camera, type Composition, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey, type Renderer } from '@galacean/effects';
import type { Point2, Point3 } from '../../math/types';
import { add3, sub3, mul3, cross3, length3, unit3 } from '../../math/vector3';
import { orbitEditorCamera, dollyEditorCamera, lookEditorCamera, flyEditorCamera, type CameraEditData } from './camera-navigation';
import { Gizmo3D, type Viewport3DCameraEvent } from './gizmo-3d';
import { getItemWorldBoundsCorners } from './item-bounds';
import { GizmoGeometry } from './gizmo-geometry';
import { GizmoSubType } from '../define';
import type { GizmoItemBoundingSphere } from '../gizmo-bounds';
import type { EditorGizmoPlugin } from '../gizmo-loader';
import { computeOrthographicOffCenter } from '../../math/projection';

const vector = (point: Point3) => new math.Vector3(point.x, point.y, point.z);

function cameraTransform (camera: Camera): Transform {
  return (camera as Camera & { readonly transform: Transform }).transform;
}

function lerpPoint (a: Point3, b: Point3, t: number): Point3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function cameraOrientation (camera: CameraEditData): math.Quaternion {
  return new math.Quaternion().setFromRotationMatrix(
    new math.Matrix4().lookAt(vector(camera.position), vector(camera.target), vector(camera.up)));
}

function interpolateCamera (from: CameraEditData, to: CameraEditData, t: number): CameraEditData {
  const target = lerpPoint(from.target, to.target, t);
  const orientation = cameraOrientation(from).slerp(cameraOrientation(to), t);
  const direction = new math.Vector3(0, 0, 1).applyQuaternion(orientation);
  const distance = length3(sub3(from.position, from.target)) + (length3(sub3(to.position, to.target)) - length3(sub3(from.position, from.target))) * t;
  const up = new math.Vector3(0, 1, 0).applyQuaternion(orientation);

  return { ...to, position: add3(target, mul3(direction, distance)), target, up };
}

/** Orbit/pan/dolly, selected-item focus and clickable six-axis view helper. */
export class ViewportGizmo3D extends Gizmo3D {
  readonly type = 'viewport-3d';
  private pose?: CameraEditData;
  private sceneId?: string;
  // An identity parent keeps the editor pose in world space and makes a scene camera's
  // parent assignment, including null, detectable even when its local pose is unchanged.
  private readonly viewTransform = new Transform({}, new Transform());
  private editedScene?: { composition: Composition, transform: Transform, fov: number };
  private navigation?: {
    initial: CameraEditData,
    current: CameraEditData,
    composition: Composition,
    /** Completed edits retain their result while interpolation finishes. */
    committed?: boolean,
  };
  private alignment?: { to: CameraEditData, elapsed: number };
  private smoothing = false;
  private start?: math.Vector2;
  private action?: 'orbit' | 'pan' | 'look';
  private flyKeys = new Set<string>();
  private flyTime = 0;
  private flySpeed = 5;
  private geometryScene?: Composition;
  geometry?: GizmoGeometry;

  updateGeometry (): void {
    const composition = this.owner.composition;

    if (this.geometryScene !== composition) {
      this.dispose();
      this.geometryScene = composition;
    }
    if (!composition) { return; }
    if (!this.geometry) {
      const plugin = PluginSystem.getPlugins()?.find(plugin => plugin.name === 'editor-gizmo') as EditorGizmoPlugin | undefined;

      if (!plugin) { return; }
      this.geometry = new GizmoGeometry(this.owner.engine, GizmoSubType.viewHelper,
        { size: { scale: 1 }, renderMode: glContext.TRIANGLES }, plugin.getIconTextures(composition));
    }
    const geometry = this.geometry;
    const camera = composition.camera;
    const orientation = camera.getInverseViewMatrix().getTransform().rotation.conjugate();
    const rotation = new math.Matrix4().compose(math.Vector3.ZERO, orientation, math.Vector3.ONE);
    const width = 2 * Math.tan(30 * Math.PI / 360) * 16;
    const height = width * composition.renderer.getHeight() / composition.renderer.getWidth();
    const model = new math.Matrix4().compose(new math.Vector3(width / 2 - 0.8, height / 2 - 0.8, 0), orientation, math.Vector3.ONE);

    geometry.projection = computeOrthographicOffCenter(-width / 2, width / 2, -height / 2, height / 2, -16, 16);
    geometry.updateMatrix(camera.getInverseViewMatrix().multiply(model));
    for (const { data, local } of geometry.parts) {
      if (!geometry.bounds.has(data.name)) { continue; }
      const position = rotation.projectPoint(local.position, new math.Vector3());
      const radius = (geometry.bounds.get(data.name) as GizmoItemBoundingSphere).radius;
      const distance = position.toVector2().length();
      const alpha = data.name.endsWith('Z') ? 1 : Math.max(0, Math.min(1, distance * 2 / radius - 1));

      data.material.setVector2('u_alpha', new math.Vector2(alpha, 0));
    }
  }

  override draw (renderer: Renderer): void {
    this.updateGeometry();
    this.geometry?.draw(renderer);
  }

  override dispose (): void {
    this.geometry?.dispose();
    this.geometry = undefined;
    this.geometryScene = undefined;
  }

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

  private publish (camera: CameraEditData, phase: Viewport3DCameraEvent['phase']): void {
    if (phase !== 'start') { this.setPose(camera); }
    this.owner.emit('camerachange', { camera, phase });
  }

  /** Stop interpolation at the displayed pose before another interaction takes over. */
  stopNavigation (): void {
    if (this.navigation) {
      this.navigation.current = this.state ?? this.navigation.current;
      this.finish(false);
    }
  }

  private beginNavigation (): CameraEditData | undefined {
    this.stopNavigation();
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

  private preview (camera: CameraEditData, smooth = false): void {
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
    if (navigation && navigation.composition === this.owner.composition) {
      this.publish(canceled ? navigation.initial : navigation.current, canceled ? 'cancel' : 'commit');
    }
  }

  override onUpdate (deltaTime?: number): void {
    const composition = this.owner.composition;

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
      const camera = this.navigation.current, distance = dt * this.flySpeed;

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
  override cancel (): void {
    this.finish(!this.navigation?.committed);
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
      const depth = length3(sub3(before.position, before.target));
      const delta = mul3(add3(mul3(right, -dx), mul3(up, dy)), depth / 600);

      this.preview({ ...before, position: add3(before.position, delta), target: add3(before.target, delta) }, true);
    }
    event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
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
    this.preview(dollyEditorCamera(camera, direction < 0 ? 1 / factor : factor), true);
    this.navigation!.committed = true;
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
