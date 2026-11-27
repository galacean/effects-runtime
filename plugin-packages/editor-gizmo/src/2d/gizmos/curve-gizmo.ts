import {
  getControlPoints,
  MouseButton,
  type spec,
  type VFXItem,
  type InputEventKey,
  type InputEventMouseButton,
  type InputEventMouseMotion,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import type { GizmoActionEvent, GizmoActionPhase } from '../gizmo-action';
import { GizmoType } from '../gizmo-type';
import type { Vector2 } from '../../math';
import { Matrix4, Vector3 } from '../../math';
import { toColor } from '../drawing';
import { curveConfig } from '../configs/builtin-configs';
import type { CurveConfig } from '../configs/types';
import { cloneConfigValue } from '../configs/config-definition';
import { localToView, viewToLocal } from './content-edit-utils';
import { GestureCursorType } from '../cursor';
import { findMotionPaths, setMotionPath, type MotionPathTarget } from './motion-path';

/** 运动路径编辑事件。 */
export interface CurveActionEvent extends GizmoActionEvent {
  source: CurveGizmo,
  editType: 'curve',
  itemId: string,
  /** 路径点在所属时间线中的关键帧时间，不改变播放头。 */
  keyframeTime: number,
}

type CurveHit = { target: MotionPathTarget, index: number, control: boolean };
type CurveSession = CurveHit & {
  original: spec.BezierCurvePathValue,
  plane: Matrix4, start: Vector2, view: Vector2,
};

/** 编辑位置路径的关键点和贝塞尔控制柄，其他动画通道保持原样。 */
export class CurveGizmo extends Gizmo {
  readonly type = GizmoType.CURVE;
  private hover?: CurveHit;
  private selected?: CurveHit;
  private session?: CurveSession;

  private get config (): Readonly<CurveConfig> {
    return this._owner.getConfigManager().get(curveConfig);
  }

  override requiresDragThreshold (): boolean {
    return false;
  }

  private targets (): MotionPathTarget[] {
    return this._owner.getSelection().getSelectedPlayerItems().filter(item => item.isVisible).flatMap(findMotionPaths);
  }

  override onUpdate (): void {
    const targets = this.targets();
    const contains = (hit: CurveHit): boolean =>
      targets.some(target =>
        target.item === hit.target.item
        && target.clip === hit.target.clip);

    if (this.session && !contains(this.session)) {
      this.cancelInteraction();
    }
    if (this.hover && !contains(this.hover)) {
      this.hover = undefined;
    }
    if (this.selected && !contains(this.selected)) {
      this.selected = undefined;
    }
  }

  private parentMatrix (item: VFXItem): Matrix4 {
    return item.transform.getParentMatrix() ?? new Matrix4();
  }

  private hit (point: Vector2): CurveHit | undefined {
    let closest: CurveHit | undefined;
    let distance = Infinity;
    const config = this.config;

    for (const target of this.targets()) {
      const parent = this.parentMatrix(target.item);

      // 优先最近的点；控制柄和路径点完全重合时仍能拖动路径点。
      for (const control of [false, true]) {
        const radius = control
          ? Math.max(config.controlPointRadius, config.selectedControlPointRadius, config.hoverControlPointRadius)
          : Math.max(config.pointSize, config.selectedPointSize, config.hoverPointSize) / 2;
        const border = control
          ? Math.max(config.controlPointOutlineWidth, config.controlPointLineWidth / 2)
          : Math.max(config.pointOutlineWidth, config.pointLineWidth / 2);

        target.path[control ? 2 : 1].forEach((value, index) => {
          const next = localToView(target.item, new Vector3(...value), parent).distance(point);

          if (next < radius + border + 1 && next < distance) {
            distance = next;
            closest = { target, index, control };
          }
        });
      }
    }

    return closest;
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.hover = this.hit(event.position);
    if (this.hover) {
      this._owner.setCursor({ type: GestureCursorType.HAND, angle: 0 });
      event.accept();
    }
  }

  override onMouseLeave (): void {
    this.hover = undefined;
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    const hit = this.hit(event.position);

    if (!hit) {
      return;
    }
    const { target, index, control } = hit;
    const parent = this.parentMatrix(target.item);

    if (Math.abs(parent.determinant()) < 1e-10) {
      return;
    }
    const point = new Vector3(...target.path[control ? 2 : 1][index]);
    const world = point.clone().applyMatrix(parent);
    const plane = target.item.composition!.camera.getViewMatrix().clone().invert();

    // 相机朝向平面经过被拖动点；保留透视深度。
    plane.elements[12] = world.x;
    plane.elements[13] = world.y;
    plane.elements[14] = world.z;
    this.session = {
      ...hit,
      original: cloneConfigValue(target.path),
      plane,
      start: event.position.clone(),
      view: localToView(target.item, point, parent),
    };
    this.selected = hit;
    this.hover = hit;
    this._owner.setCursor({ type: GestureCursorType.ACTIVE_HAND, angle: 0 });
    this.emit('actionstart');
    event.accept();
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    const session = this.session;

    if (!session) {
      return;
    }
    this._owner.setCursor({ type: GestureCursorType.ACTIVE_HAND, angle: 0 });
    const { target, control, index, plane, start, view } = session;
    const movement = event.position.clone().subtract(start);

    if (event.shiftPressed) {
      if (Math.abs(movement.x) >= Math.abs(movement.y)) {
        movement.y = 0;
      } else {
        movement.x = 0;
      }
    }
    const point = viewToLocal(target.item, view.clone().add(movement), 0, plane);
    const parent = this.parentMatrix(target.item);

    if (!point || Math.abs(parent.determinant()) < 1e-10) {
      return;
    }
    point.applyMatrix(plane).applyMatrix(parent.clone().invert());
    // 仅按下或零位移不改写路径，也不会意外镜像原本不对称的控制柄。
    if (point.distance(new Vector3(...target.path[control ? 2 : 1][index])) < 1e-8) {
      event.accept();

      return;
    }
    const path = cloneConfigValue(target.path);
    const values = path[control ? 2 : 1];

    if (control) {
      values[index] = [point.x, point.y, point.z];
      const paired = index % 2 === 0 ? index - 1 : index + 1;

      if (!event.altPressed && paired >= 0 && paired < values.length) {
        const center = new Vector3(...path[1][Math.ceil(index / 2)]);
        const opposite = center.multiply(2).subtract(point);

        values[paired] = [opposite.x, opposite.y, opposite.z];
      }
    } else {
      const delta = point.clone().subtract(new Vector3(...values[index]));

      values[index] = [point.x, point.y, point.z];
      for (const j of [index * 2 - 1, index * 2]) {
        if (!path[2][j]) {
          continue;
        }
        const next = new Vector3(...path[2][j]).add(delta);

        path[2][j] = [next.x, next.y, next.z];
      }
    }
    setMotionPath(target, path);
    target.path = path;
    target.composition.sampleTime(target.composition.getTime());
    this.emit('actionupdate');
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.session) {
      return;
    }
    if (event.isCanceled()) {
      this.cancelInteraction();
    } else {
      const session = this.session;

      this.session = undefined;
      this.emit('actioncommit', false, session);
    }
    this.hover = this.hit(event.position);
    this._owner.setCursor({ type: this.hover ? GestureCursorType.HAND : GestureCursorType.NORMAL, angle: 0 });
    event.accept();
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.keycode.toLowerCase() === 'escape' && this.session) {
      this.cancelInteraction();
      event.accept();
    }
  }

  override dispose (): void {
    this.cancelInteraction();
    this.hover = undefined;
    this.selected = undefined;
  }

  private cancelInteraction (): void {
    const session = this.session;

    if (!session) {
      return;
    }
    const { target, original } = session;

    this.session = undefined;
    setMotionPath(target, original);
    target.path = original;
    target.composition.sampleTime(target.composition.getTime());
    this.emit('actionupdate', true, session);
    this.hover = undefined;
    this._owner.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });
  }

  private emit (phase: GizmoActionPhase, canceled = false, session = this.session): void {
    if (!session) {
      return;
    }
    const { target, index, control } = session;
    const pointIndex = control ? Math.ceil(index / 2) : index;
    const keys = target.path[0];
    const time = pointIndex < keys.length - 1
      ? getControlPoints(keys[pointIndex], keys[pointIndex + 1], true).p0.x
      : getControlPoints(keys[pointIndex - 1], keys[pointIndex], true).p3!.x;

    const event: CurveActionEvent = {
      source: this,
      editType: 'curve',
      itemId: target.item.getInstanceId(),
      canceled,
      keyframeTime: target.clip.start + time * target.clip.duration,
    };

    this._owner.emit(phase, event);
  }

  override draw (control: Control): void {
    const config = this.config;

    for (const target of this.targets()) {
      const { item, path } = target;
      const parent = this.parentMatrix(item);
      const project = (value: Vector3): Vector2 => localToView(item, value, parent);
      const points = path[1].map(value => new Vector3(...value));
      const controls = path[2].map(value => new Vector3(...value));
      const matches = (hit: CurveHit | undefined, index: number, isControl: boolean): boolean =>
        !!hit
        && hit.target.item === item
        && hit.target.clip === target.clip
        && hit.index === index
        && hit.control === isControl;

      controls.forEach((point, index) => {
        const view = project(point);
        const anchor = project(points[Math.ceil(index / 2)]);

        control.drawLine(
          view.x, view.y, anchor.x, anchor.y,
          toColor(config.controlLineOutlineColor), config.controlLineOutlineWidth,
        );
        control.drawLine(
          view.x, view.y, anchor.x, anchor.y,
          toColor(config.controlLineColor), config.controlLineWidth,
        );
      });

      for (let i = 0; i < points.length - 1; i++) {
        const line: number[] = [];

        for (let j = 0; j <= 32; j++) {
          const t = j / 32;
          const s = 1 - t;
          const point = points[i].clone().multiply(s ** 3).add(controls[i * 2].clone().multiply(3 * s * s * t))
            .add(controls[i * 2 + 1].clone().multiply(3 * s * t * t)).add(points[i + 1].clone().multiply(t ** 3));
          const view = project(point);

          line.push(view.x, view.y);
        }
        control.drawPolyline(line, toColor(config.pathOutlineColor), config.pathOutlineWidth);
        control.drawPolyline(line, toColor(config.pathColor), config.pathWidth);
      }
      controls.forEach((point, index) => {
        const view = project(point);
        const selected = matches(this.session ?? this.selected, index, true);
        const hovered = matches(this.hover, index, true);
        const radius = selected ? config.selectedControlPointRadius
          : hovered ? config.hoverControlPointRadius : config.controlPointRadius;
        const fill = selected ? config.selectedControlPointFillColor
          : hovered ? config.hoverControlPointFillColor : config.controlPointFillColor;

        control.fillCircle(
          view.x, view.y, radius + config.controlPointOutlineWidth,
          toColor(config.controlPointOutlineColor),
        );
        control.fillCircle(view.x, view.y, radius, toColor(fill));
        control.drawCircle(
          view.x, view.y, radius,
          toColor(config.controlPointLineColor), config.controlPointLineWidth,
        );
      });
      points.forEach((point, index) => {
        const view = project(point);
        const selected = matches(this.session ?? this.selected, index, false);
        const hovered = matches(this.hover, index, false);
        const size = selected ? config.selectedPointSize : hovered ? config.hoverPointSize : config.pointSize;
        const radius = size / 2;
        const border = config.pointOutlineWidth;
        const fill = selected ? config.selectedPointFillColor
          : hovered ? config.hoverPointFillColor : config.pointFillColor;

        control.fillRect(
          view.x - radius - border, view.y - radius - border, size + border * 2, size + border * 2,
          toColor(config.pointOutlineColor),
        );
        control.fillRect(view.x - radius, view.y - radius, size, size, toColor(fill));
        control.drawRect(
          view.x - radius, view.y - radius, size, size,
          toColor(config.pointLineColor), config.pointLineWidth,
        );
      });
    }
  }
}
