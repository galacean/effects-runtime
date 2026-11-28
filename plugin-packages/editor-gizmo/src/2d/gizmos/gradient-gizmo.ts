import { beginDataEdit, updateDataEdit, type DataEditState } from '../data-editing';
import { cloneConfigValue } from '../configs/config-definition';
import {
  MouseButton,
  ShapeComponent,
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
import { getGradientPaint, getShapeRenderBounds, isValidGradientPaint, setGradientPaint } from '../items/shape-editing';

/** 渐变填充或描边编辑事件。 */
export interface GradientActionEvent extends GizmoActionEvent {
  source: GradientGizmo,
  editType: 'gradient',
  itemId: string,
  paintKind: 'fill' | 'stroke',
  paintIndex: number,
}

/** 渐变色标选中状态或位置变化；独立于编辑事务生命周期。 */
export interface GradientSelectionEvent extends GradientActionEvent {
  /** 新选中色标在当前排序中的索引，从 0 开始；未选中时为 -1。 */
  index: number,
  /** 色标位置百分比，范围 0–100；未选中时为 undefined。 */
  percentage: number | undefined,
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
  private dataEdit?: DataEditState;
  private originalStops?: number[][];
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
    const paint = this.session?.paint ?? getGradientPaint(this.component, this.paintKind, this.paintIndex);

    return isValidGradientPaint(paint) ? paint : undefined;
  }

  get selectedStopIndex (): number {
    return this.selected;
  }

  private get selectionInfo (): Pick<GradientSelectionEvent, 'index' | 'percentage'> {
    const stop = this.paint?.gradientStops.stops[this.selected];

    return { index: this.selected, percentage: stop ? stop.time * 100 : undefined };
  }

  /** 属性面板与画布共用色标选择；拖动中的目标保持不变。 */
  selectStop (index: number): void {
    if (!this.session && Number.isInteger(index) && this.paint?.gradientStops.stops[index]) {
      const previous = this.selectionInfo;

      this.selected = index;
      this.notifySelectionChange(previous);
    }
  }

  override requiresDragThreshold (): boolean {
    return false;
  }

  override onUpdate (): void {
    const selected = this._owner.getSelection().getSelectedPlayerItems();

    if (selected.length !== 1
      || selected[0] !== this.item
      || !isValidGradientPaint(getGradientPaint(this.component, this.paintKind, this.paintIndex))) {
      this.cancelInteraction();
      const previous = this.selectionInfo;

      this.selected = -1;
      this.notifySelectionChange(previous);
      this.exit();
    }
  }

  private toView (uv: Vector2): Vector2 {
    const bounds = getShapeRenderBounds(this.component)!;

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
    const bounds = getShapeRenderBounds(this.component);

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
    const uv = this.stopUV(paint, ratio);
    const base = this.toView(uv);
    const start = this.toView(paint.startPoint);
    let normal: Vector2;

    if (paint.type === spec.FillType.GradientAngular) {
      const radial = uv.clone().subtract(paint.startPoint);
      // UV 圆经过投影后可能是椭圆；先投影切线，再求屏幕法线，不能直接使用半径方向。
      const tangent = this.toView(uv.clone().add(new Vector2(-radial.y, radial.x))).subtract(base);

      normal = new Vector2(-tangent.y, tangent.x).normalize();
      if (normal.dot(base.clone().subtract(start)) < 0) {
        normal.multiply(-1);
      }
    } else {
      const direction = this.toView(paint.endPoint).subtract(start);

      normal = new Vector2(-direction.y, direction.x).normalize();
    }

    return { base, normal, center: base.clone().add(normal.clone().multiply(this.config.stopOffset)) };
  }

  private hit (view: Vector2, paint: GradientPaint): Hit | undefined {
    if (!getShapeRenderBounds(this.component)) {
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
    let ratio = this.ratio(paint, view);

    if (ratio === undefined) {
      return;
    }
    // 色标轨道的偏移定义在屏幕空间；先投回渐变轴，再计算 UV 比例。
    // 角度渐变的法向随比例变化，迭代使比例与对应轨道中心一致。
    for (let i = 0; i < 8; i++) {
      const { normal } = this.stopView(paint, ratio);
      const next = this.ratio(paint, view.clone().subtract(normal.multiply(config.stopOffset)));

      if (next === undefined) {
        return;
      }
      const settled = Math.abs(next - ratio) < 1e-8;

      ratio = next;
      if (settled || paint.type !== spec.FillType.GradientAngular) {
        break;
      }
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
    const previous = this.selectionInfo;

    event.accept();
    if (!hit) {
      this.preview = undefined;
      this.selected = -1;
      this.notifySelectionChange(previous);

      return;
    }
    const original = getGradientPaint(this.component, this.paintKind, this.paintIndex)!;
    const selected = this.selected;

    this.beginDataEdit();
    if (hit.type === 'add' && this.hasAnimatedStops()) {
      this.dataEdit = undefined;

      return;
    }
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
    if (hit.type === 'stop') {
      this.selected = paint.gradientStops.stops.indexOf(hit.stop);
    }
    this.session = {
      component: this.component, hit, start: event.position.clone(), original, paint, selected,
      stopView: hit.type === 'stop' ? this.toView(this.stopUV(paint, hit.stop.time)) : undefined,
    };

    this.emit('actionstart');
    this.write(previous);
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    const session = this.session;

    if (!session) {
      return;
    }
    const previous = this.selectionInfo;
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
      const press = this.toUV(start);

      if (!point || !press) {
        return;
      }
      const direction = point.subtract(original.startPoint);
      const initial = press.subtract(original.startPoint);

      if (direction.length() < 1e-6 || initial.length() < 1e-6) {
        return;
      }
      const angle = Math.atan2(direction.y, direction.x) - Math.atan2(initial.y, initial.x);
      const axis = original.endPoint.clone().subtract(original.startPoint);

      paint.endPoint = original.startPoint.clone().add(new Vector2(
        axis.x * Math.cos(angle) - axis.y * Math.sin(angle),
        axis.x * Math.sin(angle) + axis.y * Math.cos(angle),
      ));
    } else if (hit.type === 'stop') {
      const ratio = this.ratio(paint, session.stopView!.clone().add(delta));

      if (ratio === undefined
        || paint.gradientStops.stops.some(stop =>
          stop !== hit.stop
          && Math.abs(stop.time - ratio) < 1e-6)) {
        return;
      }
      if (this.hasAnimatedStops()) {
        const stops = paint.gradientStops.stops, index = stops.indexOf(hit.stop);

        if (index > 0 && ratio <= stops[index - 1].time || index + 1 < stops.length && ratio >= stops[index + 1].time) { return; }
      }
      hit.stop.time = ratio;
      paint.gradientStops.stops.sort((a, b) => a.time - b.time);
      this.selected = paint.gradientStops.stops.indexOf(hit.stop);
    }
    this.write(previous);
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.session) {
      return;
    }
    if (event.isCanceled()) {
      this.cancelInteraction();
    } else {
      this.session = undefined;
      this.emit('actioncommit');
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
    const previous = this.selectionInfo;

    this.beginDataEdit();
    if (this.hasAnimatedStops()) {
      this.dataEdit = undefined;

      return;
    }
    this.emit('actionstart');
    paint.gradientStops.stops.splice(this.selected, 1);
    this.selected = -1;
    setGradientPaint(this.component, this.paintKind, this.paintIndex, paint);
    this.emit('actionupdate');
    this.emit('actioncommit');
    this.notifySelectionChange(previous);
  }

  override dispose (): void {
    this.onDispose?.();
    this.cancelInteraction();
    const previous = this.selectionInfo;

    this.selected = -1;
    this.notifySelectionChange(previous);
  }

  /** 供所属内容编辑模式退出时回滚；不释放指针捕获或资源。 */
  cancelInteraction (): void {
    const session = this.session;

    if (!session) {
      return;
    }
    const previous = this.selectionInfo;

    this.session = undefined;
    this.preview = undefined;
    this.selected = session.selected;
    setGradientPaint(session.component, this.paintKind, this.paintIndex, session.original);
    this.emit('actionupdate', true);
    this.notifySelectionChange(previous);
  }

  private write (previous: Pick<GradientSelectionEvent, 'index' | 'percentage'>): void {
    setGradientPaint(this.component, this.paintKind, this.paintIndex, this.session!.paint);
    this.emit('actionupdate');
    this.notifySelectionChange(previous);
  }

  private notifySelectionChange (previous: Pick<GradientSelectionEvent, 'index' | 'percentage'>): void {
    const { index, percentage } = this.selectionInfo;

    if (index === previous.index && percentage === previous.percentage) {
      return;
    }
    this._owner.emit('gradientselectionchange', {
      source: this,
      editType: 'gradient',
      itemId: this.item.getInstanceId(),
      paintKind: this.paintKind,
      paintIndex: this.paintIndex,
      index,
      percentage,
    });
  }

  private beginDataEdit (): void {
    const prefix = `${this.paintKind === 'fill' ? 'fills' : 'strokes'}.${this.paintIndex}`;
    const stops = this.component[this.paintKind === 'fill' ? 'fills' : 'strokes'][this.paintIndex] as GradientPaint;

    this.originalStops = stops.gradientStops.stops.map(stop => [stop.time, ...stop.color.toArray()]);
    this.dataEdit = beginDataEdit([{ item: this.item, target: this.component,
      paths: [prefix + '.startPoint', prefix + '.endPoint',
        ...stops.gradientStops.stops.map((_, i) => `${prefix}.gradientStops.stops.${i}.color`)] }]);
  }

  private hasAnimatedStops (): boolean {
    return !!this.dataEdit?.properties.some(property => property.path.includes('.gradientStops.') && (property.binding || property.blocked));
  }

  private emit (phase: GizmoActionPhase, canceled = false): void {
    const changes = phase === 'actionstart' ? [] : updateDataEdit(this.dataEdit, canceled);
    const paint = getGradientPaint(this.component, this.paintKind, this.paintIndex);
    const stops = paint?.gradientStops.stops.map(stop => [stop.time, ...stop.color.toArray()]);

    if (phase !== 'actionstart' && stops && this.originalStops) {
      changes.push({ kind: 'value', itemId: this.item.getInstanceId(), targetId: this.component.getInstanceId(),
        propertyPath: `${this.paintKind === 'fill' ? 'fills' : 'strokes'}.${this.paintIndex}.gradientStops`,
        before: [spec.ValueType.GRADIENT_COLOR, cloneConfigValue(this.originalStops)], after: [spec.ValueType.GRADIENT_COLOR, stops] });
    }
    if (canceled || phase === 'actioncommit') { this.dataEdit = undefined; this.originalStops = undefined; }
    const event: GradientActionEvent = {
      changes,
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

    if (!paint || !getShapeRenderBounds(this.component)) {
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
