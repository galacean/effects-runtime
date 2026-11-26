import {
  MouseButton,
  type InputEventKey,
  type InputEventMouseButton,
  type InputEventMouseMotion,
  type VFXItem,
} from '@galacean/effects';
import { FFDComponent } from '@galacean/effects-plugin-ffd';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoOwner } from '../gizmo-owner';
import { Gizmo } from '../gizmo';
import type { GizmoActionEvent, GizmoActionPhase } from '../gizmo-action';
import { GizmoType } from '../gizmo-type';
import { GestureCursorType } from '../cursor';
import type { Matrix4 } from '../math';
import { Vector2, Vector3 } from '../math';
import { toColor } from '../drawing';
import { crystalLatticeConfig } from '../configs/builtin-configs';
import type { CrystalLatticeConfig } from '../configs/types';
import { localToView, snapTranslation, viewToLocal, viewportSize } from './content-edit-utils';

/** FFD 晶格编辑事件。 */
export interface CrystalLatticeActionEvent extends GizmoActionEvent {
  source: CrystalLatticeGizmo,
  editType: 'lattice',
  itemId: string,
}

type SelectionMode = 'replace' | 'toggle' | 'subtract' | 'add';
type Operation = 'move' | 'marquee' | 'select' | 'scale' | 'rotate' | 'nudge';
type Axis = 'x' | 'y';
type Lattice = ReturnType<FFDComponent['getLattice']>;
type Session = {
  kind: Operation, component: FFDComponent, rows: number, columns: number,
  points: Vector3[], min: Vector3, max: Vector3, views: Vector2[], matrix: Matrix4,
  viewProjection?: Matrix4, viewport: Vector2, selection: number[], weights: number[],
  start: Vector2, current: Vector2, center: Vector2, mode: SelectionMode, toggle: number,
  active: boolean, started: boolean, dirty: boolean, radius: number,
  moveStart: Vector2, moveBase: Vector2, delta: Vector2, axis?: Axis, explicitAxis?: Axis, shiftAxis?: Axis,
  scale: number, angle: number, lastAngle: number, shift: boolean,
};

/** 单个 FFD 的点选择和变换；使用现有输入生命周期和局部回滚快照。 */
export class CrystalLatticeGizmo extends Gizmo {
  readonly type = GizmoType.CRYSTAL_LATTICE;
  readonly selected = new Set<number>();
  private hover = -1;
  private session?: Session;
  private readonly heldKeys = new Set<string>();
  private canceledKeys = false;
  private soft = false;
  private radius = 25;
  private pointCount: number;

  constructor (owner: GizmoOwner, readonly item: VFXItem, private readonly exit: () => void = () => { },
    private readonly onDispose?: () => void) {
    super(owner);
    this.pointCount = this.component?.getLattice().points.length ?? 0;
  }

  private get component (): FFDComponent {
    return this.item.getComponent(FFDComponent);
  }

  private get config (): Readonly<CrystalLatticeConfig> {
    return this._owner.getConfigManager().get(crystalLatticeConfig);
  }

  get softSelection (): boolean {
    return this.soft;
  }
  /** 相对于原始局部包围盒对角线的百分比。 */
  get softRadius (): number {
    return this.radius;
  }

  setSoftSelection (enabled: boolean, radius = this.radius): void {
    if (!Number.isFinite(radius) || (this.session && enabled !== this.soft)) {
      return;
    }
    this.soft = enabled;
    this.radius = Math.max(1, Math.min(200, radius));
    if (this.session) {
      this.session.weights = this.weights(this.session.points, this.session);
      if (this.session.active) {
        this.apply();
      }
    }
  }

  override requiresDragThreshold (): boolean {
    return false;
  }

  override onUpdate (): void {
    const items = this._owner.getSelection().getSelectedPlayerItems();
    const data = this.component?.getLattice();

    if (items.length !== 1 || items[0] !== this.item || !data?.enabled) {
      this.cancelInteraction();
      this.exit();
    } else if (this.session && (!this.sameTarget(this.session, data) || !this.sameView(this.session))) {
      this.cancelInteraction();
    }
    const pointCount = data?.points.length ?? 0;

    if (pointCount !== this.pointCount) {
      this.selected.clear();
      this.hover = -1;
      this.pointCount = pointCount;
    }
  }

  private sameView (session: Session): boolean {
    const world = this.item.transform.getWorldMatrix().elements;
    const projection = this.item.composition?.camera.getInverseViewProjectionMatrix();
    const canvas = this.item.engine.canvas;

    return session.matrix.elements.every((value, index) => value === world[index])
      && (session.viewProjection
        ? !!projection
        && session.viewProjection.elements.every((value, index) => value === projection.elements[index])
        : !projection)
      && session.viewport.x === canvas.clientWidth && session.viewport.y === canvas.clientHeight;
  }

  private sameTarget (session: Session, data: Lattice | undefined): boolean {
    return this.component === session.component
      && !!data?.enabled
      && data.rows === session.rows
      && data.columns === session.columns;
  }

  private readSessionLattice (): Lattice | undefined {
    const session = this.session;

    if (!session) {
      return;
    }
    const data = this.component?.getLattice();
    const items = this._owner.getSelection().getSelectedPlayerItems();

    if (items.length !== 1 || items[0] !== this.item || !this.sameTarget(session, data) || !this.sameView(session)) {
      this.cancelInteraction();

      return;
    }

    return data;
  }

  private selectionMode (event: InputEventMouseButton | InputEventMouseMotion): SelectionMode {
    if (event.ctrlPressed || event.metaPressed) {
      return event.shiftPressed ? 'add' : 'subtract';
    }

    return event.shiftPressed || event.altPressed ? 'toggle' : 'replace';
  }

  private hitPoint (views: Vector2[], position: Vector2): number {
    let hit = -1;
    const config = this.config;
    let distance = Math.max(config.pointRadius, config.selectedPointRadius) + config.pointBorderWidth;

    views.forEach((point, index) => {
      const next = point.distance(position);

      if (next < distance) {
        hit = index;
        distance = next;
      }
    });

    return hit;
  }

  private frame (views: Vector2[]) {
    const points = Array.from(this.selected).map(index => views[index]).filter(Boolean);

    if (points.length < 2) {
      return;
    }
    const min = new Vector2(Math.min(...points.map(p => p.x)), Math.min(...points.map(p => p.y)));
    const max = new Vector2(Math.max(...points.map(p => p.x)), Math.max(...points.map(p => p.y)));

    if (max.distance(min) < 1e-6) {
      return;
    }
    const center = min.clone().add(max).multiply(0.5);
    const config = this.config;
    const x = Math.max((max.x - min.x) / 2 + config.framePadding, config.frameMinSize / 2);
    const y = Math.max((max.y - min.y) / 2 + config.framePadding, config.frameMinSize / 2);
    const corners = [new Vector2(center.x - x, center.y - y), new Vector2(center.x + x, center.y - y),
      new Vector2(center.x + x, center.y + y), new Vector2(center.x - x, center.y + y)];

    return { center, corners };
  }

  private hitHandle (views: Vector2[], position: Vector2): 'scale' | 'rotate' | undefined {
    const frame = this.frame(views);

    if (!frame) {
      return;
    }
    const hitSize = this.config.cornerSize / 2 + 3;

    if (position.distance(frame.center) > 1e-4 && frame.corners.some(point => point.distance(position) < hitSize)) {
      return 'scale';
    }
    for (const corner of frame.corners) {
      const x = (position.x - corner.x) * Math.sign(corner.x - frame.center.x);
      const y = (position.y - corner.y) * Math.sign(corner.y - frame.center.y);

      // 与对象变换工具一致：缩放角点外侧的区域用于旋转，框内仍可框选。
      if (x >= 0 && x <= hitSize * 2 && y >= 0 && y <= hitSize * 2) {
        return 'rotate';
      }
    }
  }

  private begin (
    kind: Operation,
    start: Vector2,
    selection = Array.from(this.selected),
    mode: SelectionMode = 'replace',
    toggle = -1,
    data = this.component.getLattice()
  ): void {
    const views = data.points.map(point => localToView(this.item, point));
    const center = this.frame(views)?.center ?? start.clone();

    this.session = {
      kind,
      component: this.component,
      rows: data.rows,
      columns: data.columns,
      points: data.points,
      min: data.min,
      max: data.max,
      views,
      matrix: this.item.transform.getWorldMatrix().clone(),
      viewProjection: this.item.composition?.camera.getInverseViewProjectionMatrix().clone(),
      viewport: viewportSize(this.item),
      selection,
      weights: this.weights(data.points, data),
      start: start.clone(),
      current: start.clone(),
      center,
      mode,
      toggle,
      active: false,
      started: false,
      dirty: false,
      radius: this.radius,
      moveStart: start.clone(),
      moveBase: new Vector2(),
      delta: new Vector2(),
      scale: 1,
      angle: 0,
      lastAngle: Math.atan2(start.y - center.y, start.x - center.x),
      shift: false,
    };
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    if (this.session?.kind === 'nudge') {
      if (!this.readSessionLattice()) {
        return;
      }
      this.finish();
    }
    if (this.session) {
      return;
    }
    const data = this.component?.getLattice();

    if (!data?.enabled) {
      return;
    }
    const views = data.points.map(point => localToView(this.item, point));
    const mode = this.selectionMode(event);
    const handle = mode === 'replace' ? this.hitHandle(views, event.position) : undefined;
    const hit = this.hitPoint(views, event.position);
    const selection = Array.from(this.selected);
    let toggle = -1;

    if (!handle) {
      if (hit < 0) {
        if (mode === 'replace') {
          this.selected.clear();
        }
      } else if (mode === 'subtract') {
        this.selected.delete(hit);
      } else if (mode === 'toggle' && this.selected.has(hit)) {
        toggle = hit; // 点击时取消；越过拖动阈值则保留整组。
      } else {
        if (mode === 'replace' && !this.selected.has(hit)) {
          this.selected.clear();
        }
        this.selected.add(hit);
      }
    }
    this.begin(
      handle ?? (hit < 0
        ? 'marquee'
        : mode === 'subtract'
          ? 'select'
          : 'move'),
      event.position,
      selection,
      mode,
      toggle,
      data
    );
    event.accept();
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    const views = this.component?.getLattice().points.map(point => localToView(this.item, point)) ?? [];

    this.hover = this.hitPoint(views, event.position);
    this.cursor(this.selectionMode(event) === 'replace' ? this.hitHandle(views, event.position) : undefined);
    event.accept();
  }

  override onMouseLeave (): void {
    this.hover = -1;
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    const session = this.session;

    if (!session || session.kind === 'nudge') {
      return;
    }
    event.accept();
    session.current.copyFrom(event.position);
    const data = this.readSessionLattice();

    if (!data) {
      return;
    }
    if (session.kind === 'select') {
      return;
    }
    const first = !session.active;

    if (first && session.current.distance(session.start) < 3) {
      return;
    }
    session.active = true;
    session.toggle = -1;
    session.shift = event.shiftPressed;
    if (session.kind === 'marquee') {
      this.selected.clear();
      if (session.mode !== 'replace') {
        session.selection.forEach(index => this.selected.add(index));
      }
      session.views.forEach((point, index) => {
        if (point.x >= Math.min(session.start.x, event.position.x) - 1e-6
          && point.x <= Math.max(session.start.x, event.position.x) + 1e-6
          && point.y >= Math.min(session.start.y, event.position.y) - 1e-6
          && point.y <= Math.max(session.start.y, event.position.y) + 1e-6) {
          if (session.mode === 'subtract') {
            this.selected.delete(index);
          } else {
            this.selected.add(index);
          }
        }
      });
    } else if (session.kind === 'move') {
      const total = event.position.clone().subtract(session.moveStart);

      if (!event.shiftPressed) {
        session.shiftAxis = undefined;
      } else {
        session.shiftAxis ??= Math.abs(total.x) >= Math.abs(total.y) ? 'x' : 'y';
      }
      const axis = session.explicitAxis ?? session.shiftAxis;

      if (!first && axis !== session.axis) {
        session.moveBase.copyFrom(session.delta);
        session.moveStart.copyFrom(event.position);
        total.set(0, 0);
      }
      session.axis = axis;
      if (axis === 'x') {
        total.y = 0;
      }
      if (axis === 'y') {
        total.x = 0;
      }
      let delta = total.add(session.moveBase);

      if (!event.altPressed) {
        const { min, max } = data;
        const targets = session.views.filter((_, index) => session.weights[index] === 0);

        for (const point of [
          min,
          max,
          new Vector3(min.x, max.y, 0),
          new Vector3(max.x, min.y, 0),
          min.clone().add(max).multiply(0.5),
        ]) {
          targets.push(localToView(this.item, point, session.matrix));
        }
        const snapped = snapTranslation(Array.from(this.selected).map(i => session.views[i]), targets, delta);

        if (axis === 'x') {
          snapped.y = delta.y;
        }
        if (axis === 'y') {
          snapped.x = delta.x;
        }
        delta = snapped;
      }
      session.delta.copyFrom(delta);
      this.apply(data);
    } else {
      const initial = session.start.clone().subtract(session.center);
      const current = event.position.clone().subtract(session.center);

      if (session.kind === 'scale') {
        const scale = current.dot(initial) / initial.lengthSquared();

        if (!Number.isFinite(scale)) {
          return;
        }
        session.scale = Math.max(0.01, scale);
      } else if (current.length() >= 3) {
        const angle = Math.atan2(current.y, current.x);

        session.angle += Math.atan2(Math.sin(angle - session.lastAngle), Math.cos(angle - session.lastAngle));
        session.lastAngle = angle;
      }
      this.apply(data);
    }
    this.cursor(session.kind);
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.session || this.session.kind === 'nudge') {
      return;
    }
    if (event.isCanceled()) {
      this.cancelInteraction();
    } else {
      if (this.session.toggle >= 0) {
        this.selected.delete(this.session.toggle);
      }
      this.finish();
    }
    event.accept();
  }

  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();
    const session = this.session;

    if (key === 'escape') {
      if (session) {
        this.cancelInteraction();
      } else if (!event.echo) {
        this.exit();
      }
    } else if (event.ctrlPressed || event.metaPressed || event.altPressed) {
      return;
    } else if (/^arrow(left|right|up|down)$/.test(key)) {
      if ((session
        && session.kind !== 'nudge')
        || !this.selected.size
        || this.canceledKeys
        || (event.echo
          && !session)) {
        return;
      }
      this.heldKeys.add(key);
      if (!session) {
        this.begin('nudge', new Vector2());
      }
      const nudge = this.session!;
      const amount = event.shiftPressed ? 10 : 1;

      nudge.active = true;
      nudge.delta.add(new Vector2(key === 'arrowleft' ? -amount : key === 'arrowright' ? amount : 0,
        key === 'arrowup' ? -amount : key === 'arrowdown' ? amount : 0));
      this.apply();
    } else if ((key === 'x' || key === 'y') && session?.kind === 'move' && session.active) {
      if (!event.echo) {
        session.explicitAxis = session.explicitAxis === key ? undefined : key;
      }
    } else if (key === 'o' && !session) {
      if (!event.echo) {
        this.setSoftSelection(!this.soft);
      }
    } else if (this.soft
      && (event.physicalKeycode === 'BracketLeft'
        || event.physicalKeycode === 'BracketRight'
        || key === '['
        || key === ']')) {
      const decrease = event.physicalKeycode === 'BracketLeft' || key === '[';

      this.setSoftSelection(true, this.radius * (decrease ? 1 / 1.1 : 1.1));
    } else {
      return;
    }
    event.accept();
  }

  override onKeyUp (event: InputEventKey): void {
    if (!this.heldKeys.delete(event.keycode.toLowerCase())) {
      return;
    }
    if (!this.heldKeys.size) {
      if (this.session?.kind === 'nudge') {
        this.finish();
      }
      this.canceledKeys = false;
    }
    event.accept();
  }

  private influenceRadius ({ min, max }: Pick<Lattice, 'min' | 'max'>): number {
    return Math.hypot(max.x - min.x, max.y - min.y) * this.radius / 100;
  }

  private weights (points: Vector3[], bounds: Pick<Lattice, 'min' | 'max'>): number[] {
    const seeds = Array.from(this.selected).map(index => points[index]).filter(Boolean);
    const radius = this.influenceRadius(bounds);

    return points.map((point, index) => {
      if (this.selected.has(index)) {
        return 1;
      }
      if (!this.soft || !seeds.length || radius <= 0) {
        return 0;
      }
      const distance = Math.min(...seeds.map(seed => Math.hypot(point.x - seed.x, point.y - seed.y)));
      const t = Math.min(1, distance / radius);

      return 1 - 3 * t * t + 2 * t * t * t;
    });
  }

  private rotation (session: Session): number {
    const step = Math.PI / 12;

    return session.shift ? Math.round(session.angle / step) * step : session.angle;
  }

  private apply (data = this.readSessionLattice()): void {
    const session = this.session;

    if (!session || !data || session.kind === 'marquee' || session.kind === 'select') {
      return;
    }
    const angle = this.rotation(session);
    // 未受影响的点沿用快照引用，批量写入接口会复制点集。
    const points = session.points.slice();

    for (let i = 0; i < points.length; i++) {
      const weight = session.weights[i];

      if (weight === 0) {
        continue;
      }
      const start = session.views[i];
      let target = start.clone().add(session.delta);

      if (session.kind === 'scale' || session.kind === 'rotate') {
        const offset = start.clone().subtract(session.center);

        target = session.center.clone().add(new Vector2(
          session.scale * (offset.x * Math.cos(angle) - offset.y * Math.sin(angle)),
          session.scale * (offset.x * Math.sin(angle) + offset.y * Math.cos(angle))));
      }
      const point = viewToLocal(
        this.item,
        target.subtract(start).multiply(weight).add(start),
        points[i].z,
        session.matrix
      );

      if (!point) {
        return;
      }
      point.z = points[i].z;
      points[i] = point;
    }
    const changed = (a: Vector3[], b: Vector3[]) => a.some((point, i) => point.distance(b[i]) > 1e-8);

    if (!changed(points, data.points)) {
      return;
    }
    if (!session.started) {
      session.started = true;
      this.emit('actionstart');
      // 同步监听者可以替换组件、拓扑或视图，旧点集不能继续写入新目标。
      if (this.session !== session || !this.readSessionLattice()) {
        return;
      }
    }
    this.component.setControlPoints(points);
    session.dirty = changed(points, session.points);
    this.emit('actionupdate');
  }

  private finish (): void {
    const session = this.session;

    this.session = undefined;
    if (session?.started) {
      this.emit(session.dirty ? 'actioncommit' : 'actionupdate', !session.dirty);
    }
    this.cursor();
  }

  override dispose (): void {
    this.onDispose?.();
    this.cancelInteraction();
    this.heldKeys.clear();
  }

  /** 供所属内容编辑模式退出时回滚；不释放指针捕获或资源。 */
  cancelInteraction (): void {
    const session = this.session;

    if (!session) {
      return;
    }
    this.session = undefined;
    this.radius = session.radius;
    this.canceledKeys = this.heldKeys.size > 0;
    this.selected.clear();
    const sameTarget = this.sameTarget(session, this.component?.getLattice());

    if (sameTarget) {
      session.selection.forEach(index => this.selected.add(index));
    }
    if (session.started) {
      if (sameTarget) {
        session.component.setControlPoints(session.points);
      }
      this.emit('actionupdate', true);
    }
    this.cursor();
  }

  private cursor (kind?: Operation): void {
    const axis = this.session?.axis;
    const type = kind === 'scale' ? GestureCursorType.SCALE : kind === 'rotate' ? GestureCursorType.ROTATION
      : axis === 'x' ? GestureCursorType.HORIZONTAL_ARROW : axis === 'y'
        ? GestureCursorType.VERTICAL_ARROW
        : kind === 'move'
          ? GestureCursorType.ACTIVE_HAND
          : this.hover >= 0
            ? GestureCursorType.HAND
            : GestureCursorType.BOX_SELECT;

    this._owner.setCursor({ type, angle: 0 });
  }

  private emit (phase: GizmoActionPhase, canceled = false): void {
    const event: CrystalLatticeActionEvent = {
      source: this,
      editType: 'lattice',
      itemId: this.item.getInstanceId(),
      canceled,
    };

    this._owner.emit(phase, event);
  }

  override draw (control: Control): void {
    const data = this.component?.getLattice();

    if (!data?.enabled) {
      return;
    }
    const views = data.points.map(point => localToView(this.item, point));
    const session = this.session;
    const weights = session
      && session.kind !== 'marquee'
      && session.kind !== 'select'
      ? session.weights
      : this.weights(data.points, data);
    const config = this.config;
    const edge = (a: number, b: number, boundary: boolean): void => {
      const selected = this.selected.has(a) && this.selected.has(b);

      control.drawLine(
        views[a].x,
        views[a].y,
        views[b].x,
        views[b].y,
        toColor(selected ? config.selectedLineColor : boundary ? config.boundaryLineColor : config.lineColor),
        selected ? config.selectedLineWidth : boundary ? config.boundaryLineWidth : config.lineWidth,
      );
    };

    for (let row = 0; row < data.rows; row++) {
      for (let column = 0; column < data.columns; column++) {
        const index = row * data.columns + column;

        if (row + 1 < data.rows) {
          edge(index, index + data.columns, column === 0 || column === data.columns - 1);
        }
        if (column + 1 < data.columns) {
          edge(index, index + 1, row === 0 || row === data.rows - 1);
        }
      }
    }
    views.forEach((point, index) => {
      const selected = this.selected.has(index);
      const radius = selected ? config.selectedPointRadius : config.pointRadius;
      const fill = selected ? config.selectedPointFillColor
        : weights[index] > 0 ? config.softPointFillColor : config.pointFillColor;

      control.fillCircle(point.x, point.y, radius + config.pointBorderWidth, toColor(config.pointBorderColor));
      control.fillCircle(point.x, point.y, radius, toColor(fill));
      if (index === this.hover) {
        control.drawCircle(
          point.x, point.y, config.hoverRingRadius, toColor(config.hoverRingOutlineColor), config.hoverRingOutlineWidth,
        );
        control.drawCircle(
          point.x, point.y, config.hoverRingRadius, toColor(config.hoverRingColor), config.hoverRingWidth,
        );
      }
    });
    const frame = this.frame(views);

    if (frame) {
      const [min, max] = [frame.corners[0], frame.corners[2]];
      const center = session?.center ?? frame.center;
      const size = config.cornerSize;
      const halfCenter = config.centerSize / 2;

      control.drawRect(
        min.x, min.y, max.x - min.x, max.y - min.y, toColor(config.frameLineColor), config.frameLineWidth,
      );
      frame.corners.forEach(point => {
        control.fillRect(point.x - size / 2, point.y - size / 2, size, size, toColor(config.cornerFillColor));
        if (config.cornerLineWidth > 0) {
          control.drawRect(
            point.x - size / 2, point.y - size / 2, size, size, toColor(config.cornerLineColor), config.cornerLineWidth,
          );
        }
      });
      control.drawLine(
        center.x - halfCenter, center.y, center.x + halfCenter, center.y,
        toColor(config.centerLineColor), config.centerLineWidth,
      );
      control.drawLine(
        center.x, center.y - halfCenter, center.x, center.y + halfCenter,
        toColor(config.centerLineColor), config.centerLineWidth,
      );
    }
    if (this.soft && this.selected.size) {
      const index = this.selected.has(this.hover) ? this.hover : Array.from(this.selected)[0];
      const seed = (session?.points ?? data.points)[index];
      const radius = this.influenceRadius(data);
      const outline: number[] = [];

      if (seed) {
        for (let i = 0; i <= 32; i++) {
          const point = localToView(
            this.item,
            new Vector3(
              seed.x + radius * Math.cos(i * Math.PI / 16),
              seed.y + radius * Math.sin(i * Math.PI / 16),
              seed.z
            )
          );

          outline.push(point.x, point.y);
        }
        control.drawPolyline(outline, toColor(config.softRangeLineColor), config.softRangeLineWidth);
      }
    }
    if (session?.kind === 'marquee' && session.active) {
      const { start, current } = session;
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      const fill = toColor(config.marqueeFillColor);

      if (fill.a > 0) {
        control.fillRect(x, y, width, height, fill);
      }
      control.drawRect(x, y, width, height, toColor(config.marqueeLineColor), config.marqueeLineWidth);
    } else if (session?.active) {
      const label = session.kind === 'scale' ? `${Math.round(session.scale * 100)}%`
        : session.kind === 'rotate' ? `${Math.round(this.rotation(session) * 180 / Math.PI)}°`
          : `${session.axis?.toUpperCase() ?? 'XY'}  ${Math.round(session.delta.x)}, ${Math.round(session.delta.y)} px`;
      const metric = control.measureText(label, config.labelFontSize);
      const width = metric.width + config.labelPaddingX * 2;
      const height = metric.inkHeight + config.labelPaddingY * 2;
      const margin = config.labelViewportMargin;
      const x = Math.max(
        margin,
        Math.min(session.current.x + config.labelOffsetX, this.item.engine.canvas.clientWidth - width - margin),
      );
      const y = Math.max(
        margin,
        Math.min(session.current.y + config.labelOffsetY, this.item.engine.canvas.clientHeight - height - margin),
      );

      control.fillRect(x, y, width, height, toColor(config.labelBackgroundColor));
      control.drawText(
        x + config.labelPaddingX, y + config.labelPaddingY - metric.inkTop,
        label, config.labelFontSize, toColor(config.labelTextColor),
      );
    }
  }
}
