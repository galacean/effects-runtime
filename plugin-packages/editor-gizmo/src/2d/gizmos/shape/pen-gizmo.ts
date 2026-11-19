import { MouseButton, type InputEventKey, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../../gizmo';
import type { GizmoOwner } from '../../gizmo-owner';
import { penConfig } from '../../configs/builtin-configs';
import type { PenConfig } from '../../configs/types';
import { GestureCursorType } from '../../cursor';
import { Vector2 } from '../../math';
import { toColor } from '../../drawing';
import { appendPenHandle, cloneGeometry, deletePenPoint, disconnectPenSegment, hitPenCurve, nextGeometrySession, openClosedShapeAt, penEditOperations, splitPenSegment,
  type GeometryGizmoHost, type HandleMirrorMode,
  type PenNodeSelection, type PenPathData, type PenToolState, type PathIndex, type PathPoint, type ShapeDrawingActionEvent } from './geometry';
import { createPenEditContext, type PenEditContext, type PenHit } from './pen-edit-context';

/** Shared pen interaction. Hosts own coordinates, document writes and history. */
export class PenGizmo extends Gizmo {
  readonly type = 'pen';
  private readonly editContext: PenEditContext;
  private hover?: PenHit;
  private hoverPosition?: Vector2;
  private targetLoaded = false;

  constructor (
    owner: GizmoOwner,
    private readonly host: GeometryGizmoHost,
    private readonly interactionMode: PenToolState = 'create',
    private readonly onEscape?: (state: PenToolState) => void,
    private readonly preserveTarget = false,
    private readonly sharedContext?: PenEditContext,
  ) {
    super(owner);
    this.editContext = sharedContext ?? createPenEditContext();
  }

  /** 当前钢笔辅助显示配置。 */
  private get config (): Readonly<PenConfig> {
    return this._owner.getConfigManager().get(penConfig);
  }

  get selectedInfo (): { shape: number, point: number } | undefined {
    return this.editContext.selected?.part !== 'segment' && this.editContext.selected
      ? { shape: this.editContext.selected.shape, point: this.editContext.selected.index } : undefined;
  }

  get selectedPointsInfo (): PenNodeSelection[] {
    return Array.from(this.editContext.selectedNodes).map(key => this.parseNodeKey(key)).filter((value): value is PenNodeSelection => !!value);
  }

  get handleMirrorMode (): HandleMirrorMode { return this.editContext.mirrorMode; }

  setHandleMirrorMode (mode: HandleMirrorMode): void { this.editContext.mirrorMode = mode; }

  setLassoMode (enabled: boolean): void {
    this.editContext.lassoMode = enabled;
    if (!enabled) {
      this.editContext.lassoing = false;
      this.editContext.lassoPoints = [];
      this.editContext.lassoAdditive = false;
    }
  }

  setSelectedPoint (selection?: { shape: number, point: number }): void {
    this.setSelectedPoints(selection ? [selection] : []);
  }

  setSelectedPoints (selection: PenNodeSelection[] = []): void {
    this.refreshTarget();
    const first = selection[0];

    this.updateSelectedPoints(selection, first ? { shape: first.shape, index: first.point, part: 'point' } : undefined);
  }

  private updateSelectedPoints (selection: PenNodeSelection[], primary?: PenHit): void {
    this.editContext.selectedNodes.clear();
    for (const node of selection) {
      const index = this.editContext.path.shapes[node.shape]?.indexes[node.point];

      if (index && this.editContext.path.points[index.point]) {
        this.editContext.selectedNodes.add(this.nodeKey(node.shape, node.point));
      }
    }
    const first = this.selectedPointsInfo[0];

    this.editContext.selected = primary && this.editContext.selectedNodes.has(this.nodeKey(primary.shape, primary.index))
      ? primary : first ? { shape: first.shape, index: first.point, part: 'point' } : undefined;
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
    if (!this.host.canEdit(this.editContext.target)) { return; }
    event.accept();
    const starting = !this.editContext.drawing;

    if (!this.editContext.drawing && this.editContext.lassoMode && this.editContext.target) {
      this.editContext.interactionState = 'editing';
      this.editContext.lassoing = true;
      this.editContext.lassoAdditive = event.shiftPressed;
      this.editContext.lassoPoints = [event.position.clone()];
      this._owner.setCursor({ type: GestureCursorType.BOX_SELECT, angle: 0 });

      return;
    }

    if (this.editContext.drawing) {
      this.editContext.interactionState = 'drawing';
      const indexes = this.editContext.path.shapes[this.editContext.activeShape]?.indexes ?? [];
      const first = this.editContext.path.points[indexes[0]?.point];
      const last = this.editContext.path.points[indexes[indexes.length - 1]?.point];
      const closePoint = this.editContext.prependDrawing ? last : first;
      const currentPoint = this.editContext.prependDrawing ? first : last;

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
    let hit = this.editContext.drawing ? undefined : this.hitTest(event.position);

    if (this.interactionMode === 'edit' && !hit) {
      this.editContext.selected = undefined;
      this.editContext.selectedNodes.clear();
      this.hover = undefined;
      this.hoverPosition = undefined;
      this.editContext.interactionState = 'idle';
      this._owner.getSnapManager().clearSnappingVisualizations();

      return;
    }
    if (this.interactionMode === 'create' && this.preserveTarget && !this.editContext.drawing && this.editContext.target) {
      const selectedStart = this.getCreationStart();

      if (selectedStart && this.canCloseExistingShape(selectedStart, hit)) {
        this.closeExistingShape(selectedStart.shape);

        return;
      }
      if (hit?.part === 'point' && (!selectedStart || hit.shape !== selectedStart.shape || hit.index !== selectedStart.index)) {
        this.selectCreatePoint(hit);

        return;
      }
      if (selectedStart && (!hit || hit.part === 'point') && this.beginDrawingFromExistingPoint(selectedStart)) {
        if (hit?.part === 'point' && hit.shape === selectedStart.shape && hit.index === selectedStart.index) {
          this.emit('start');

          return;
        }
        hit = undefined;
      }
    }
    if (hit?.part === 'segment') {
      const center = this.segmentPoint(this.editContext.path, hit.shape, hit.index, 0.5);

      if (center && this.toView(center).distance(event.position) <= this.config.hitDistance) {
        this.editContext.interactionState = 'editing';
        this.insertSegmentPoint(hit);

        return;
      }
      this.selectSegment(hit);
      this.editContext.interactionState = 'editing';
      this.editContext.beforeDrag = cloneGeometry(this.editContext.path);
      this.editContext.dragPath = this.editContext.beforeDrag;
      this.editContext.dragOrigin = this.toLocal(event.position)?.clone();
      this.editContext.dragging = hit;
      this.beginSession();
      this.emit('start');

      return;
    }
    if (hit) {
      const key = this.nodeKey(hit.shape, hit.index);

      if (hit.part === 'point' && event.shiftPressed) {
        if (this.editContext.selectedNodes.has(key)) {
          this.editContext.selectedNodes.delete(key);
          const first = this.selectedPointsInfo[0];

          this.editContext.selected = first ? { shape: first.shape, index: first.point, part: 'point' } : undefined;
          this.editContext.dragging = undefined;

          return;
        }
        this.editContext.selectedNodes.add(key);
      } else if (!this.editContext.selectedNodes.has(key)) {
        this.editContext.selectedNodes.clear();
        this.editContext.selectedNodes.add(key);
      }
      this.editContext.selected = hit;
      this.editContext.interactionState = 'editing';
      this.hover = hit;
      this.editContext.beforeDrag = cloneGeometry(this.editContext.path);
      this.editContext.dragPath = this.editContext.beforeDrag;
      this.beginSession();
      this.editContext.dragging = hit;
      this.editContext.independentHandleEdit = hit.part !== 'point' && event.altPressed;
    } else {
      if (!this.editContext.drawing) {
        this.editContext.beforeDrawing = this.editContext.target && (this.preserveTarget || this.host.appendSubpaths !== false) ? cloneGeometry(this.editContext.path) : undefined;
        if (this.editContext.beforeDrawing) {
          this.editContext.activeShape = this.editContext.path.shapes.length;
          this.editContext.path.shapes.push({ close: false, indexes: [] });
        } else {
          this.editContext.path = this.emptyPath(); this.editContext.target = undefined; this.editContext.activeShape = 0;
        }
        this.editContext.prependDrawing = false;
        this.editContext.drawing = true; this.editContext.undoDraft = []; this.editContext.redoDraft = [];
        this.editContext.interactionState = 'drawing';
        this.beginSession();
      }
      const point = this.toLocal(this.snapPoint(event.position));

      if (!point) { return; }
      this.editContext.beforeDrag = cloneGeometry(this.editContext.path);
      this.editContext.dragPath = this.editContext.beforeDrag;
      this.editContext.undoDraft.push(this.editContext.beforeDrag); this.editContext.redoDraft = [];
      const index = this.editContext.path.points.push({ x: point.x, y: point.y }) - 1;
      const easingIn = appendPenHandle(this.editContext.path, 'easingIn', Vector2.ZERO);
      const easingOut = appendPenHandle(this.editContext.path, 'easingOut', Vector2.ZERO);

      const pathIndex = { point: index, easingIn, easingOut };
      const shapeIndexes = this.editContext.path.shapes[this.editContext.activeShape].indexes;

      if (this.editContext.prependDrawing) {
        shapeIndexes.unshift(pathIndex);
      } else {
        shapeIndexes.push(pathIndex);
      }
      const selectedIndex = this.editContext.prependDrawing ? 0 : shapeIndexes.length - 1;

      this.editContext.selected = { shape: this.editContext.activeShape, index: selectedIndex, part: 'point' };
      this.editContext.selectedNodes.clear();
      this.editContext.selectedNodes.add(this.nodeKey(this.editContext.selected.shape, this.editContext.selected.index));
      this.editContext.dragging = { ...this.editContext.selected, part: 'out' };
    }
    this.emit(starting ? 'start' : 'update');
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.onUpdate();
    if (this.editContext.lassoing) {
      this.appendLassoPoint(event.position);

      return;
    }
    this.hoverPosition = this.interactionMode === 'create' && (this.editContext.drawing || !this.editContext.target)
      ? this.snapPoint(event.position) : undefined;
    this.hover = this.hitTest(event.position);
    if (!this.editContext.drawing && this.editContext.target) { this._owner.getSnapManager().clearSnappingVisualizations(); }
    this._owner.setCursor({ type: this.hover ? GestureCursorType.POINTER : GestureCursorType.BOX_SELECT, angle: 0 });
  }

  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.valid()) {
      this.onCancel('context');

      return;
    }
    if (this.editContext.lassoing) {
      this.appendLassoPoint(event.position);
      event.accept();

      return;
    }
    const hit = this.editContext.dragging;

    if (!hit || this.editContext.interactionState === 'idle') { return; }
    this.editContext.independentHandleEdit = (hit.part === 'in' || hit.part === 'out')
      && (event.altPressed || this.editContext.mirrorMode === 'none' || this.editContext.mirrorMode === 'independent');
    this._owner.getSnapManager().clearSnappingVisualizations();
    const point = this.toLocal(hit.part !== 'point' && event.shiftPressed ? event.position : this.snapPoint(event.position, hit));
    const index = this.editContext.path.shapes[hit.shape]?.indexes[hit.index];

    if (!point || !index) { return; }
    if (hit.part === 'point') {
      const before = this.editContext.dragPath ?? this.editContext.beforeDrag ?? this.editContext.path;
      const source = before.shapes[hit.shape]?.indexes[hit.index];
      const sourcePoint = source && before.points[source.point];
      const delta = sourcePoint ? point.clone().subtract(new Vector2(sourcePoint.x, sourcePoint.y)) : new Vector2();
      const nodes = this.selectedPointsInfo;

      if (!nodes.length) { nodes.push({ shape: hit.shape, point: hit.index }); }

      for (const node of nodes) {
        const currentIndex = this.editContext.path.shapes[node.shape]?.indexes[node.point];
        const originalIndex = before.shapes[node.shape]?.indexes[node.point];
        const originalPoint = originalIndex && before.points[originalIndex.point];

        if (currentIndex && originalPoint) {
          this.editContext.path.points[currentIndex.point] = { x: originalPoint.x + delta.x, y: originalPoint.y + delta.y };
        }
      }
    } else if (hit.part === 'segment') {
      const before = this.editContext.beforeDrag ?? this.editContext.path;
      const source = this.segmentPoint(before, hit.shape, hit.index, hit.t ?? 0.5);
      const delta = this.editContext.dragOrigin
        ? point.clone().subtract(this.editContext.dragOrigin)
        : source ? point.clone().subtract(new Vector2(source.x, source.y)) : new Vector2();
      const segment = this.segmentIndexes(before, hit.shape, hit.index);
      const movedPoints = new Set<number>();

      if (segment) {
        for (const endpoint of [segment.from, segment.to]) {
          if (movedPoints.has(endpoint.point)) { continue; }
          const original = before.points[endpoint.point];

          if (original) {
            this.editContext.path.points[endpoint.point] = { x: original.x + delta.x, y: original.y + delta.y };
            movedPoints.add(endpoint.point);
          }
        }
      }
    } else {
      const mirrorMode = this.editContext.mirrorMode === 'mirrored' ? 'angle-length' : this.editContext.mirrorMode === 'independent' ? 'none' : this.editContext.mirrorMode;

      const anchor = this.editContext.path.points[index.point];
      const delta = point.subtract(new Vector2(anchor.x, anchor.y));

      if (event.shiftPressed) {
        const angle = Math.round(Math.atan2(delta.y, delta.x) / (Math.PI / 4)) * Math.PI / 4;
        const length = delta.length();

        delta.set(Math.cos(angle) * length, Math.sin(angle) * length);
      }
      this.detachHandle(hit, hit.part === 'in' ? 'easingIn' : 'easingOut');
      if (!this.editContext.independentHandleEdit) { this.detachHandle(hit, hit.part === 'in' ? 'easingOut' : 'easingIn'); }
      const field = hit.part === 'in' ? 'easingIns' : 'easingOuts';
      const opposite = hit.part === 'in' ? 'easingOuts' : 'easingIns';

      this.editContext.path[field][hit.part === 'in' ? index.easingIn : index.easingOut] = { x: delta.x, y: delta.y };
      if (!this.editContext.independentHandleEdit) {
        const oppositeIndex = hit.part === 'in' ? index.easingOut : index.easingIn;
        const originalIndex = this.editContext.beforeDrag?.shapes[hit.shape]?.indexes[hit.index];
        const originalOpposite = originalIndex && (hit.part === 'in' ? originalIndex.easingOut : originalIndex.easingIn);
        const previous = originalOpposite === undefined ? { x: 0, y: 0 }
          : this.editContext.beforeDrag?.[opposite][originalOpposite] ?? { x: 0, y: 0 };
        const length = mirrorMode === 'angle'
          ? (Math.hypot(previous.x, previous.y) || delta.length())
          : delta.length();
        const direction = delta.length() > 0 ? new Vector2(-delta.x / delta.length() * length, -delta.y / delta.length() * length) : new Vector2(-previous.x, -previous.y);

        this.editContext.path[opposite][oppositeIndex] = { x: direction.x, y: direction.y };
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
    if (this.editContext.lassoing) {
      this.editContext.lassoPoints.push(event.position.clone());
      this.finishLasso();
      this.editContext.interactionState = 'idle';
      event.accept();

      return;
    }
    if (!this.editContext.dragging) { return; }
    this.editContext.interactionState = this.editContext.drawing ? 'drawing' : 'editing';
    this.editContext.dragging = undefined; this.editContext.independentHandleEdit = false; event.accept();
    if (!this.editContext.drawing) {
      this.emit('commit');
      this.editContext.sessionId = 0;
      this.editContext.interactionState = 'idle';
    }
    this.editContext.dragPath = undefined;
    this.editContext.dragOrigin = undefined;
    this.editContext.beforeDrag = undefined;
  }

  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (key === 'escape' && this.editContext.lassoing) {
      this.setLassoMode(false); event.accept();
    } else if (key === 'escape') {
      event.accept();
      const state = this.interactionMode;

      this.finish(false, this.interactionMode === 'create' ? false : true);
      this.onEscape?.(state);
    } else if (key === 'enter') { event.accept(); this.finish(false); } else if (key === 'q') {
      this.setLassoMode(!this.editContext.lassoMode); event.accept();
    } else if (key === 'backspace' || key === 'delete') { event.accept(); this.deleteSelectedPoint(); } else if (key === 'z' && (event.ctrlPressed || event.metaPressed) && this.editContext.drawing) {
      event.accept();
      const from = event.shiftPressed ? this.editContext.redoDraft : this.editContext.undoDraft;
      const to = event.shiftPressed ? this.editContext.undoDraft : this.editContext.redoDraft;
      const previous = from.pop();

      if (previous) {
        to.push(cloneGeometry(this.editContext.path)); this.editContext.path = previous; this.editContext.dragging = undefined; this.editContext.selected = undefined;
        this._owner.getSnapManager().reset(); this.emit('update');
      }
    }
  }

  override onMouseLeave (): void {
    this.hover = undefined;
    this.hoverPosition = undefined;
    if (this.editContext.lassoing) { this.appendLassoPoint(this._owner.getMousePosition()); }
    this._owner.getSnapManager().reset();
  }
  onCancel (_reason: string): void {
    if (this.editContext.lassoing) { this.setLassoMode(false); }
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

    for (const [shapeIndex, shape] of this.editContext.path.shapes.entries()) {
      shape.indexes.forEach((index, i) => {
        const point = this.editContext.path.points[index.point];
        const nextIndex = shape.indexes[i + 1] ?? (shape.close ? shape.indexes[0] : undefined);

        if (point === undefined) {
          return;
        }
        const from = this.toView(point);

        if (nextIndex !== undefined && this.editContext.path.points[nextIndex.point] !== undefined) {
          const next = this.editContext.path.points[nextIndex.point];
          const out = this.editContext.path.easingOuts[index.easingOut] ?? { x: 0, y: 0 };
          const incoming = this.editContext.path.easingIns[nextIndex.easingIn] ?? { x: 0, y: 0 };
          const c1 = this.toView({ x: point.x + out.x, y: point.y + out.y });
          const c2 = this.toView({ x: next.x + incoming.x, y: next.y + incoming.y });
          const to = this.toView(next);
          const selectedSegment = this.editContext.selected?.part === 'segment'
            && this.editContext.selected.shape === shapeIndex && this.editContext.selected.index === i;
          const hoveredSegment = this.hover?.part === 'segment'
            && this.hover.shape === shapeIndex && this.hover.index === i;

          control.drawBezier(from.x, from.y, c1.x, c1.y, c2.x, c2.y, to.x, to.y,
            selectedSegment ? selectedColor : hoveredSegment ? hoverColor : pathColor,
            selectedSegment ? config.selectedLineWidth : config.lineWidth);
        } else if (this.editContext.drawing && shapeIndex === this.editContext.activeShape && this.hoverPosition && !this.editContext.dragging) {
          control.drawLine(from.x, from.y, this.hoverPosition.x, this.hoverPosition.y, previewColor, config.previewLineWidth);
        }
      });
    }
    if (this.hover?.part === 'segment') {
      const center = this.segmentPoint(this.editContext.path, this.hover.shape, this.hover.index, 0.5);

      if (center) {
        const point = this.toView(center);

        control.fillCircle(point.x, point.y, config.pointSize / 2, pointColor);
        control.drawCircle(point.x, point.y, config.pointSize / 2, hoverColor, config.hoverLineWidth);
      }
    }
    if (this.editContext.lassoing && this.editContext.lassoPoints.length > 1) {
      const vertices = this.editContext.lassoPoints.flatMap(point => [point.x, point.y]);

      control.drawPolyline(vertices, lassoColor, config.lassoLineWidth);
    }
    for (const node of this.selectedPointsInfo) {
      const index = this.editContext.path.shapes[node.shape]?.indexes[node.point];
      const anchor = index && this.editContext.path.points[index.point];

      if (!index || !anchor) { continue; }
      const from = this.toView(anchor);
      const dragging = this.editContext.dragging;
      const editingHandles = dragging?.shape === node.shape && dragging.index === node.point
        && (dragging.part === 'in' || dragging.part === 'out');

      for (const part of ['in', 'out'] as const) {
        const to = this.handlePosition(index, part);

        if (to) {
          const isActiveHandle = editingHandles && dragging.part === part;
          const isEditingHandle = editingHandles && (!this.editContext.independentHandleEdit || isActiveHandle);
          const isSelectedHandle = this.editContext.selected?.shape === node.shape
            && this.editContext.selected.index === node.point
            && this.editContext.selected.part === part;
          const isHoveredHandle = this.hover?.shape === node.shape
            && this.hover.index === node.point
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
    // 位置点始终覆盖控制点，重叠时也能看见位置点的选中状态。
    this.editContext.path.shapes.forEach((shape, shapeIndex) => shape.indexes.forEach((index, i) => {
      const point = this.editContext.path.points[index.point];

      if (!point) { return; }
      const position = this.toView(point);
      const selectedAnchor = this.editContext.selectedNodes.has(this.nodeKey(shapeIndex, i));
      const hoveredAnchor = this.hover?.part === 'point' && this.hover.shape === shapeIndex && this.hover.index === i;
      const radius = config.pointSize / 2;

      control.fillCircle(position.x, position.y, radius, selectedAnchor ? selectedPointColor : pointColor);
      control.drawCircle(position.x, position.y, radius, hoveredAnchor ? hoverPointLineColor : pointLineColor, config.pointLineWidth);
    }));
  }

  override dispose (): void {
    this.hover = undefined;
    this.hoverPosition = undefined;
    if (!this.sharedContext) {
      this.resetState();
    }
  }

  private resetState (): void {
    this._owner.getSnapManager().reset(); this.editContext.path = this.emptyPath();
    this.editContext.drawing = false; this.editContext.interactionState = 'idle'; this.editContext.target = undefined; this.editContext.targetKind = undefined; this.editContext.targetRevision = undefined;
    this.editContext.selected = undefined; this.editContext.selectedNodes.clear(); this.editContext.dragging = undefined; this.editContext.dragPath = undefined; this.editContext.dragOrigin = undefined; this.editContext.beforeDrag = undefined; this.editContext.beforeDrawing = undefined;
    this.hover = undefined; this.hoverPosition = undefined; this.editContext.undoDraft = []; this.editContext.redoDraft = []; this.editContext.activeShape = 0; this.editContext.sessionId = 0;
    this.editContext.independentHandleEdit = false; this.editContext.lassoing = false; this.editContext.lassoPoints = []; this.editContext.lassoAdditive = false; this.editContext.prependDrawing = false;
  }

  private refreshTarget (): void {
    if (this.editContext.drawing || this.editContext.dragging) { return; }
    if (this.interactionMode === 'create' && !this.preserveTarget) {
      if (this.editContext.target) { this.resetState(); }

      return;
    }
    const target = this.host.readPath();

    if (!target) {
      if (this.editContext.target) { this.resetState(); }

      return;
    }
    // 新投影在空闲时重新读取宿主，兼容未提供 revision 的目标。
    if (!this.targetLoaded || target.itemId !== this.editContext.target || target.revision !== this.editContext.targetRevision) {
      const sameTarget = target.itemId === this.editContext.target;
      const previousSelected = sameTarget && this.editContext.selected ? { ...this.editContext.selected } : undefined;
      const previousNodes = sameTarget ? this.selectedPointsInfo : [];

      this.targetLoaded = true;
      this.editContext.target = target.itemId; this.editContext.targetKind = target.kind; this.editContext.targetRevision = target.revision; this.editContext.path = cloneGeometry(target.path);
      this.updateSelectedPoints(previousNodes, previousSelected);
    }
  }

  private hitTest (point: Vector2): PenHit | undefined {
    const hitDistance = this.config.hitDistance;
    const selected = this.editContext.selected;
    const selectedNodes = this.selectedPointsInfo;
    let nearest = hitDistance;
    let hit: PenHit | undefined;

    // 按距离选择，位置点与控制点等距或重叠时优先位置点。
    for (let shape = 0; shape < this.editContext.path.shapes.length; shape++) {
      const indexes = this.editContext.path.shapes[shape].indexes;

      for (let index = 0; index < indexes.length; index++) {
        const anchor = this.editContext.path.points[indexes[index].point];
        const distance = anchor ? this.toView(anchor).distance(point) : Infinity;

        if (distance <= hitDistance && (!hit || distance < nearest)) {
          nearest = distance;
          hit = { shape, index, part: 'point' };
        }
      }
    }
    // 多选后所有可见控制点都可编辑，控制点等距时优先主选中节点。
    selectedNodes.sort((a, b) => Number(b.shape === selected?.shape && b.point === selected?.index)
      - Number(a.shape === selected?.shape && a.point === selected?.index));
    for (const node of selectedNodes) {
      const selectedIndex = this.editContext.path.shapes[node.shape]?.indexes[node.point];

      if (!selectedIndex) { continue; }
      for (const part of ['in', 'out'] as const) {
        const position = this.handlePosition(selectedIndex, part);

        if (position) {
          const distance = position.distance(point);

          if (distance <= hitDistance && (!hit || distance < nearest - 0.000001)) {
            nearest = distance;
            hit = { shape: node.shape, index: node.point, part };
          }
        }
      }
    }
    if (hit) { return hit; }

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

    this.editContext.path.shapes.forEach((shape, shapeIndex) => shape.indexes.forEach((_, index) => {
      const indexes = this.segmentIndexes(this.editContext.path, shapeIndex, index);

      if (!indexes) { return; }
      const from = this.editContext.path.points[indexes.from.point];
      const to = this.editContext.path.points[indexes.to.point];

      if (!from || !to) { return; }
      const outgoing = this.editContext.path.easingOuts[indexes.from.easingOut] ?? { x: 0, y: 0 };
      const incoming = this.editContext.path.easingIns[indexes.to.easingIn] ?? { x: 0, y: 0 };
      const closest = hitPenCurve(point, [
        this.toView(from),
        this.toView({ x: from.x + outgoing.x, y: from.y + outgoing.y }),
        this.toView({ x: to.x + incoming.x, y: to.y + incoming.y }),
        this.toView(to),
      ], nearest);

      if (closest) { nearest = closest.distance; hit = { shape: shapeIndex, index, t: closest.t }; }
    }));

    return hit;
  }

  private toLocal (point: Vector2): Vector2 | undefined { return this.host.viewToLocal(point, this.editContext.target); }
  private toView (point: PathPoint): Vector2 { return this.host.localToView(point, this.editContext.target); }

  private handlePosition (index: PathIndex, part: 'in' | 'out'): Vector2 | undefined {
    const anchor = this.editContext.path.points[index.point];
    const offset = part === 'in' ? this.editContext.path.easingIns[index.easingIn] : this.editContext.path.easingOuts[index.easingOut];

    return anchor && offset && (offset.x !== 0 || offset.y !== 0)
      ? this.toView({ x: anchor.x + offset.x, y: anchor.y + offset.y }) : undefined;
  }

  private segmentIndexes (path: PenPathData, shapeIndex: number, segment: number): { from: PathIndex, to: PathIndex } | undefined {
    const shape = path.shapes[shapeIndex];
    const from = shape?.indexes[segment];
    const to = shape?.indexes[segment + 1] ?? (shape?.close ? shape.indexes[0] : undefined);

    return from && to ? { from, to } : undefined;
  }

  private segmentPoint (path: PenPathData, shapeIndex: number, segment: number, t: number): Vector2 | undefined {
    const indexes = this.segmentIndexes(path, shapeIndex, segment);

    if (!indexes) { return undefined; }
    const from = path.points[indexes.from.point];
    const to = path.points[indexes.to.point];

    if (!from || !to) { return undefined; }
    const p0 = new Vector2().copyFrom(from);
    const p3 = new Vector2().copyFrom(to);
    const p1 = new Vector2().copyFrom(path.easingOuts[indexes.from.easingOut] ?? Vector2.ZERO).add(p0);
    const p2 = new Vector2().copyFrom(path.easingIns[indexes.to.easingIn] ?? Vector2.ZERO).add(p3);
    const u = 1 - t;

    return p0.multiply(u ** 3)
      .add(p1.multiply(3 * u ** 2 * t))
      .add(p2.multiply(3 * u * t ** 2))
      .add(p3.multiply(t ** 3));
  }

  private selectSegment (hit: PenHit): void {
    this.editContext.selected = hit;
    this.editContext.selectedNodes.clear();
    const segment = this.segmentIndexes(this.editContext.path, hit.shape, hit.index);

    if (segment) {
      this.editContext.selectedNodes.add(this.nodeKey(hit.shape, hit.index));
      const nextIndex = this.editContext.path.shapes[hit.shape]?.indexes.indexOf(segment.to);

      if (nextIndex !== undefined && nextIndex >= 0) {
        this.editContext.selectedNodes.add(this.nodeKey(hit.shape, nextIndex));
      }
    }
  }

  private getCreationStart (): PenHit | undefined {
    const selected = this.editContext.selected;

    if (this.editContext.selectedNodes.size !== 1 || selected?.part !== 'point'
      || !this.editContext.selectedNodes.has(this.nodeKey(selected.shape, selected.index))) { return; }
    const index = this.editContext.path.shapes[selected.shape]?.indexes[selected.index];

    return index && this.editContext.path.points[index.point] ? selected : undefined;
  }

  private beginDrawingFromExistingPoint (hit: PenHit): boolean {
    if (hit.part !== 'point') {
      return false;
    }
    const shape = this.editContext.path.shapes[hit.shape];
    const source = this.editContext.path.shapes[hit.shape]?.indexes[hit.index];

    if (!source) {
      return false;
    }
    this.editContext.beforeDrawing = cloneGeometry(this.editContext.path);
    const continueOpenShape = this.isOpenEndpoint(hit.shape, hit.index);

    if (continueOpenShape && shape) {
      this.editContext.activeShape = hit.shape;
      this.editContext.prependDrawing = hit.index === 0;
    } else {
      const easingIn = appendPenHandle(this.editContext.path, 'easingIn', Vector2.ZERO);
      const easingOut = appendPenHandle(this.editContext.path, 'easingOut', Vector2.ZERO);

      this.editContext.activeShape = this.editContext.path.shapes.length;
      this.editContext.path.shapes.push({ close: false, indexes: [{ point: source.point, easingIn, easingOut }] });
      this.editContext.prependDrawing = false;
    }
    this.editContext.drawing = true;
    this.editContext.interactionState = 'drawing';
    this.editContext.undoDraft = [];
    this.editContext.redoDraft = [];
    this.editContext.dragging = undefined;
    this.editContext.beforeDrag = undefined;
    this.editContext.dragPath = undefined;
    const selectedIndex = continueOpenShape && this.editContext.prependDrawing ? 0
      : continueOpenShape ? this.editContext.path.shapes[this.editContext.activeShape].indexes.length - 1 : 0;

    this.editContext.selected = { shape: this.editContext.activeShape, index: selectedIndex, part: 'point' };
    this.editContext.selectedNodes.clear();
    this.editContext.selectedNodes.add(this.nodeKey(this.editContext.activeShape, this.editContext.selected.index));
    this.beginSession();

    return true;
  }

  private isOpenEndpoint (shapeIndex: number, index: number): boolean {
    const shape = this.editContext.path.shapes[shapeIndex];

    return !!shape && !shape.close && shape.indexes.length > 0
      && (index === 0 || index === shape.indexes.length - 1);
  }

  private canCloseExistingShape (selected: PenHit, hit?: PenHit): boolean {
    if (selected.part !== 'point' || hit?.part !== 'point' || selected.shape !== hit.shape) {
      return false;
    }
    const shape = this.editContext.path.shapes[selected.shape];
    const last = shape ? shape.indexes.length - 1 : -1;
    const selectedEndpoint = selected.index === 0 || selected.index === last;
    const hitEndpoint = hit ? hit.index === 0 || hit.index === last : false;

    return !!shape && !shape.close && shape.indexes.length >= 3
      && selectedEndpoint && hitEndpoint && selected.index !== hit.index;
  }

  private selectCreatePoint (hit: PenHit): void {
    this.editContext.selected = { ...hit };
    this.editContext.selectedNodes.clear();
    this.editContext.selectedNodes.add(this.nodeKey(hit.shape, hit.index));
    this.editContext.dragging = undefined;
    this.editContext.beforeDrag = undefined;
    this.editContext.dragPath = undefined;
    this.editContext.interactionState = 'idle';
    this.hover = hit;
  }

  private closeExistingShape (shapeIndex: number): void {
    const shape = this.editContext.path.shapes[shapeIndex];

    if (!shape || shape.close || shape.indexes.length < 3) {
      return;
    }
    this.editContext.beforeDrawing = undefined;
    this.editContext.beforeDrag = cloneGeometry(this.editContext.path);
    this.editContext.interactionState = 'editing';
    this.beginSession();
    this.emit('start');
    shape.close = true;

    const action = this.action('commit');

    action.finish = false;
    action.continueCreate = true;
    if (action.edit) {
      action.edit.selection = [];
    }
    this.resetState();
    this._owner.emit('actioncommit', action);
  }

  private insertSegmentPoint (hit: PenHit): void {
    this.editContext.beforeDrag = cloneGeometry(this.editContext.path);
    this.beginSession();
    this.emit('start');
    const index = splitPenSegment(this.editContext.path, hit.shape, hit.index, 0.5);

    if (index === undefined) {
      this.cancel(false);

      return;
    }
    this.editContext.selected = { shape: hit.shape, index, part: 'point' };
    this.editContext.selectedNodes.clear();
    this.editContext.selectedNodes.add(this.nodeKey(hit.shape, index));
    this.editContext.dragPath = cloneGeometry(this.editContext.path);
    this.editContext.dragging = { shape: hit.shape, index, part: 'point' };
    this.hover = undefined;
  }

  private snapPoint (point: Vector2, dragging?: PenHit): Vector2 {
    const snap = this._owner.getSnapManager();

    snap.clearSnappingVisualizations();
    if (!snap.enabled) { return point.clone(); }
    const targets: Vector2[] = [];
    const movingPoints = new Set<number>();

    if (dragging?.part === 'point') {
      const nodes = this.selectedPointsInfo;

      if (!nodes.length) { nodes.push({ shape: dragging.shape, point: dragging.index }); }

      for (const node of nodes) {
        const index = this.editContext.path.shapes[node.shape]?.indexes[node.point];

        if (index) { movingPoints.add(index.point); }
      }
    } else if (dragging?.part === 'segment') {
      const segment = this.segmentIndexes(this.editContext.path, dragging.shape, dragging.index);

      if (segment) { movingPoints.add(segment.from.point); movingPoints.add(segment.to.point); }
    }
    // 仅吸附当前元素内静止的位置点和控制点，排除随选区一起移动的候选。
    for (const [shapeIndex, shape] of this.editContext.path.shapes.entries()) {
      for (const [nodeIndex, index] of shape.indexes.entries()) {
        const anchor = this.editContext.path.points[index.point];

        if (!anchor || movingPoints.has(index.point)) { continue; }
        targets.push(this.toView(anchor));
        for (const part of ['in', 'out'] as const) {
          if (dragging && shapeIndex === dragging.shape && nodeIndex === dragging.index
            && (dragging.part === 'in' || dragging.part === 'out')
            && (part === dragging.part || !this.editContext.independentHandleEdit)) { continue; }
          const position = this.handlePosition(index, part);

          if (position) { targets.push(position); }
        }
      }
    }
    snap.preparePoint(new Vector2(), point, targets, true, true, false);

    return point.clone().subtract(new Vector2(snap.result.x ?? 0, snap.result.y ?? 0));
  }

  private finish (close: boolean, exitTool = true): void {
    if (!this.valid()) {
      this.cancel(true);

      return;
    }
    const shape = this.editContext.path.shapes[this.editContext.activeShape];

    if (!this.editContext.drawing || !shape || shape.indexes.length < 2) {
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
    this.resetState(); this._owner.emit('actioncommit', action);
  }

  private beginSession (): void { this.editContext.sessionId = nextGeometrySession(); this.editContext.context = this.host.contextKey?.(); }
  private valid (): boolean {
    if (!this.editContext.sessionId) {
      return true;
    }
    if (!this.host.canEdit(this.editContext.target) || this.editContext.context !== this.host.contextKey?.()) {
      return false;
    }
    if (!this.editContext.target) {
      return true;
    }
    const target = this.host.readPath();

    return target?.itemId === this.editContext.target && target.revision === this.editContext.targetRevision;
  }
  private action (phase: ShapeDrawingActionEvent['phase']): ShapeDrawingActionEvent {
    const action: ShapeDrawingActionEvent = { source: this, sessionId: this.editContext.sessionId, phase };

    if (this.editContext.target) {
      const before = cloneGeometry(this.editContext.beforeDrawing ?? this.editContext.beforeDrag ?? this.editContext.path);
      const path = cloneGeometry(this.editContext.path);

      action.edit = {
        itemId: this.editContext.target,
        before,
        path,
        operations: penEditOperations(before, path),
        kind: this.editContext.targetKind,
        selection: this.selectedPointsInfo,
      };
      action.finish = false;
    } else { action.create = { kind: 'pen', path: cloneGeometry(this.editContext.path) }; }

    return action;
  }
  private emit (phase: 'start' | 'update' | 'commit'): void { this._owner.emit(`action${phase}`, this.action(phase)); }
  private cancel (finish: boolean): void {
    const active = this.editContext.sessionId !== 0 || (!!this.editContext.target && finish);

    if (!active) {
      return;
    }
    const selected = this.editContext.selected && { ...this.editContext.selected };
    const selectedNodes = this.selectedPointsInfo;
    const target = this.editContext.target;
    const targetKind = this.editContext.targetKind;
    const targetRevision = this.editContext.targetRevision;
    const action = this.action('cancel');

    action.canceled = true; action.finish = finish;
    this.resetState();
    if (target) {
      this.editContext.target = target;
      this.editContext.targetKind = targetKind;
      this.editContext.targetRevision = targetRevision;
      this.editContext.path = cloneGeometry(action.edit!.before);
      this.updateSelectedPoints(selectedNodes, selected);
    }
    this._owner.emit('actioncommit', action);
  }

  private detachHandle (hit: PenHit, field: 'easingIn' | 'easingOut'): void {
    const index = this.editContext.path.shapes[hit.shape].indexes[hit.index];
    const shared = this.editContext.path.shapes.some(shape => shape.indexes.some(other => other !== index && other[field] === index[field]));

    if (shared) {
      const handles = field === 'easingIn' ? this.editContext.path.easingIns : this.editContext.path.easingOuts;
      const handle = handles[index[field]] ?? { x: 0, y: 0 };

      index[field] = appendPenHandle(this.editContext.path, field, handle);
    }
  }

  private deleteSelectedPoint (): void {
    if (!this.host.canEdit(this.editContext.target) || !this.valid()) {
      this.onCancel('permission');

      return;
    }
    this._owner.getSnapManager().reset();
    if (this.editContext.drawing) {
      const previous = this.editContext.undoDraft.pop();

      if (previous) { this.editContext.redoDraft.push(cloneGeometry(this.editContext.path)); this.editContext.path = previous; this.emit('update'); }
    } else if (this.editContext.selected?.part === 'segment' && this.editContext.target) {
      const segment = { ...this.editContext.selected };

      this.editContext.beforeDrag = cloneGeometry(this.editContext.path); this.beginSession(); this.emit('start');
      const disconnected = disconnectPenSegment(this.editContext.path, segment.shape, segment.index);

      this.editContext.selected = undefined; this.editContext.selectedNodes.clear(); this.editContext.dragging = undefined;
      if (disconnected) {
        this.emit('commit');
      }
      this.editContext.beforeDrag = undefined; this.editContext.sessionId = 0; this.editContext.interactionState = 'idle';
    } else if (this.editContext.selected && this.editContext.target) {
      const selected = { ...this.editContext.selected };
      let keepSelection = false;

      this.editContext.beforeDrag = cloneGeometry(this.editContext.path); this.beginSession(); this.emit('start');
      if (this.editContext.selected.part === 'point') {
        const shape = this.editContext.path.shapes[selected.shape];

        if (shape?.close && openClosedShapeAt(this.editContext.path, selected.shape, selected.index)) {
          this.editContext.selected = { shape: selected.shape, index: shape.indexes.length - 1, part: 'point' };
          this.editContext.selectedNodes.clear();
          this.editContext.selectedNodes.add(this.nodeKey(selected.shape, shape.indexes.length - 1));
          keepSelection = true;
        } else {
          const nodes = this.selectedPointsInfo;

          if (!nodes.length) { nodes.push({ shape: selected.shape, point: selected.index }); }

          nodes.sort((a, b) => b.shape - a.shape || b.point - a.point).forEach(node => {
            deletePenPoint(this.editContext.path, node.shape, node.point, this.host.deleteBehavior ?? 'reconnect');
          });
          this.editContext.selected = undefined; this.editContext.selectedNodes.clear();
        }
      } else {
        const index = this.editContext.path.shapes[selected.shape]?.indexes[selected.index];

        if (index) {
          const field = selected.part === 'in' ? 'easingIns' : 'easingOuts';

          this.detachHandle(selected, selected.part === 'in' ? 'easingIn' : 'easingOut');
          const handleIndex = selected.part === 'in' ? index.easingIn : index.easingOut;

          this.editContext.path[field][handleIndex] = { x: 0, y: 0 };
        }
        this.editContext.selected = { ...selected, part: 'point' };
      }
      this.emit('commit'); this.editContext.beforeDrag = undefined; this.editContext.sessionId = 0;
      if (!keepSelection) { this.editContext.selected = undefined; this.editContext.selectedNodes.clear(); }
    }
    this.editContext.dragging = undefined;
  }

  private appendLassoPoint (point: Vector2): void {
    const last = this.editContext.lassoPoints[this.editContext.lassoPoints.length - 1];

    if (!last || last.distance(point) > 2) { this.editContext.lassoPoints.push(point.clone()); }
  }

  private finishLasso (): void {
    const polygon = this.editContext.lassoPoints;

    if (polygon.length >= 3) {
      const next = this.editContext.lassoAdditive ? new Set(this.editContext.selectedNodes) : new Set<string>();

      for (let shape = 0; shape < this.editContext.path.shapes.length; shape++) {
        for (let index = 0; index < this.editContext.path.shapes[shape].indexes.length; index++) {
          const pathIndex = this.editContext.path.shapes[shape].indexes[index];
          const point = this.editContext.path.points[pathIndex.point];

          if (point && this.pointInPolygon(this.toView(point), polygon)) {
            next.add(this.nodeKey(shape, index));
          }
        }
      }
      this.editContext.selectedNodes.clear();
      next.forEach(key => this.editContext.selectedNodes.add(key));
      const first = this.selectedPointsInfo[0];

      this.editContext.selected = first ? { shape: first.shape, index: first.point, part: 'point' } : undefined;
    }
    this.editContext.lassoing = false;
    this.editContext.lassoPoints = [];
    this.editContext.lassoAdditive = false;
  }

  private pointInPolygon (point: Vector2, polygon: Vector2[]): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;

      // 边界也属于套索区域，容许半个视口像素的投影误差。
      if (Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) <= 0.5) { return true; }
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
