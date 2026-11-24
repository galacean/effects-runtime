import {
  MouseButton,
  ShapeComponent,
  isValidGradientPaint,
  math,
  spec,
  type GradientPaint,
  type InputEventKey,
  type InputEventMouseButton,
  type InputEventMouseMotion,
  type VFXItem,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoOwner } from '../gizmo-owner';
import { Gizmo } from '../gizmo';
import type { GizmoActionEvent, GizmoActionPhase } from '../gizmo-action';
import { GizmoType } from '../gizmo-type';
import { Vector2, Vector3 } from '../math';
import { toColor } from '../drawing';
import { gradientConfig } from '../configs/builtin-configs';
import type { GradientConfig } from '../configs/types';
import { localToView, snapTranslation, viewToLocal } from './content-edit-utils';

/** 渐变填充或描边编辑事件。 */
export interface GradientActionEvent extends GizmoActionEvent {
  source: GradientGizmo,
  editType: 'gradient',
  itemId: string,
  paintKind: 'fill' | 'stroke',
  paintIndex: number,
}

type Stop = GradientPaint['gradientStops']['stops'][number];
type Hit = { type: 'start' | 'end' | 'rotate' } | { type: 'stop', stop: Stop } | { type: 'add', ratio: number };

/** 对齐 shape.frag 的 smoothstep 插值，不修改运行时颜色插值定义。 */
export function sampleGradient (paint: GradientPaint, ratio: number): math.Color {
  const stops = paint.gradientStops.stops;
  const color = new math.Color().copyFrom(stops[0].color);

  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const t = Math.max(0, Math.min(1, (ratio - a.time) / (b.time - a.time)));
    const weight = t * t * (3 - 2 * t);

    color.r += (b.color.r - color.r) * weight;
    color.g += (b.color.g - color.g) * weight;
    color.b += (b.color.b - color.b) * weight;
    color.a += (b.color.a - color.a) * weight;
  }

  return color;
}

/** 编辑指定填充/描边的渐变，不接管对象选择和输入分发。 */
export class GradientGizmo extends Gizmo {
  readonly type = GizmoType.GRADIENT;
  private selected = -1;
  private preview?: number;
  private session?: {
    component: ShapeComponent,
    hit: Hit,
    start: Vector2,
    original: GradientPaint,
    paint: GradientPaint,
    stopView?: Vector2,
    selected: number,
  };

  constructor (
    owner: GizmoOwner,
    readonly item: VFXItem,
    readonly paintKind: 'fill' | 'stroke' = 'fill',
    readonly paintIndex = 0,
    private readonly exit: () => void = () => {},
    private readonly onDispose?: () => void,
  ) {
    super(owner);
  }

  private get component (): ShapeComponent {
    return this.item.getComponent(ShapeComponent);
  }

  private get config (): Readonly<GradientConfig> {
    return this._owner.getConfigManager().get(gradientConfig);
  }

  private get paint (): GradientPaint | undefined {
    const paint = this.session?.paint ?? this.component?.getGradientPaint(this.paintKind, this.paintIndex);

    return isValidGradientPaint(paint) ? paint : undefined;
  }

  get selectedStopIndex (): number {
    return this.selected;
  }

  /** 属性面板与画布共用色标选择；拖动中的目标保持不变。 */
  selectStop (index: number): void {
    if (!this.session && Number.isInteger(index) && this.paint?.gradientStops.stops[index]) {
      this.selected = index;
    }
  }

  override requiresDragThreshold (): boolean {
    return false;
  }

  override onUpdate (): void {
    const selected = this._owner.getSelection().getSelectedPlayerItems();

    if (selected.length !== 1
      || selected[0] !== this.item
      || !isValidGradientPaint(this.component?.getGradientPaint(this.paintKind, this.paintIndex))
      || (this.session && !this.matchesSession())) {
      this.cancelInteraction();
      this.exit();
    }
  }

  /** 仅恢复本次手势最后写入的 paint，不覆盖外部替换或修改。 */
  private matchesSession (expected = this.session?.paint): boolean {
    const session = this.session;
    const component = this.component;

    if (!session || !expected || component !== session.component) {
      return false;
    }
    const current = component?.getGradientPaint(this.paintKind, this.paintIndex);

    return !!current && current.type === expected.type
      && current.startPoint.equals(expected.startPoint) && current.endPoint.equals(expected.endPoint)
      && current.gradientStops.stops.length === expected.gradientStops.stops.length
      && current.gradientStops.stops.every((stop, index) => {
        const other = expected.gradientStops.stops[index];

        return stop.time === other.time && stop.color.r === other.color.r && stop.color.g === other.color.g
          && stop.color.b === other.color.b && stop.color.a === other.color.a;
      });
  }

  private toView (uv: Vector2): Vector2 {
    const bounds = this.component.getLocalBounds()!;

    return localToView(
      this.item,
      new Vector3(
        bounds.min.x + uv.x * (bounds.max.x - bounds.min.x),
        bounds.min.y + uv.y * (bounds.max.y - bounds.min.y),
        0
      )
    );
  }

  private toUV (view: Vector2): Vector2 | undefined {
    const point = viewToLocal(this.item, view);
    const bounds = this.component.getLocalBounds();

    if (!point || !bounds || bounds.max.x === bounds.min.x || bounds.max.y === bounds.min.y) {
      return;
    }

    return new Vector2(
      (point.x - bounds.min.x) / (bounds.max.x - bounds.min.x),
      (point.y - bounds.min.y) / (bounds.max.y - bounds.min.y)
    );
  }

  private stopUV (paint: GradientPaint, ratio: number): Vector2 {
    const delta = paint.endPoint.clone().subtract(paint.startPoint);

    if (paint.type === spec.FillType.GradientAngular) {
      const angle = Math.atan2(delta.y, delta.x) + ratio * Math.PI * 2;

      return paint.startPoint.clone().add(new Vector2(Math.cos(angle), Math.sin(angle)).multiply(delta.length()));
    }

    return paint.startPoint.clone().add(delta.multiply(ratio));
  }

  private ratio (paint: GradientPaint, view: Vector2): number | undefined {
    const point = this.toUV(view);

    if (!point) {
      return;
    }
    const delta = paint.endPoint.clone().subtract(paint.startPoint);
    const relative = point.subtract(paint.startPoint);

    if (delta.lengthSquared() < 1e-10) {
      return;
    }
    if (paint.type === spec.FillType.GradientAngular) {
      const ratio = (Math.atan2(relative.y, relative.x) - Math.atan2(delta.y, delta.x)) / (Math.PI * 2);

      return (ratio % 1 + 1) % 1;
    }

    return Math.max(0, Math.min(1, relative.dot(delta) / delta.lengthSquared()));
  }

  private stopView (paint: GradientPaint, ratio: number): { center: Vector2, base: Vector2, normal: Vector2 } {
    const base = this.toView(this.stopUV(paint, ratio));
    const start = this.toView(paint.startPoint);
    const end = this.toView(paint.endPoint);
    const direction = end.clone().subtract(start);
    const normal = paint.type === spec.FillType.GradientAngular ? base.clone().subtract(start).normalize()
      : new Vector2(-direction.y, direction.x).normalize();

    return { base, normal, center: base.clone().add(normal.clone().multiply(this.config.stopOffset)) };
  }

  private hit (view: Vector2, paint: GradientPaint): Hit | undefined {
    if (!this.component.getLocalBounds()) {
      return;
    }
    const config = this.config;
    const stops = paint.gradientStops.stops;
    const indexes = stops.map((_, i) => i).reverse().filter(index => index !== this.selected);

    if (this.selected >= 0) {
      indexes.unshift(this.selected);
    }
    for (const index of indexes) {
      if (!stops[index]) {
        continue;
      }
      const { center, normal } = this.stopView(paint, stops[index].time);
      const offset = view.clone().subtract(center);

      if (Math.abs(offset.dot(normal)) <= config.stopHeight / 2
        && Math.abs(offset.dot(new Vector2(normal.y, -normal.x))) <= config.stopWidth / 2) {
        return { type: 'stop', stop: stops[index] };
      }
    }
    if (this.toView(paint.startPoint).distance(view) < config.endpointRadius + 4) {
      return { type: 'start' };
    }
    const endDistance = this.toView(paint.endPoint).distance(view);

    if (endDistance < config.endpointRadius + 4) {
      return { type: 'end' };
    }
    if (paint.type !== spec.FillType.GradientLinear && endDistance < config.rotationRadius + 4) {
      return { type: 'rotate' };
    }
    const ratio = this.ratio(paint, view);

    if (ratio === undefined) {
      return;
    }
    const { base, normal } = this.stopView(paint, ratio);
    const offset = view.clone().subtract(base);
    const distance = offset.dot(normal);

    if (distance >= config.stopOffset - config.stopHeight / 2 - 2
      && distance <= config.stopOffset + config.stopHeight / 2 + 4
      && Math.abs(offset.dot(new Vector2(normal.y, -normal.x))) < config.stopWidth / 2 + 2) {
      return { type: 'add', ratio };
    }
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    const paint = this.paint;
    const hit = paint && this.hit(event.position, paint);

    this.preview = hit?.type === 'add' ? hit.ratio : undefined;
    event.accept();
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    const paint = this.paint;

    if (!paint) {
      return;
    }
    let hit = this.hit(event.position, paint);

    event.accept();
    if (!hit) {
      this.exit();

      return;
    }
    const original = this.component.getGradientPaint(this.paintKind, this.paintIndex)!;
    const selected = this.selected;

    if (hit.type === 'add') {
      const ratio = hit.ratio;
      const existing = paint.gradientStops.stops.find(stop => Math.abs(stop.time - ratio) < 1e-6);

      if (!existing && paint.gradientStops.stops.length >= 8) {
        return;
      }
      const stop = existing ?? { time: ratio, color: sampleGradient(paint, ratio) };

      if (!existing) {
        paint.gradientStops.stops.push(stop);
        paint.gradientStops.stops.sort((a, b) => a.time - b.time);
      }
      hit = { type: 'stop', stop };
    }
    this.selected = hit.type === 'stop' ? paint.gradientStops.stops.indexOf(hit.stop) : -1;
    this.session = {
      component: this.component, hit, start: event.position.clone(), original, paint, selected,
      stopView: hit.type === 'stop' ? this.toView(this.stopUV(paint, hit.stop.time)) : undefined,
    };
    // 同步监听者可能退出模式或替换 paint，写入前必须重新确认会话和目标。
    this.emit('actionstart');
    if (!this.session) {
      return;
    }
    if (!this.matchesSession(original)) {
      this.cancelInteraction();
      this.exit();

      return;
    }
    this.write();
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    const session = this.session;

    if (!session) {
      return;
    }
    if (!this.matchesSession()) {
      this.cancelInteraction();
      this.exit();
      event.accept();

      return;
    }
    const { hit, original, paint, start } = session;
    const delta = event.position.clone().subtract(start);

    if (hit.type === 'start' || hit.type === 'end') {
      const key = hit.type === 'start' ? 'startPoint' : 'endPoint';
      const opposite = hit.type === 'start' ? 'endPoint' : 'startPoint';
      const applePlatform = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const symmetric = applePlatform ? event.metaPressed : event.altPressed;
      const source = this.toView(original[key]);
      const targets = [
        new Vector2(0, 0),
        new Vector2(1, 0),
        new Vector2(1, 1),
        new Vector2(0, 1),
        new Vector2(0.5, 0.5),
      ].map(point =>
        this.toView(point));

      if (!symmetric) {
        targets.push(this.toView(original[opposite]));
      }
      const point = this.toUV(source.clone().add(snapTranslation([source], targets, delta)));

      if (!point) {
        return;
      }
      const other = symmetric
        ? original[opposite].clone().subtract(point.clone().subtract(original[key]))
        : original[opposite].clone();

      if (point.distance(other) < 1e-6) {
        return;
      }
      paint[key] = point;
      paint[opposite] = other;
    } else if (hit.type === 'rotate') {
      const point = this.toUV(event.position);

      if (!point) {
        return;
      }
      const direction = point.subtract(paint.startPoint);

      if (direction.length() < 1e-6) {
        return;
      }
      paint.endPoint = paint.startPoint.clone()
        .add(direction.normalize().multiply(original.endPoint.distance(original.startPoint)));
    } else if (hit.type === 'stop') {
      const ratio = this.ratio(paint, session.stopView!.clone().add(delta));

      if (ratio === undefined
        || paint.gradientStops.stops.some(stop =>
          stop !== hit.stop
          && Math.abs(stop.time - ratio) < 1e-6)) {
        return;
      }
      hit.stop.time = ratio;
      paint.gradientStops.stops.sort((a, b) => a.time - b.time);
      this.selected = paint.gradientStops.stops.indexOf(hit.stop);
    }
    this.write();
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.session) {
      return;
    }
    if (!this.matchesSession()) {
      this.cancelInteraction();
      this.exit();
    } else if (event.isCanceled()) {
      this.cancelInteraction();
    } else {
      this.emit('actioncommit');
      this.session = undefined;
    }
    event.accept();
  }

  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (key === 'escape') {
      if (this.session) {
        this.cancelInteraction();
      } else {
        this.exit();
      }
      event.accept();
    }
    if (key !== 'backspace' && key !== 'delete') {
      return;
    }
    event.accept();
    const paint = this.paint;

    if (this.session || !paint || this.selected < 0 || paint.gradientStops.stops.length <= 2) {
      return;
    }
    this.emit('actionstart');
    paint.gradientStops.stops.splice(this.selected, 1);
    this.selected = -1;
    this.component.setGradientPaint(this.paintKind, this.paintIndex, paint);
    this.emit('actionupdate');
    this.emit('actioncommit');
  }

  override dispose (): void {
    this.onDispose?.();
    this.cancelInteraction();
  }

  /** 供所属内容编辑模式退出时回滚；不释放指针捕获或资源。 */
  cancelInteraction (): void {
    const session = this.session;

    if (!session) {
      return;
    }
    const restore = this.matchesSession();

    this.session = undefined;
    this.preview = undefined;
    this.selected = restore ? session.selected : -1;
    if (restore) {
      session.component.setGradientPaint(this.paintKind, this.paintIndex, session.original);
    }
    this.emit('actionupdate', true);
  }

  private write (): void {
    this.component.setGradientPaint(this.paintKind, this.paintIndex, this.session!.paint);
    this.emit('actionupdate');
  }

  private emit (phase: GizmoActionPhase, canceled = false): void {
    const event: GradientActionEvent = {
      source: this,
      editType: 'gradient',
      itemId: this.item.getInstanceId(),
      paintKind: this.paintKind,
      paintIndex: this.paintIndex,
      canceled,
    };

    this._owner.emit(phase, event);
  }

  override draw (control: Control): void {
    const paint = this.paint;

    if (!paint || !this.component?.getLocalBounds()) {
      return;
    }
    const config = this.config;
    const start = this.toView(paint.startPoint);
    const end = this.toView(paint.endPoint);

    control.drawLine(start.x, start.y, end.x, end.y, toColor(config.lineColor), config.lineWidth);
    if (paint.type !== spec.FillType.GradientLinear) {
      const radius = paint.endPoint.distance(paint.startPoint);
      const circle: number[] = [];

      for (let i = 0; i <= 64; i++) {
        const point = this.toView(paint.startPoint.clone().add(
          new Vector2(Math.cos(i / 64 * Math.PI * 2), Math.sin(i / 64 * Math.PI * 2)).multiply(radius),
        ));

        circle.push(point.x, point.y);
      }
      control.drawPolyline(circle, toColor(config.rangeLineColor), config.rangeLineWidth);
      control.drawCircle(
        end.x, end.y, config.rotationRadius,
        toColor(config.rotationLineColor), config.rotationLineWidth,
      );
    }
    for (const point of [start, end]) {
      control.fillCircle(point.x, point.y, config.endpointRadius, toColor(config.endpointFillColor));
      if (config.endpointLineWidth > 0) {
        control.drawCircle(
          point.x, point.y, config.endpointRadius,
          toColor(config.endpointLineColor), config.endpointLineWidth,
        );
      }
    }
    const drawStop = (ratio: number, color: math.Color, selected: boolean): void => {
      const { center, normal } = this.stopView(paint, ratio);
      const tangent = new Vector2(normal.y, -normal.x);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) =>
        center.clone().add(tangent.clone().multiply(x * config.stopWidth / 2))
          .add(normal.clone().multiply(y * config.stopHeight / 2)));
      const [a, b, c, d] = corners;
      const fillColor = selected ? config.selectedStopFillColor ?? config.stopFillColor : config.stopFillColor;
      const fill = fillColor === undefined ? color : toColor(fillColor);

      control.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y, fill);
      control.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y, fill);
      control.drawPolyline(
        [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y, a.x, a.y],
        toColor(selected ? config.selectedStopLineColor : config.stopLineColor),
        selected ? config.selectedStopLineWidth : config.stopLineWidth,
      );
      if (selected) {
        control.drawText(
          center.x + config.labelOffsetX, center.y + config.labelOffsetY,
          `${Math.round(ratio * 100)}%`, config.labelFontSize, toColor(config.labelTextColor),
        );
      }
    };

    paint.gradientStops.stops.forEach((stop, index) => {
      if (index !== this.selected) {
        drawStop(stop.time, stop.color, false);
      }
    });
    const selected = paint.gradientStops.stops[this.selected];

    if (selected) {
      drawStop(selected.time, selected.color, true);
    }
    if (this.preview !== undefined && !this.session && paint.gradientStops.stops.length < 8) {
      drawStop(this.preview, sampleGradient(paint, this.preview), true);
    }
  }
}
