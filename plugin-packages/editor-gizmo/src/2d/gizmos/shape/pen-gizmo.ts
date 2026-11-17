import { MouseButton, type InputEventKey, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../../gizmo';
import type { GizmoOwner } from '../../gizmo-owner';
import { penConfig } from '../../configs/builtin-configs';
import type { PenConfig } from '../../configs/types';
import { GestureCursorType } from '../../cursor';
import { Vector2 } from '../../math';
import { toColor } from '../../drawing';
import { cloneGeometry, deletePenPoint, disconnectPenSegment, nextGeometrySession, openClosedShapeAt, penEditOperations, splitPenSegment,
  type GeometryEditKind, type GeometryGizmoHost, type HandleMirrorMode, type PenInteractionState,
  type PenNodeSelection, type PenPathData, type PenToolState, type PathIndex, type PathPoint, type ShapeDrawingActionEvent } from './geometry';

type PenHit = { shape: number, index: number, part: 'point' | 'in' | 'out' | 'segment', t?: number };

/** Shared pen interaction. Hosts own coordinates, document writes and history. */
export class PenGizmo extends Gizmo {
  readonly type = 'pen';
  private path: PenPathData = this.emptyPath();
  private drawing = false;
  private interactionState: PenInteractionState = 'idle';
  private target?: string;
  private targetKind?: GeometryEditKind;
  private targetRevision?: number;
  private selected?: PenHit;
  private readonly selectedNodes = new Set<string>();
  private dragging?: PenHit;
  private beforeDrag?: PenPathData;
  private dragPath?: PenPathData;
  private dragOrigin?: Vector2;
  private beforeDrawing?: PenPathData;
  private hover?: PenHit;
  private hoverPosition?: Vector2;
  private undoDraft: PenPathData[] = [];
  private redoDraft: PenPathData[] = [];
  private activeShape = 0;
  private sessionId = 0;
  private context?: unknown;
  private independentHandleEdit = false;
  private mirrorMode: HandleMirrorMode = 'angle-length';
  private lassoMode = false;
  private lassoing = false;
  private lassoPoints: Vector2[] = [];
  private lassoAdditive = false;
  private prependDrawing = false;

  constructor (
    owner: GizmoOwner,
    private readonly host: GeometryGizmoHost,
    private readonly interactionMode: PenToolState = 'create',
    private readonly onEscape?: (state: PenToolState) => void,
    private readonly preserveTarget = false,
  ) { super(owner); }

  /** 当前钢笔辅助显示配置。 */
  private get config (): Readonly<PenConfig> {
    return this._owner.getConfigManager().get(penConfig);
  }

  get selectedInfo (): { shape: number, point: number } | undefined {
    return this.selected?.part !== 'segment' && this.selected
      ? { shape: this.selected.shape, point: this.selected.index } : undefined;
  }

  get selectedPointsInfo (): PenNodeSelection[] {
    return Array.from(this.selectedNodes).map(key => this.parseNodeKey(key)).filter((value): value is PenNodeSelection => !!value);
  }

  get handleMirrorMode (): HandleMirrorMode { return this.mirrorMode; }

  setHandleMirrorMode (mode: HandleMirrorMode): void { this.mirrorMode = mode; }

  setLassoMode (enabled: boolean): void {
    this.lassoMode = enabled;
    if (!enabled) {
      this.lassoing = false;
      this.lassoPoints = [];
      this.lassoAdditive = false;
    }
  }

  setSelectedPoint (selection?: { shape: number, point: number }): void {
    this.setSelectedPoints(selection ? [selection] : []);
  }

  setSelectedPoints (selection: PenNodeSelection[] = []): void {
    this.refreshTarget();
    this.selectedNodes.clear();
    for (const node of selection) {
      if (this.path.shapes[node.shape]?.indexes[node.point]) {
        this.selectedNodes.add(this.nodeKey(node.shape, node.point));
      }
    }
    const first = selection[0];

    this.selected = first && this.path.shapes[first.shape]?.indexes[first.point]
      ? { shape: first.shape, index: first.point, part: 'point' } : undefined;
  }

  override onUpdate (): void {
    if (!this.valid()) {
      this.onCancel('context');

      return;
    }
    this.refreshTarget();
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (!this.valid()) {
      this.onCancel('context');

      return;
    }
    if (event.buttonIndex === MouseButton.Right) {
      event.accept(); this.finish(false);

      return;
    }
    if (event.buttonIndex !== MouseButton.Left) { return; }
    this.refreshTarget();
    if (!this.host.canEdit(this.target)) { return; }
    event.accept();
    const starting = !this.drawing;

    if (!this.drawing && this.lassoMode && this.target) {
      this.interactionState = 'editing';
      this.lassoing = true;
      this.lassoAdditive = event.shiftPressed;
      this.lassoPoints = [event.position.clone()];
      this._owner.setCursor({ type: GestureCursorType.BOX_SELECT, angle: 0 });

      return;
    }

    if (this.drawing) {
      this.interactionState = 'drawing';
      const indexes = this.path.shapes[this.activeShape]?.indexes ?? [];
      const first = this.path.points[indexes[0]?.point];
      const last = this.path.points[indexes[indexes.length - 1]?.point];
      const closePoint = this.prependDrawing ? last : first;
      const currentPoint = this.prependDrawing ? first : last;

      if (indexes.length >= 3 && closePoint && this.toView(closePoint).distance(event.position) <= this.config.hitDistance) {
        this.finish(true);

        return;
      }
      const atCurrent = currentPoint && this.toView(currentPoint).distance(event.position) <= this.config.hitDistance;

      if (indexes.length >= 2 && event.doubleClick && atCurrent) {
        this.finish(false);

        return;
      }
      if (indexes.length >= 2 && atCurrent) { return; }
    }
    let hit = this.drawing ? undefined : this.hitTest(event.position);

    if (this.interactionMode === 'edit' && !hit) {
      this.selected = undefined;
      this.selectedNodes.clear();
      this.hover = undefined;
      this.hoverPosition = undefined;
      this.interactionState = 'idle';
      this._owner.getSnapManager().clearSnappingVisualizations();

      return;
    }
    if (this.interactionMode === 'create' && this.preserveTarget && !this.drawing && this.target) {
      const selectedStart = this.selected?.part === 'point' ? { ...this.selected } : undefined;

      if (selectedStart && this.canCloseExistingShape(selectedStart, hit)) {
        this.closeExistingShape(selectedStart.shape);

        return;
      }
      if (selectedStart && hit?.part === 'point' && this.isCreateEndpoint(hit)
        && (hit.shape !== selectedStart.shape || hit.index !== selectedStart.index)) {
        this.selectCreatePoint(hit);

        return;
      }
      if (!selectedStart && hit?.part === 'point' && this.isCreateEndpoint(hit)) {
        this.selectCreatePoint(hit);

        return;
      }
      if (selectedStart && this.beginDrawingFromExistingPoint(selectedStart)) {
        if (hit?.part === 'point' && hit.shape === selectedStart.shape && hit.index === selectedStart.index) {
          this.emit('start');

          return;
        }
        hit = undefined;
      } else if (hit?.part === 'point' && this.beginDrawingFromExistingPoint(hit)) {
        this.emit('start');

        return;
      }
    }
    if (hit?.part === 'segment') {
      const center = this.segmentPoint(this.path, hit.shape, hit.index, 0.5);

      if (center && this.toView(center).distance(event.position) <= this.config.hitDistance) {
        this.interactionState = 'editing';
        this.insertSegmentPoint(hit);

        return;
      }
      this.selectSegment(hit);
      this.interactionState = 'editing';
      this.beforeDrag = cloneGeometry(this.path);
      this.dragPath = this.beforeDrag;
      this.dragOrigin = this.toLocal(event.position)?.clone();
      this.dragging = hit;
      this.beginSession();
      this.emit('start');

      return;
    }
    if (hit) {
      if (hit.part === 'point') {
        const key = this.nodeKey(hit.shape, hit.index);

        if (event.shiftPressed) {
          if (this.selectedNodes.has(key)) {
            this.selectedNodes.delete(key);
          } else {
            this.selectedNodes.add(key);
          }
          if (!this.selectedNodes.size) {
            this.selected = undefined;
          }
        } else if (!this.selectedNodes.has(key)) {
          this.selectedNodes.clear();
          this.selectedNodes.add(key);
        }
      } else {
        const key = this.nodeKey(hit.shape, hit.index);

        if (!this.selectedNodes.has(key)) {
          this.selectedNodes.clear();
          this.selectedNodes.add(key);
        }
      }
      this.selected = hit;
      this.interactionState = 'editing';
      this.hover = hit;
      this.beforeDrag = cloneGeometry(this.path);
      this.dragPath = this.beforeDrag;
      this.beginSession();
      const shape = this.path.shapes[hit.shape];

      if (this.interactionMode === 'create' && event.doubleClick && hit.part === 'point' && !shape.close && (hit.index === 0 || hit.index === shape.indexes.length - 1)) {
        this.beforeDrawing = cloneGeometry(this.path);
        this.drawing = true;
        this.interactionState = 'drawing';
        this.activeShape = hit.shape;
        this.prependDrawing = hit.index === 0;
        this.selected = { ...hit, index: this.prependDrawing ? 0 : shape.indexes.length - 1 };
        this.selectedNodes.clear();
        this.selectedNodes.add(this.nodeKey(this.selected.shape, this.selected.index));
        this.dragging = undefined;
      } else {
        this.dragging = hit;
        this.independentHandleEdit = hit.part !== 'point' && event.altPressed;
      }
    } else {
      if (!this.drawing) {
        this.beforeDrawing = this.target && (this.preserveTarget || this.host.appendSubpaths !== false) ? cloneGeometry(this.path) : undefined;
        if (this.beforeDrawing) {
          this.activeShape = this.path.shapes.length;
          this.path.shapes.push({ close: false, indexes: [] });
        } else {
          this.path = this.emptyPath(); this.target = undefined; this.activeShape = 0;
        }
        this.prependDrawing = false;
        this.drawing = true; this.undoDraft = []; this.redoDraft = [];
        this.interactionState = 'drawing';
        this.beginSession();
      }
      const point = this.toLocal(this.snapPoint(event.position));

      if (!point) { return; }
      this.beforeDrag = cloneGeometry(this.path);
      this.dragPath = this.beforeDrag;
      this.undoDraft.push(this.beforeDrag); this.redoDraft = [];
      const index = this.path.points.push({ x: point.x, y: point.y }) - 1;
      const easingIn = this.path.easingIns.push({ x: 0, y: 0 }) - 1;
      const easingOut = this.path.easingOuts.push({ x: 0, y: 0 }) - 1;

      const pathIndex = { point: index, easingIn, easingOut };
      const shapeIndexes = this.path.shapes[this.activeShape].indexes;

      if (this.prependDrawing) {
        shapeIndexes.unshift(pathIndex);
      } else {
        shapeIndexes.push(pathIndex);
      }
      const selectedIndex = this.prependDrawing ? 0 : shapeIndexes.length - 1;

      this.selected = { shape: this.activeShape, index: selectedIndex, part: 'point' };
      this.selectedNodes.clear();
      this.selectedNodes.add(this.nodeKey(this.selected.shape, this.selected.index));
      this.dragging = { ...this.selected, part: 'out' };
    }
    this.emit(starting ? 'start' : 'update');
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.onUpdate();
    if (this.lassoing) {
      this.appendLassoPoint(event.position);

      return;
    }
    this.hoverPosition = this.interactionMode === 'create' && (this.drawing || !this.target)
      ? this.snapPoint(event.position) : undefined;
    this.hover = this.hitTest(event.position);
    if (!this.drawing && this.target) { this._owner.getSnapManager().clearSnappingVisualizations(); }
    this._owner.setCursor({ type: this.hover ? GestureCursorType.POINTER : GestureCursorType.BOX_SELECT, angle: 0 });
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.valid()) {
      this.onCancel('context');

      return;
    }
    if (this.lassoing) {
      this.appendLassoPoint(event.position);
      event.accept();

      return;
    }
    const hit = this.dragging;

    if (!hit || this.interactionState === 'idle') { return; }
    this._owner.getSnapManager().clearSnappingVisualizations();
    const point = this.toLocal(hit.part !== 'point' && event.shiftPressed ? event.position : this.snapPoint(event.position, hit));
    const index = this.path.shapes[hit.shape]?.indexes[hit.index];

    if (!point || !index) { return; }
    if (hit.part === 'point') {
      const before = this.dragPath ?? this.beforeDrag ?? this.path;
      const source = before.shapes[hit.shape]?.indexes[hit.index];
      const sourcePoint = source && before.points[source.point];
      const delta = sourcePoint ? point.clone().subtract(new Vector2(sourcePoint.x, sourcePoint.y)) : new Vector2();
      const nodes = this.selectedPointsInfo.length ? this.selectedPointsInfo : [{ shape: hit.shape, point: hit.index }];

      for (const node of nodes) {
        const currentIndex = this.path.shapes[node.shape]?.indexes[node.point];
        const originalIndex = before.shapes[node.shape]?.indexes[node.point];
        const originalPoint = originalIndex && before.points[originalIndex.point];

        if (currentIndex && originalPoint) {
          this.path.points[currentIndex.point] = { x: originalPoint.x + delta.x, y: originalPoint.y + delta.y };
        }
      }
    } else if (hit.part === 'segment') {
      const before = this.beforeDrag ?? this.path;
      const source = this.segmentPoint(before, hit.shape, hit.index, hit.t ?? 0.5);
      const delta = this.dragOrigin
        ? point.clone().subtract(this.dragOrigin)
        : source ? point.clone().subtract(new Vector2(source.x, source.y)) : new Vector2();
      const segment = this.segmentIndexes(before, hit.shape, hit.index);
      const movedPoints = new Set<number>();

      if (segment) {
        for (const endpoint of [segment.from, segment.to]) {
          if (movedPoints.has(endpoint.point)) { continue; }
          const original = before.points[endpoint.point];

          if (original) {
            this.path.points[endpoint.point] = { x: original.x + delta.x, y: original.y + delta.y };
            movedPoints.add(endpoint.point);
          }
        }
      }
    } else {
      const mirrorMode = this.mirrorMode === 'mirrored' ? 'angle-length' : this.mirrorMode === 'independent' ? 'none' : this.mirrorMode;

      this.independentHandleEdit = event.altPressed || mirrorMode === 'none';
      const anchor = this.path.points[index.point];
      const delta = point.subtract(new Vector2(anchor.x, anchor.y));

      if (event.shiftPressed) {
        const angle = Math.round(Math.atan2(delta.y, delta.x) / (Math.PI / 4)) * Math.PI / 4;
        const length = delta.length();

        delta.set(Math.cos(angle) * length, Math.sin(angle) * length);
      }
      this.detachHandle(hit, hit.part === 'in' ? 'easingIn' : 'easingOut');
      if (!this.independentHandleEdit) { this.detachHandle(hit, hit.part === 'in' ? 'easingOut' : 'easingIn'); }
      const field = hit.part === 'in' ? 'easingIns' : 'easingOuts';
      const opposite = hit.part === 'in' ? 'easingOuts' : 'easingIns';

      this.path[field][hit.part === 'in' ? index.easingIn : index.easingOut] = { x: delta.x, y: delta.y };
      if (!this.independentHandleEdit) {
        const oppositeIndex = hit.part === 'in' ? index.easingOut : index.easingIn;
        const previous = this.beforeDrag?.[opposite]?.[oppositeIndex] ?? { x: 0, y: 0 };
        const length = mirrorMode === 'angle'
          ? (Math.hypot(previous.x, previous.y) || delta.length())
          : delta.length();
        const direction = delta.length() > 0 ? new Vector2(-delta.x / delta.length() * length, -delta.y / delta.length() * length) : new Vector2(-previous.x, -previous.y);

        this.path[opposite][oppositeIndex] = { x: direction.x, y: direction.y };
      }
    }
    event.accept(); this.emit('update');
  }

  override onMouseUp (event: InputEventMouseButton): void {
    this._owner.getSnapManager().reset();
    if (!this.valid() || event.isCanceled()) {
      this.onCancel('pointer'); event.accept();

      return;
    }
    if (this.lassoing) {
      this.finishLasso();
      this.interactionState = 'idle';
      event.accept();

      return;
    }
    if (!this.dragging) { return; }
    this.interactionState = this.drawing ? 'drawing' : 'editing';
    this.dragging = undefined; this.independentHandleEdit = false; event.accept();
    if (!this.drawing) {
      this.emit('commit');
      this.sessionId = 0;
      this.interactionState = 'idle';
    }
    this.dragPath = undefined;
    this.dragOrigin = undefined;
    this.beforeDrag = undefined;
  }

  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (key === 'escape' && this.lassoing) {
      this.setLassoMode(false); event.accept();
    } else if (key === 'escape') {
      event.accept();
      const state = this.interactionMode;

      this.finish(false, this.interactionMode === 'create' ? false : true);
      this.onEscape?.(state);
    } else if (key === 'enter') { event.accept(); this.finish(false); } else if (key === 'q') {
      this.setLassoMode(!this.lassoMode); event.accept();
    } else if (key === 'backspace' || key === 'delete') { event.accept(); this.deleteSelectedPoint(); } else if (key === 'z' && (event.ctrlPressed || event.metaPressed) && this.drawing) {
      event.accept();
      const from = event.shiftPressed ? this.redoDraft : this.undoDraft;
      const to = event.shiftPressed ? this.undoDraft : this.redoDraft;
      const previous = from.pop();

      if (previous) {
        to.push(cloneGeometry(this.path)); this.path = previous; this.dragging = undefined; this.selected = undefined;
        this._owner.getSnapManager().reset(); this.emit('update');
      }
    }
  }

  override onMouseLeave (): void {
    this.hover = undefined;
    this.hoverPosition = undefined;
    if (this.lassoing) { this.appendLassoPoint(this._owner.getMousePosition()); }
    this._owner.getSnapManager().reset();
  }
  onCancel (_reason: string): void {
    if (this.lassoing) { this.setLassoMode(false); }
    this.cancel(false);
  }

  override draw (control: Control): void {
    const config = this.config;
    const pathColor = toColor(config.lineColor);
    const previewColor = toColor(config.previewLineColor);
    const selectedColor = toColor(config.selectedLineColor);
    const hoverColor = toColor(config.hoverLineColor);
    const pointColor = toColor(config.pointColor);
    const selectedPointColor = toColor(config.selectedPointColor);
    const pointLineColor = toColor(config.pointLineColor);
    const hoverPointLineColor = toColor(config.hoverPointLineColor);
    const handleColor = toColor(config.handleColor);
    const selectedHandleColor = toColor(config.selectedHandleColor);
    const handleLineColor = toColor(config.handleLineColor);
    const hoverHandleLineColor = toColor(config.hoverHandleLineColor);
    const activeHandleLineColor = toColor(config.activeHandleLineColor);
    const lassoColor = toColor(config.lassoLineColor);

    for (const [shapeIndex, shape] of this.path.shapes.entries()) {
      shape.indexes.forEach((index, i) => {
        const point = this.path.points[index.point];
        const nextIndex = shape.indexes[i + 1] ?? (shape.close ? shape.indexes[0] : undefined);

        if (point === undefined) {
          return;
        }
        const from = this.toView(point);

        if (nextIndex !== undefined && this.path.points[nextIndex.point] !== undefined) {
          const next = this.path.points[nextIndex.point];
          const out = this.path.easingOuts[index.easingOut] ?? { x: 0, y: 0 };
          const incoming = this.path.easingIns[nextIndex.easingIn] ?? { x: 0, y: 0 };
          const c1 = this.toView({ x: point.x + out.x, y: point.y + out.y });
          const c2 = this.toView({ x: next.x + incoming.x, y: next.y + incoming.y });
          const to = this.toView(next);
          const selectedSegment = this.selected?.part === 'segment'
            && this.selected.shape === shapeIndex && this.selected.index === i;
          const hoveredSegment = this.hover?.part === 'segment'
            && this.hover.shape === shapeIndex && this.hover.index === i;

          control.drawBezier(from.x, from.y, c1.x, c1.y, c2.x, c2.y, to.x, to.y,
            selectedSegment ? selectedColor : hoveredSegment ? hoverColor : pathColor,
            selectedSegment ? config.selectedLineWidth : config.lineWidth);
        } else if (this.drawing && shapeIndex === this.activeShape && this.hoverPosition && !this.dragging) {
          control.drawLine(from.x, from.y, this.hoverPosition.x, this.hoverPosition.y, previewColor, config.previewLineWidth);
        }
        const selectedAnchor = this.selectedNodes.has(this.nodeKey(shapeIndex, i));
        const hoveredAnchor = this.hover?.part === 'point'
          && this.hover.shape === shapeIndex
          && this.hover.index === i;
        const fill = selectedAnchor ? selectedPointColor : pointColor;
        const stroke = hoveredAnchor ? hoverPointLineColor : pointLineColor;
        const radius = config.pointSize / 2;

        control.fillCircle(from.x, from.y, radius, fill);
        control.drawCircle(from.x, from.y, radius, stroke, config.pointLineWidth);
      });
    }
    if (this.hover?.part === 'segment') {
      const center = this.segmentPoint(this.path, this.hover.shape, this.hover.index, 0.5);

      if (center) {
        const point = this.toView(center);

        control.fillCircle(point.x, point.y, config.pointSize / 2, pointColor);
        control.drawCircle(point.x, point.y, config.pointSize / 2, hoverColor, config.hoverLineWidth);
      }
    }
    if (this.lassoing && this.lassoPoints.length > 1) {
      const vertices = this.lassoPoints.flatMap(point => [point.x, point.y]);

      control.drawPolyline(vertices, lassoColor, config.lassoLineWidth);
    }
    for (const node of this.selectedPointsInfo) {
      const selected = this.selected && this.selected.shape === node.shape && this.selected.index === node.point
        ? this.selected
        : { shape: node.shape, index: node.point, part: 'point' as const };
      const index = this.path.shapes[selected.shape]?.indexes[selected.index];
      const anchor = index && this.path.points[index.point];

      if (!index || !anchor) { continue; }
      const from = this.toView(anchor);
      const handles: Array<{ handle: { x: number, y: number } | undefined, part: 'in' | 'out' }> = [
        { handle: this.path.easingIns[index.easingIn], part: 'in' },
        { handle: this.path.easingOuts[index.easingOut], part: 'out' },
      ];

      for (const { handle, part } of handles) {
        if (handle !== undefined) {
          const to = this.toView({ x: anchor.x + handle.x, y: anchor.y + handle.y });
          const isActiveHandle = this.dragging?.shape === selected.shape
            && this.dragging.index === selected.index
            && this.dragging.part === part;
          const isEditingHandle = this.dragging?.shape === selected.shape
            && this.dragging.index === selected.index
            && (this.dragging.part === 'in' || this.dragging.part === 'out')
            && (this.independentHandleEdit ? isActiveHandle : true);
          const isSelectedHandle = this.selected?.shape === selected.shape
            && this.selected.index === selected.index
            && this.selected.part === part;
          const isHoveredHandle = this.hover?.shape === selected.shape
            && this.hover.index === selected.index
            && this.hover.part === part;
          const fill = isSelectedHandle ? selectedHandleColor : handleColor;
          const stroke = isHoveredHandle ? hoverHandleLineColor : handleLineColor;

          control.drawLine(from.x, from.y, to.x, to.y, isEditingHandle ? activeHandleLineColor : handleLineColor,
            isEditingHandle ? config.activeHandleLineWidth : config.handleLineWidth);
          control.fillCircle(to.x, to.y, config.controlPointSize / 2, fill);
          control.drawCircle(to.x, to.y, config.controlPointSize / 2, stroke, config.controlPointLineWidth);
        }
      }
    }
  }

  override dispose (): void {
    this._owner.getSnapManager().reset(); this.path = this.emptyPath();
    this.drawing = false; this.interactionState = 'idle'; this.target = undefined; this.targetKind = undefined; this.targetRevision = undefined;
    this.selected = undefined; this.selectedNodes.clear(); this.dragging = undefined; this.dragPath = undefined; this.dragOrigin = undefined; this.beforeDrag = undefined; this.beforeDrawing = undefined;
    this.hover = undefined; this.hoverPosition = undefined; this.undoDraft = []; this.redoDraft = []; this.activeShape = 0; this.sessionId = 0;
    this.independentHandleEdit = false; this.lassoing = false; this.lassoPoints = []; this.lassoAdditive = false; this.prependDrawing = false;
  }

  private refreshTarget (): void {
    if (this.drawing || this.dragging) { return; }
    if (this.interactionMode === 'create' && !this.preserveTarget) {
      if (this.target) { this.dispose(); }

      return;
    }
    const target = this.host.readPath();

    if (!target) {
      if (this.target) { this.dispose(); }

      return;
    }
    if (target.itemId !== this.target || target.revision !== this.targetRevision) {
      const sameTarget = target.itemId === this.target;
      const previousSelected = sameTarget && this.selected ? { ...this.selected } : undefined;
      const previousNodes = sameTarget ? this.selectedPointsInfo : [];

      this.target = target.itemId; this.targetKind = target.kind; this.targetRevision = target.revision; this.path = cloneGeometry(target.path);
      this.selectedNodes.clear();
      previousNodes.forEach(node => {
        if (this.path.shapes[node.shape]?.indexes[node.point]) {
          this.selectedNodes.add(this.nodeKey(node.shape, node.point));
        }
      });

      if (previousSelected
        && this.path.shapes[previousSelected.shape]?.indexes[previousSelected.index]) {
        this.selected = previousSelected;
      } else {
        const first = this.selectedPointsInfo[0];

        this.selected = first ? { shape: first.shape, index: first.point, part: 'point' } : undefined;
      }
    }
  }

  private hitTest (point: Vector2): PenHit | undefined {
    const hitDistance = this.config.hitDistance;
    const selected = this.selected;
    const selectedIndex = selected && this.path.shapes[selected.shape]?.indexes[selected.index];

    if (selected && selectedIndex) {
      const anchor = this.path.points[selectedIndex.point];

      for (const part of ['in', 'out'] as const) {
        const handle = part === 'in' ? this.path.easingIns[selectedIndex.easingIn] : this.path.easingOuts[selectedIndex.easingOut];

        if (anchor !== undefined && handle !== undefined && (handle.x !== 0 || handle.y !== 0) && this.toView({ x: anchor.x + handle.x, y: anchor.y + handle.y }).distance(point) <= hitDistance) {
          return { ...selected, part };
        }
      }
    }
    for (let shape = 0; shape < this.path.shapes.length; shape++) {
      const indexes = this.path.shapes[shape].indexes;

      for (let index = 0; index < indexes.length; index++) {
        const anchor = this.path.points[indexes[index].point];

        if (anchor !== undefined && this.toView(anchor).distance(point) <= hitDistance) {
          return { shape, index, part: 'point' };
        }
      }
    }

    if (this.interactionMode === 'edit') {
      const segment = this.hitSegment(point);

      if (segment) {
        return { ...segment, part: 'segment' };
      }
    }

    return undefined;
  }

  private hitSegment (point: Vector2): { shape: number, index: number, t: number } | undefined {
    let nearest = this.config.hitDistance;
    let hit: { shape: number, index: number, t: number } | undefined;

    this.path.shapes.forEach((shape, shapeIndex) => shape.indexes.forEach((_, index) => {
      if (!this.segmentIndexes(this.path, shapeIndex, index)) { return; }
      for (let i = 1; i < 64; i++) {
        const t = i / 64;
        const local = this.segmentPoint(this.path, shapeIndex, index, t);

        if (!local) { continue; }
        const distance = this.toView(local).distance(point);

        if (distance < nearest) { nearest = distance; hit = { shape: shapeIndex, index, t }; }
      }
    }));

    return hit;
  }

  private toLocal (point: Vector2): Vector2 | undefined { return this.host.viewToLocal(point, this.target); }
  private toView (point: { x: number, y: number }): Vector2 { return this.host.localToView(point, this.target); }

  private segmentIndexes (path: PenPathData, shapeIndex: number, segment: number): { from: PathIndex, to: PathIndex } | undefined {
    const shape = path.shapes[shapeIndex];
    const from = shape?.indexes[segment];
    const to = shape?.indexes[segment + 1] ?? (shape?.close ? shape.indexes[0] : undefined);

    return from && to ? { from, to } : undefined;
  }

  private segmentPoint (path: PenPathData, shapeIndex: number, segment: number, t: number): PathPoint | undefined {
    const indexes = this.segmentIndexes(path, shapeIndex, segment);

    if (!indexes) { return undefined; }
    const p0 = path.points[indexes.from.point];
    const p3 = path.points[indexes.to.point];

    if (!p0 || !p3) { return undefined; }
    const out = path.easingOuts[indexes.from.easingOut] ?? { x: 0, y: 0 };
    const incoming = path.easingIns[indexes.to.easingIn] ?? { x: 0, y: 0 };
    const p1 = { x: p0.x + out.x, y: p0.y + out.y };
    const p2 = { x: p3.x + incoming.x, y: p3.y + incoming.y };
    const u = 1 - t;

    return {
      x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
      y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
    };
  }

  private selectSegment (hit: PenHit): void {
    this.selected = hit;
    this.selectedNodes.clear();
    const segment = this.segmentIndexes(this.path, hit.shape, hit.index);

    if (segment) {
      this.selectedNodes.add(this.nodeKey(hit.shape, hit.index));
      const nextIndex = this.path.shapes[hit.shape]?.indexes.indexOf(segment.to);

      if (nextIndex !== undefined && nextIndex >= 0) {
        this.selectedNodes.add(this.nodeKey(hit.shape, nextIndex));
      }
    }
  }

  private beginDrawingFromExistingPoint (hit: PenHit): boolean {
    if (hit.part !== 'point') {
      return false;
    }
    const shape = this.path.shapes[hit.shape];
    const source = this.path.shapes[hit.shape]?.indexes[hit.index];

    if (!source) {
      return false;
    }
    this.beforeDrawing = cloneGeometry(this.path);
    const continueOpenShape = this.isOpenEndpoint(hit.shape, hit.index);

    if (continueOpenShape && shape) {
      this.activeShape = hit.shape;
      this.prependDrawing = hit.index === 0;
    } else {
      this.activeShape = this.path.shapes.length;
      this.path.shapes.push({ close: false, indexes: [{ ...source }] });
      this.prependDrawing = false;
    }
    this.drawing = true;
    this.interactionState = 'drawing';
    this.undoDraft = [];
    this.redoDraft = [];
    this.dragging = undefined;
    this.beforeDrag = undefined;
    this.dragPath = undefined;
    const selectedIndex = continueOpenShape && this.prependDrawing ? 0
      : continueOpenShape ? this.path.shapes[this.activeShape].indexes.length - 1 : 0;

    this.selected = { shape: this.activeShape, index: selectedIndex, part: 'point' };
    this.selectedNodes.clear();
    this.selectedNodes.add(this.nodeKey(this.activeShape, this.selected.index));
    this.beginSession();

    return true;
  }

  private isOpenEndpoint (shapeIndex: number, index: number): boolean {
    const shape = this.path.shapes[shapeIndex];

    return !!shape && !shape.close && shape.indexes.length > 0
      && (index === 0 || index === shape.indexes.length - 1);
  }

  private canCloseExistingShape (selected: PenHit, hit?: PenHit): boolean {
    if (selected.part !== 'point' || hit?.part !== 'point' || selected.shape !== hit.shape) {
      return false;
    }
    const shape = this.path.shapes[selected.shape];
    const last = shape ? shape.indexes.length - 1 : -1;
    const selectedEndpoint = selected.index === 0 || selected.index === last;
    const hitEndpoint = hit ? hit.index === 0 || hit.index === last : false;

    return !!shape && !shape.close && shape.indexes.length >= 3
      && selectedEndpoint && hitEndpoint;
  }

  private isCreateEndpoint (hit: PenHit): boolean {
    if (hit.part !== 'point') {
      return false;
    }
    const shape = this.path.shapes[hit.shape];

    return !!shape && !shape.close && shape.indexes.length >= 3
      && (hit.index === 0 || hit.index === shape.indexes.length - 1);
  }

  private selectCreatePoint (hit: PenHit): void {
    this.selected = { ...hit };
    this.selectedNodes.clear();
    this.selectedNodes.add(this.nodeKey(hit.shape, hit.index));
    this.dragging = undefined;
    this.beforeDrag = undefined;
    this.dragPath = undefined;
    this.interactionState = 'idle';
    this.hover = hit;
  }

  private closeExistingShape (shapeIndex: number): void {
    const shape = this.path.shapes[shapeIndex];

    if (!shape || shape.close || shape.indexes.length < 3) {
      return;
    }
    this.beforeDrawing = undefined;
    this.beforeDrag = cloneGeometry(this.path);
    this.interactionState = 'editing';
    this.beginSession();
    this.emit('start');
    shape.close = true;

    const action = this.action('commit');

    action.finish = false;
    action.continueCreate = true;
    if (action.edit) {
      action.edit.selection = [];
    }
    this.dispose();
    this._owner.emit('actioncommit', action);
  }

  private insertSegmentPoint (hit: PenHit): void {
    this.beforeDrag = cloneGeometry(this.path);
    this.beginSession();
    this.emit('start');
    const index = splitPenSegment(this.path, hit.shape, hit.index, 0.5);

    if (index === undefined) {
      this.cancel(false);

      return;
    }
    this.selected = { shape: hit.shape, index, part: 'point' };
    this.selectedNodes.clear();
    this.selectedNodes.add(this.nodeKey(hit.shape, index));
    this.dragPath = cloneGeometry(this.path);
    this.dragging = { shape: hit.shape, index, part: 'point' };
    this.hover = undefined;
  }

  private snapPoint (point: Vector2, dragging?: PenHit): Vector2 {
    const snap = this._owner.getSnapManager();

    snap.clearSnappingVisualizations();
    if (!snap.enabled) { return point.clone(); }
    const targets = [...(this.host.snapPoints?.(this.target) ?? [])];
    const movingPoint = dragging?.part === 'point' ? this.path.shapes[dragging.shape]?.indexes[dragging.index]?.point : undefined;

    for (const shape of this.path.shapes) {
      for (const index of shape.indexes) {
        const anchor = this.path.points[index.point];

        if (anchor && index.point !== movingPoint) { targets.push(this.toView(anchor)); }
      }
    }
    snap.preparePoint(new Vector2(), point, targets);

    return point.clone().subtract(new Vector2(snap.result.x ?? 0, snap.result.y ?? 0));
  }

  private finish (close: boolean, exitTool = true): void {
    if (!this.valid()) {
      this.cancel(true);

      return;
    }
    const shape = this.path.shapes[this.activeShape];

    if (!this.drawing || !shape || shape.indexes.length < 2) {
      this.cancel(exitTool);

      return;
    }
    shape.close = close;
    const action = this.action('commit');

    action.finish = close ? false : exitTool;
    action.continueCreate = close;
    if (action.edit) {
      action.edit.selection = [];
    }
    this.dispose(); this._owner.emit('actioncommit', action);
  }

  private beginSession (): void { this.sessionId = nextGeometrySession(); this.context = this.host.contextKey?.(); }
  private valid (): boolean {
    if (!this.sessionId) {
      return true;
    }
    if (!this.host.canEdit(this.target) || this.context !== this.host.contextKey?.()) {
      return false;
    }
    if (!this.target) {
      return true;
    }
    const target = this.host.readPath();

    return target?.itemId === this.target && target.revision === this.targetRevision;
  }
  private action (phase: ShapeDrawingActionEvent['phase']): ShapeDrawingActionEvent {
    const action: ShapeDrawingActionEvent = { source: this, sessionId: this.sessionId, phase };

    if (this.target) {
      const before = cloneGeometry(this.beforeDrawing ?? this.beforeDrag ?? this.path);
      const path = cloneGeometry(this.path);

      action.edit = {
        itemId: this.target,
        before,
        path,
        operations: penEditOperations(before, path),
        kind: this.targetKind,
        selection: this.selectedPointsInfo,
      };
      action.finish = false;
    } else { action.create = { kind: 'pen', path: cloneGeometry(this.path) }; }

    return action;
  }
  private emit (phase: 'start' | 'update' | 'commit'): void { this._owner.emit(`action${phase}`, this.action(phase)); }
  private cancel (finish: boolean): void {
    const active = this.sessionId !== 0 || (!!this.target && finish);

    if (!active) {
      return;
    }
    const selected = this.selected && { ...this.selected };
    const selectedNodes = Array.from(this.selectedNodes);
    const target = this.target;
    const targetKind = this.targetKind;
    const targetRevision = this.targetRevision;
    const action = this.action('cancel');

    action.canceled = true; action.finish = finish;
    this.dispose();
    if (selected && target) {
      this.selected = selected;
      selectedNodes.forEach(key => this.selectedNodes.add(key));
      this.target = target;
      this.targetKind = targetKind;
      this.targetRevision = targetRevision;
    }
    this._owner.emit('actioncommit', action);
  }

  private detachHandle (hit: PenHit, field: 'easingIn' | 'easingOut'): void {
    const index = this.path.shapes[hit.shape].indexes[hit.index];
    const shared = this.path.shapes.some(shape => shape.indexes.some(other => other !== index && other[field] === index[field]));

    if (shared) {
      const handles = field === 'easingIn' ? this.path.easingIns : this.path.easingOuts;
      const handle = handles[index[field]] ?? { x: 0, y: 0 };

      index[field] = handles.length;
      handles.push({ ...handle });
    }
  }

  private deleteSelectedPoint (): void {
    if (!this.host.canEdit(this.target) || !this.valid()) {
      this.onCancel('permission');

      return;
    }
    this._owner.getSnapManager().reset();
    if (this.drawing) {
      const previous = this.undoDraft.pop();

      if (previous) { this.redoDraft.push(cloneGeometry(this.path)); this.path = previous; this.emit('update'); }
    } else if (this.selected?.part === 'segment' && this.target) {
      const segment = { ...this.selected };

      this.beforeDrag = cloneGeometry(this.path); this.beginSession(); this.emit('start');
      const disconnected = disconnectPenSegment(this.path, segment.shape, segment.index);

      this.selected = undefined; this.selectedNodes.clear(); this.dragging = undefined;
      if (disconnected) {
        this.emit('commit');
      }
      this.beforeDrag = undefined; this.sessionId = 0; this.interactionState = 'idle';
    } else if (this.selected && this.target) {
      const selected = { ...this.selected };
      let keepSelection = false;

      this.beforeDrag = cloneGeometry(this.path); this.beginSession(); this.emit('start');
      if (this.selected.part === 'point') {
        const shape = this.path.shapes[selected.shape];

        if (shape?.close && openClosedShapeAt(this.path, selected.shape, selected.index)) {
          this.selected = { shape: selected.shape, index: shape.indexes.length - 1, part: 'point' };
          this.selectedNodes.clear();
          this.selectedNodes.add(this.nodeKey(selected.shape, shape.indexes.length - 1));
          keepSelection = true;
        } else {
          const nodes = this.selectedPointsInfo.length ? this.selectedPointsInfo : [{ shape: selected.shape, point: selected.index }];

          nodes.sort((a, b) => b.shape - a.shape || b.point - a.point).forEach(node => {
            deletePenPoint(this.path, node.shape, node.point, this.host.deleteBehavior ?? 'reconnect');
          });
          this.selected = undefined; this.selectedNodes.clear();
        }
      } else {
        const index = this.path.shapes[selected.shape]?.indexes[selected.index];

        if (index) {
          const field = selected.part === 'in' ? 'easingIns' : 'easingOuts';

          this.detachHandle(selected, selected.part === 'in' ? 'easingIn' : 'easingOut');
          const handleIndex = selected.part === 'in' ? index.easingIn : index.easingOut;

          this.path[field][handleIndex] = { x: 0, y: 0 };
        }
        this.selected = { ...selected, part: 'point' };
      }
      this.emit('commit'); this.beforeDrag = undefined; this.sessionId = 0;
      if (!keepSelection) { this.selected = undefined; this.selectedNodes.clear(); }
    }
    this.dragging = undefined;
  }

  private appendLassoPoint (point: Vector2): void {
    const last = this.lassoPoints[this.lassoPoints.length - 1];

    if (!last || last.distance(point) > 2) { this.lassoPoints.push(point.clone()); }
  }

  private finishLasso (): void {
    const polygon = this.lassoPoints;

    if (polygon.length >= 3) {
      const next = this.lassoAdditive ? new Set(this.selectedNodes) : new Set<string>();

      for (let shape = 0; shape < this.path.shapes.length; shape++) {
        for (let index = 0; index < this.path.shapes[shape].indexes.length; index++) {
          const pathIndex = this.path.shapes[shape].indexes[index];
          const point = this.path.points[pathIndex.point];

          if (point && this.pointInPolygon(this.toView(point), polygon)) {
            next.add(this.nodeKey(shape, index));
          }
        }
      }
      this.selectedNodes.clear();
      next.forEach(key => this.selectedNodes.add(key));
      const first = this.selectedPointsInfo[0];

      this.selected = first ? { shape: first.shape, index: first.point, part: 'point' } : undefined;
    }
    this.lassoing = false;
    this.lassoPoints = [];
    this.lassoAdditive = false;
  }

  private pointInPolygon (point: Vector2, polygon: Vector2[]): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      const intersects = (a.y > point.y) !== (b.y > point.y)
        && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x;

      if (intersects) { inside = !inside; }
    }

    return inside;
  }

  private nodeKey (shape: number, index: number): string { return `${shape}:${index}`; }

  private parseNodeKey (key: string): PenNodeSelection | undefined {
    const [shape, point] = key.split(':').map(Number);

    return Number.isFinite(shape) && Number.isFinite(point) ? { shape, point } : undefined;
  }

  private emptyPath (): PenPathData { return { points: [], easingIns: [], easingOuts: [], shapes: [{ close: false, indexes: [] }] }; }
}
