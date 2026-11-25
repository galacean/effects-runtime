import {
  MouseButton,
  ShapeComponent,
  SpriteComponent,
  type InputEventKey,
  type InputEventMouseButton,
  type InputEventMouseMotion,
  type VFXItem,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoOwner } from '../gizmo-owner';
import { Gizmo } from '../gizmo';
import { GizmoType } from '../gizmo-type';
import { GestureCursorType } from '../cursor';
import { Euler, Matrix4, Quaternion, Vector2, Vector3, getTransformedBoxCorners } from '../math';
import { toColor } from '../drawing';
import { transformHandlesConfig } from '../configs/builtin-configs';
import type { TransformHandlesConfig } from '../configs/types';
import { localToView, snapTranslation, viewToLocal } from './content-edit-utils';
import { TransformType, type ResizeSelectionGizmo } from './resize-selection-gizmo';
import {
  captureMotionPaths,
  restoreMotionPaths,
  updateMotionPathTranslation,
  transformMotionPaths,
  type MotionPathSnapshot,
} from './motion-path';

type Handle = 'anchor' | 'x' | 'y' | 'scale' | 'rotate';
type Snapshot = {
  item: VFXItem,
  position: Vector3,
  scale: Vector3,
  anchor: Vector3,
  quat: Quaternion,
  rotation: Euler,
  world: Matrix4,
};

/** 修改锚点并补偿位置，保持编辑当下的世界矩阵不变；后续变换使用新锚点。 */
export function moveAnchor (item: VFXItem, anchor: Vector3): void {
  const transform = item.transform;
  const old = transform.anchor.clone();
  const matrix = new Matrix4().compose(new Vector3(), transform.quat, transform.scale);
  const compensation = anchor.clone().subtract(old).applyMatrix(matrix).subtract(anchor.clone().subtract(old));

  transform.setAnchor(anchor.x, anchor.y);
  transform.translate(compensation.x, compensation.y, compensation.z);
}

/** 新增锚点、屏幕轴和保守的多选整体变换；单选缩放/Z 旋转仍使用原工具。 */
export class TransformHandlesGizmo extends Gizmo {
  readonly type = GizmoType.TRANSFORM_HANDLES;
  private readonly configOff: () => void;
  private hover?: Handle;
  private motionPaths: MotionPathSnapshot[] = [];
  private session?: {
    handle: Handle,
    snapshots: Snapshot[],
    start: Vector2,
    last: Vector2,
    center: Vector2,
    pivot: Vector3,
    corner?: Vector2,
    alt: boolean,
    angle: number,
    applied: Set<TransformType>,
  };

  constructor (owner: GizmoOwner, private readonly resize: ResizeSelectionGizmo) {
    super(owner);
    this.configOff = owner.getConfigManager().onChange(transformHandlesConfig, () => this.onConfigChange());
  }

  private isHandleEnabled (handle: Handle): boolean {
    const config = this.config;

    switch (handle) {
      case 'x':
        return config.xAxisEnabled;
      case 'y':
        return config.yAxisEnabled;
      case 'anchor':
        return config.anchorEnabled;
      default:
        return true;
    }
  }

  private get config (): Readonly<TransformHandlesConfig> {
    return this._owner.getConfigManager().get(transformHandlesConfig);
  }

  private onConfigChange (): void {
    if (this.session && !this.isHandleEnabled(this.session.handle)) {
      this.cancelInteraction();
    }
    if (this.hover && !this.isHandleEnabled(this.hover)) {
      this.hover = undefined;
      this._owner.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });
    }
  }

  private items (): VFXItem[] {
    return this._owner.getSelection().getSelectedPlayerItems().filter(item => item.isVisible);
  }

  override prepareForDispatch (): void {
    this.resize.refreshWireframeBySelectedItems();
  }

  private corners (): Vector2[] {
    return this.resize.wireframe.transform ? getTransformedBoxCorners(this.resize.wireframe.transform) : [];
  }

  private anchorEnabled (): boolean {
    const items = this.items();
    const box = this.resize.wireframe.box;
    const radius = Math.max(this.config.anchorRadius, this.config.anchorFillRadius);

    return this.isHandleEnabled('anchor') && items.length === 1
      && Math.min(box.max.x - box.min.x, box.max.y - box.min.y) > radius * 4
      && !!(items[0].getComponent(SpriteComponent) || items[0].getComponent(ShapeComponent));
  }

  private hit (point: Vector2): { handle: Handle, corner?: Vector2 } | undefined {
    const frame = this.resize.wireframe;

    if (!frame.interactive || !this.items().length) {
      return;
    }
    const relative = point.clone().subtract(frame.anchor);
    const config = this.config;
    const anchorRadius = Math.max(config.anchorRadius, config.anchorFillRadius);
    const axisHitWidth = Math.max(config.axisArrowWidth, config.axisLineWidth, config.activeAxisLineWidth) / 2 + 1;

    if (this.anchorEnabled() && relative.length() < anchorRadius) {
      return { handle: 'anchor' };
    }
    if (config.xAxisEnabled && relative.x > anchorRadius
      && relative.x <= config.axisLength && Math.abs(relative.y) < axisHitWidth) {
      return { handle: 'x' };
    }
    if (config.yAxisEnabled && -relative.y > anchorRadius
      && -relative.y <= config.axisLength && Math.abs(relative.x) < axisHitWidth) {
      return { handle: 'y' };
    }
    if (this.items().length > 1) {
      const hitSize = config.groupCornerSize / 2 + 3;

      for (const corner of this.corners()) {
        const offset = point.clone().subtract(corner);

        if (Math.abs(offset.x) <= hitSize && Math.abs(offset.y) <= hitSize) {
          return { handle: 'scale', corner };
        }
        const outward = corner.clone().subtract(frame.anchor);
        const rotation = corner.clone().add(new Vector2(
          Math.sign(outward.x) * hitSize, Math.sign(outward.y) * hitSize,
        ));

        if (Math.abs(point.x - rotation.x) <= hitSize && Math.abs(point.y - rotation.y) <= hitSize) {
          return { handle: 'rotate', corner };
        }
      }
    }
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.hover = this.hit(event.position)?.handle;
    if (this.hover) {
      this.updateCursor(this.hover, event.altPressed);
      event.accept();
    }
  }

  override onMouseLeave (): void {
    if (!this.session) {
      this.hover = undefined;
    }
  }

  private updateCursor (handle: Handle, alt: boolean): void {
    const type = handle === 'anchor' ? this.session ? GestureCursorType.ACTIVE_HAND : GestureCursorType.HAND
      : handle === 'x' ? alt ? GestureCursorType.VERTICAL_ARROW : GestureCursorType.HORIZONTAL_ARROW
        : handle === 'y' ? alt ? GestureCursorType.HORIZONTAL_ARROW : GestureCursorType.VERTICAL_ARROW
          : handle === 'scale' ? GestureCursorType.SCALE : GestureCursorType.ROTATION;

    this._owner.setCursor({ type, angle: 0 });
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this.prepareForDispatch();
    const hit = this.hit(event.position);

    if (!hit) {
      return;
    }
    const items = this.items();
    const center = this.resize.wireframe.anchor.clone();
    const fixed = hit.handle === 'scale'
      && !event.altPressed
      && hit.corner
      ? center.clone().multiply(2).subtract(hit.corner)
      : center;
    const first = items[0];
    const plane = first.composition!.camera.getViewMatrix().clone().invert();

    plane.setPosition(first.transform.anchor.clone().applyMatrix(first.transform.getWorldMatrix()));
    const pivot = viewToLocal(first, fixed, 0, plane)?.applyMatrix(plane);

    if (!pivot) {
      return;
    }
    const snapshots = items.map(item => ({
      item,
      position: item.transform.position.clone(),
      scale: item.transform.scale.clone(),
      anchor: item.transform.anchor.clone(),
      quat: item.transform.quat.clone(),
      rotation: item.transform.rotation.clone(),
      world: item.transform.getWorldMatrix().clone(),
    }));

    this.session = {
      ...hit,
      snapshots,
      center: fixed,
      pivot,
      start: event.position.clone(),
      last: event.position.clone(),
      alt: event.altPressed,
      angle: 0,
      applied: new Set(),
    };
    this.motionPaths = items.map(captureMotionPaths);
    this.hover = hit.handle;
    this.updateCursor(hit.handle, event.altPressed);
    this.emit('actionstart');
    event.accept();
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    const session = this.session;

    if (!session) {
      return;
    }
    const { handle, snapshots, start, center } = session;
    const delta = event.position.clone().subtract(start);
    const before = snapshots.map(({ item }) => ({
      position: item.transform.position.clone(), scale: item.transform.scale.clone(),
      quat: item.transform.quat.clone(), anchor: item.transform.anchor.clone(),
    }));

    this.updateCursor(handle, event.altPressed);
    if (handle === 'anchor') {
      const snapshot = snapshots[0];

      if (event.shiftPressed) {
        if (Math.abs(delta.x) >= Math.abs(delta.y)) {
          delta.y = 0;
        } else {
          delta.x = 0;
        }
      }
      const initialView = localToView(snapshot.item, snapshot.anchor, snapshot.world);
      const movement = event.shiftPressed
        ? delta
        : snapTranslation(
          [initialView],
          [...this.corners(), this.resize.wireframe.box.getCenter()],
          delta
        );
      const point = viewToLocal(snapshot.item, initialView.add(movement), snapshot.anchor.z, snapshot.world);

      if (!point) {
        return;
      }
      moveAnchor(snapshot.item, point);
      this.motionPaths.forEach(updateMotionPathTranslation);
    } else if (handle === 'x' || handle === 'y') {
      const step = event.position.clone().subtract(session.last);

      if (session.alt !== event.altPressed) {
        session.alt = event.altPressed;
        session.last.copyFrom(event.position);

        return;
      }
      if (event.altPressed) {
        for (const { item } of snapshots) {
          const rotation = item.transform.rotation;

          item.transform.setRotation(
            rotation.x + (handle === 'x'
              ? -step.y
              : 0),
            rotation.y + (handle === 'y'
              ? -step.x
              : 0),
            rotation.z
          );
        }
      } else {
        if (handle === 'x') {
          step.y = 0;
        } else {
          step.x = 0;
        }
        const translations = snapshots.map(({ item: target }) => {
          const parent = target.transform.getParentMatrix() ?? new Matrix4();

          if (Math.abs(parent.determinant()) < 1e-10) {
            return undefined;
          }
          const inverse = parent.clone().invert();
          const plane = target.composition!.camera.getViewMatrix().clone().invert();

          plane.setPosition(target.transform.anchor.clone().applyMatrix(target.transform.getWorldMatrix()));
          const before = viewToLocal(target, session.last, 0, plane);
          const after = viewToLocal(target, session.last.clone().add(step), 0, plane);

          if (!before || !after) {
            return undefined;
          }
          const local = after.applyMatrix(plane).applyMatrix(inverse)
            .subtract(before.applyMatrix(plane).applyMatrix(inverse));

          return { target, local };
        });

        if (translations.some(translation => !translation)) {
          return;
        }
        for (const translation of translations) {
          const { target, local } = translation!;

          target.translate(local.x, local.y, local.z);
        }
        this.motionPaths.forEach(updateMotionPathTranslation);
      }
      session.last.copyFrom(event.position);
    } else {
      const initial = start.clone().subtract(center);
      const current = event.position.clone().subtract(center);
      let scale = 1;
      let angle = 0;

      if (handle === 'scale') {
        scale = current.dot(initial) / initial.lengthSquared();
        if (!Number.isFinite(scale) || scale < 0.001) {
          return;
        }
      } else {
        const previous = session.last.clone().subtract(center);

        session.angle += Math.atan2(previous.x * current.y - previous.y * current.x, previous.dot(current));
        session.last.copyFrom(event.position);
        angle = event.shiftPressed ? Math.round(session.angle / (Math.PI / 12)) * Math.PI / 12 : session.angle;
      }
      if (!this.applyGroupTransform(scale, angle)) {
        return;
      }
    }
    if (snapshots.some(({ item }, index) => {
      const initial = before[index];
      const current = item.transform;

      return !current.position.equals(initial.position) || !current.scale.equals(initial.scale)
        || !current.quat.equals(initial.quat) || !current.anchor.equals(initial.anchor);
    })) {
      session.applied.add(handle === 'anchor' ? TransformType.ANCHOR : handle === 'scale' ? TransformType.SCALE
        : handle === 'rotate' || event.altPressed ? TransformType.ROTATION : TransformType.TRANSLATION);
    }
    this._owner.setSelectionTransformKind(handle === 'x' || handle === 'y' ? 'move' : 'resize');
    this.emit('actionupdate');
    event.accept();
  }

  private applyGroupTransform (scale: number, angle: number): boolean {
    const { pivot, snapshots } = this.session!;
    const rotation = new Quaternion(0, 0, -Math.sin(angle / 2), Math.cos(angle / 2));
    const affine = new Matrix4().compose(new Vector3(), rotation, new Vector3(scale, scale, scale), pivot);
    const poses = snapshots.map(({ item, world, anchor }) => {
      const parent = item.transform.getParentMatrix() ?? new Matrix4();

      if (Math.abs(parent.determinant()) < 1e-10) {
        return;
      }
      const local = parent.clone().invert().multiply(affine.clone().multiply(world));
      const position = new Vector3();
      const quat = new Quaternion();
      const scaling = new Vector3();

      local.decompose(position, quat, scaling);
      const rebuilt = new Matrix4().compose(position, quat, scaling);

      // 父级非等比缩放可能产生剪切；不能完整表达时整组拒绝本次更新。
      if (rebuilt.elements.some((value, i) => !Number.isFinite(value) || Math.abs(value - local.elements[i]) > 1e-5)) {
        return;
      }
      position.add(anchor.clone().applyMatrix(new Matrix4().compose(new Vector3(), quat, scaling))).subtract(anchor);

      return { item, position, quat, scaling };
    });

    if (poses.some(pose => !pose)) {
      return false;
    }
    for (const pose of poses) {
      const { item, position, quat, scaling } = pose!;

      item.transform.setPosition(position.x, position.y, position.z);
      item.transform.setRotation(...new Euler().setFromQuaternion(quat.clone().conjugate()).toArray());
      item.transform.setScale(scaling.x, scaling.y, scaling.z);
    }
    this.motionPaths.forEach(snapshot => transformMotionPaths(snapshot, affine));

    return true;
  }

  override onMouseUp (event: InputEventMouseButton): void {
    const session = this.session;

    if (!session) {
      return;
    }
    if (event.isCanceled()) {
      this.cancelInteraction();
    } else {
      this.session = undefined;
      this.motionPaths = [];
      this._owner.setSelectionTransformKind('idle');
      this.emit('actioncommit', false, session);
    }
    this.hover = this.hit(event.position)?.handle;
    if (this.hover) {
      this.updateCursor(this.hover, event.altPressed);
    }
    event.accept();
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.keycode.toLowerCase() === 'escape' && this.session) {
      this.cancelInteraction();
      event.accept();
    }
  }

  override onUpdate (): void {
    if (this.session
      && (this.items().length !== this.session.snapshots.length
        || this.session.snapshots.some(({ item }) =>
          !this.items().includes(item)))) {
      this.cancelInteraction();
    }
  }

  override dispose (): void {
    this.configOff();
    this.cancelInteraction();
    this.hover = undefined;
  }

  private cancelInteraction (): void {
    const session = this.session;

    if (!session) {
      return;
    }
    this.session = undefined;
    this.motionPaths.forEach(restoreMotionPaths);
    this.motionPaths = [];
    for (const { item, position, scale, quat, rotation, anchor } of session.snapshots) {
      item.transform.setAnchor(anchor.x, anchor.y);
      item.transform.setPosition(position.x, position.y, position.z);
      item.transform.setScale(scale.x, scale.y, scale.z);
      item.transform.setQuaternion(quat.x, quat.y, quat.z, quat.w);
      item.transform.rotation.copyFrom(rotation);
    }
    this._owner.setSelectionTransformKind('idle');
    this.hover = undefined;
    this._owner.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });
    this.emit('actionupdate', true, session);
  }

  private emit (
    phase: 'actionstart' | 'actionupdate' | 'actioncommit',
    canceled = false,
    session = this.session,
  ): void {
    if (!session) {
      return;
    }
    const { handle, snapshots, alt, applied } = session;
    const initialType = handle === 'anchor' ? TransformType.ANCHOR : handle === 'scale' ? TransformType.SCALE
      : handle === 'rotate' || alt ? TransformType.ROTATION : TransformType.TRANSLATION;
    const transformType = applied.size > 1 ? TransformType.MIXED
      : applied.values().next().value ?? (phase === 'actionstart' ? initialType : TransformType.NULL);

    this._owner.emit(phase, { source: this, canceled, itemIds: snapshots.map(({ item }) => item.getInstanceId()),
      transformType, transformTypes: Array.from(applied) });
  }

  override draw (control: Control): void {
    this.resize.refreshWireframeBySelectedItems();
    if (!this.resize.wireframe.interactive || !this.items().length) {
      return;
    }
    const anchor = this.resize.wireframe.anchor;
    const config = this.config;

    for (const axis of ['x', 'y'] as const) {
      if (!this.isHandleEnabled(axis)) {
        continue;
      }
      const direction = axis === 'x' ? new Vector2(1, 0) : new Vector2(0, -1);
      const normal = new Vector2(-direction.y, direction.x);
      const end = anchor.clone().add(direction.clone().multiply(config.axisLength - config.axisArrowLength));
      const tip = anchor.clone().add(direction.clone().multiply(config.axisLength));
      const a = end.clone().add(normal.clone().multiply(config.axisArrowWidth / 2));
      const b = end.clone().subtract(normal.clone().multiply(config.axisArrowWidth / 2));
      const line = toColor(axis === 'x' ? config.xAxisLineColor : config.yAxisLineColor);
      const fill = toColor(axis === 'x' ? config.xAxisFillColor : config.yAxisFillColor);
      const width = this.session?.handle === axis ? config.activeAxisLineWidth : config.axisLineWidth;

      control.drawLine(anchor.x, anchor.y, end.x, end.y, line, width);
      control.fillTriangle(tip.x, tip.y, a.x, a.y, b.x, b.y, fill);
    }
    if (this.anchorEnabled()) {
      control.fillCircle(anchor.x, anchor.y, config.anchorFillRadius, toColor(config.anchorFillColor));
      control.drawCircle(
        anchor.x, anchor.y, config.anchorRadius,
        toColor(config.anchorLineColor), config.anchorLineWidth,
      );
      if ((this.session?.handle ?? this.hover) === 'anchor') {
        const item = this.items()[0];
        const size = item.transform.size;
        const bounds = item.getComponent(ShapeComponent)?.getLocalBounds() ?? {
          min: new Vector2(-Math.abs(size.x) / 2, -Math.abs(size.y) / 2),
          max: new Vector2(Math.abs(size.x) / 2, Math.abs(size.y) / 2),
        };
        const x = (item.transform.anchor.x - bounds.min.x) / (bounds.max.x - bounds.min.x);
        const y = (bounds.max.y - item.transform.anchor.y) / (bounds.max.y - bounds.min.y);
        const labels = [`x: ${Math.round(x * 100) / 100}`, `y: ${Math.round(y * 100) / 100}`];
        const metrics = labels.map(label => control.measureText(label, config.labelFontSize));
        const width = Math.max(...metrics.map(metric => metric.width)) + config.labelPaddingX * 2;
        const height = metrics[0].inkHeight + metrics[1].inkHeight + config.labelPaddingY * 2 + config.labelLineGap;
        const left = anchor.x + config.labelOffsetX;
        let top = anchor.y + config.labelOffsetY + config.labelPaddingY;

        control.fillRect(
          left, anchor.y + config.labelOffsetY, width, height,
          toColor(config.labelBackgroundColor),
        );
        labels.forEach((label, index) => {
          const metric = metrics[index];

          control.drawText(
            left + (width - metric.width) / 2,
            top - metric.inkTop,
            label,
            config.labelFontSize,
            toColor(config.labelTextColor),
          );
          top += metric.inkHeight + config.labelLineGap;
        });
      }
    }
    if (this.items().length > 1) {
      const size = config.groupCornerSize;

      for (const point of this.corners()) {
        control.fillRect(
          point.x - size / 2, point.y - size / 2, size, size,
          toColor(config.groupCornerFillColor),
        );
        control.drawRect(
          point.x - size / 2, point.y - size / 2, size, size,
          toColor(config.groupCornerLineColor), config.groupCornerLineWidth,
        );
      }
    }
  }
}
