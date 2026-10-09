import { Line2, type Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getBoxCorners } from '../math';
import type { SnapConfig } from '../configs/types';
import { selectionSnapConfig } from '../configs/builtin-configs';
import type { VFXItem } from '@galacean/effects';
import { getItemViewBox, isEffectsPlayerItem, isFramePlayerItem } from '../items';
import type { GizmoOwner } from '../gizmo-owner';

const SNAP_EPSILON = 0.000001;
const SNAP_MARKER_HALF_SIZE = 2;

type SnapAxis = 'x' | 'y';

type SnapGapSegment = {
  axis: SnapAxis,
  start: number,
  end: number,
  cross: number,
};

type AxisSnapCandidate = {
  distance: number,
  point?: Vector2,
  target?: Vector2,
  targetBox?: Box2,
  gaps?: SnapGapSegment[],
};

type AxisSnapSelection = {
  distance: number,
  candidates: AxisSnapCandidate[],
};

/** 位移吸附结果。 */
export type TranslationSnapResult = {
  /** x 方向吸附距离 */
  x?: number,
  /** y 方向吸附距离 */
  y?: number,
  /** x 方向点吸附信息 */
  xPoints?: TranslationPointSnapTarget[],
  /** y 方向点吸附信息 */
  yPoints?: TranslationPointSnapTarget[],
};

/** 平移点吸附信息。 */
export type TranslationPointSnapTarget = {
  /** 包围盒点 */
  point: Vector2,
  /** 吸附点 */
  targets: Vector2[],
};

/** 管理选区吸附目标、修正量和对齐提示。 */
export class SnapManager {
  /** 当前吸附结果。距离为未吸附位置减目标位置，调用方应减去该值。 */
  result: TranslationSnapResult = {};

  private readonly owner: GizmoOwner;

  /** 吸附提示线集合。 */
  private results: Line2[] = [];

  /** 当前拖拽会话缓存的吸附目标。 */
  private targetBoxes: Box2[] = [];

  /** 本帧每轴选中的最近候选。 */
  private axisSelections: Partial<Record<SnapAxis, AxisSnapSelection>> = {};

  /** 本帧尚未施加吸附修正的选区包围盒。 */
  private sourceBox: Box2 | undefined;

  /**
   * @param owner Gizmo 宿主
   */
  constructor (owner: GizmoOwner) {
    this.owner = owner;
  }

  /** 是否启用吸附。 */
  get enabled (): boolean {
    return this.config.enabled;
  }

  /** 当前吸附配置。 */
  get config (): Readonly<SnapConfig> {
    return this.owner.getConfigManager().get(selectionSnapConfig);
  }

  /**
   * 缓存一次选区交互使用的吸附目标。
   * @param items 场景元素
   * @param selectedItems 当前选中元素
   * @param containerSize 画布容器尺寸
   */
  cacheSnapTargetsForSelection (
    items: readonly VFXItem[],
    selectedItems: readonly VFXItem[],
    containerSize: Vector2,
  ): void {
    if (selectedItems.length === 0) {
      this.clearCache();

      return;
    }

    const selectedIdSet = new Set(selectedItems.map(item => item.getInstanceId()));
    const selectedAncestorIdSet = this.getAncestorIdSet(selectedItems);
    const scopeItemId = this.getCommonSnapScopeId(selectedItems);

    this.cacheSnapTargetBoxes(
      items
        .filter(item => item.isVisible
          && !selectedAncestorIdSet.has(item.getInstanceId())
          && !this.isSelectedOrDescendant(item, selectedIdSet)
          && this.getNearestSnapScopeId(item) === scopeItemId,
        )
        .map(item => getItemViewBox(item, containerSize))
        .filter(box => !box.isEmpty()),
    );
  }

  /**
   * 缓存视图空间中的吸附目标包围盒。
   * @param boxes 吸附目标包围盒
   */
  cacheSnapTargetBoxes (boxes: readonly Box2[]): void {
    this.targetBoxes = boxes.filter(box => !box.isEmpty()).map(box => box.clone());
  }

  /** 清空当前拖拽会话的吸附目标缓存。 */
  clearCache (): void {
    this.targetBoxes = [];
  }

  /** @returns 当前缓存的吸附目标包围盒。 */
  getSnapTargetBoxes (): readonly Box2[] {
    return this.targetBoxes;
  }

  /** @returns 当前吸附目标的角点和中心点。 */
  getSnapTargetPoints (): Vector2[] {
    return this.targetBoxes.flatMap(box => [
      ...getBoxCorners(box),
      box.getCenter(),
    ]);
  }

  /**
   * 包围盒位移吸附。每轴分别选择最近的边、中心或等距间隔候选。
   * @param shift 本次原始偏移值
   * @param box 当前已施加上一帧吸附修正的包围盒
   * @param otherBoxes 吸附包围盒
   * @param xEnabled 是否进行 x 轴吸附
   * @param yEnabled 是否进行 y 轴吸附
   */
  prepareBox (
    shift: Vector2,
    box: Box2,
    otherBoxes: readonly Box2[] = this.targetBoxes,
    xEnabled = true,
    yEnabled = true,
  ): void {
    const previousResult = this.result;

    this.clearFrameState();

    if (box.isEmpty()) {
      return;
    }

    // 先恢复未吸附的指针轨迹，再叠加本帧位移，避免吸附后无法平滑脱离。
    const unsnappedShift = new Vector2(previousResult.x ?? 0, previousResult.y ?? 0).add(shift);
    const sourceBox = box.clone().translate(unsnappedShift);

    this.sourceBox = sourceBox;

    for (const targetBox of otherBoxes) {
      if (targetBox.isEmpty()) {
        continue;
      }
      this.considerBoxAlignment(sourceBox, targetBox, 'x', xEnabled);
      this.considerBoxAlignment(sourceBox, targetBox, 'y', yEnabled);
    }

    if (xEnabled) {
      this.considerGapSnaps(sourceBox, otherBoxes, 'x');
    }
    if (yEnabled) {
      this.considerGapSnaps(sourceBox, otherBoxes, 'y');
    }

    this.publishResult();
  }

  /**
   * 点位移吸附。x/y 两轴独立选择最近目标。
   * @param shift 本次原始偏移值
   * @param point 当前已施加上一帧吸附修正的点
   * @param otherPoints 吸附点集合
   * @param xEnabled 是否进行 x 轴吸附
   * @param yEnabled 是否进行 y 轴吸附
   */
  preparePoint (
    shift: Vector2,
    point: Vector2,
    otherPoints: readonly Vector2[] = this.getSnapTargetPoints(),
    xEnabled = true,
    yEnabled = true,
  ): void {
    const previousResult = this.result;

    this.clearFrameState();

    const unsnappedShift = new Vector2(previousResult.x ?? 0, previousResult.y ?? 0).add(shift);
    const sourcePoint = point.clone().add(unsnappedShift);

    for (const target of otherPoints) {
      if (xEnabled) {
        this.considerAxisCandidate('x', {
          distance: sourcePoint.x - target.x,
          point: sourcePoint,
          target,
        });
      }
      if (yEnabled) {
        this.considerAxisCandidate('y', {
          distance: sourcePoint.y - target.y,
          point: sourcePoint,
          target,
        });
      }
    }

    this.publishResult();
  }

  /** @returns 当前视图坐标系中的吸附提示线。 */
  getSnappingVisualizations (): readonly Line2[] {
    this.update();

    return this.results;
  }

  /** 清空吸附修正量和提示，保留目标缓存。 */
  clearSnappingVisualizations (): void {
    this.clearFrameState();
  }

  /** 清空全部吸附状态。 */
  reset (): void {
    this.clearCache();
    this.clearSnappingVisualizations();
  }

  private update (): void {
    const lines: Line2[] = [];
    const correction = new Vector2(this.result.x ?? 0, this.result.y ?? 0);
    const snappedBox = this.sourceBox?.clone().translate(correction.clone().multiply(-1));

    this.appendAlignmentLines(lines, 'x', correction, snappedBox);
    this.appendAlignmentLines(lines, 'y', correction, snappedBox);
    this.appendGapLines(lines, 'x');
    this.appendGapLines(lines, 'y');

    this.results = this.deduplicateLines(lines);
  }

  /** 判断元素自身或任一祖先是否属于当前选区。 */
  private isSelectedOrDescendant (item: VFXItem, selectedIds: ReadonlySet<string>): boolean {
    let current: VFXItem | undefined = item;

    while (current) {
      if (selectedIds.has(current.getInstanceId())) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  /** 收集当前选区的全部祖先，避免容器成为自身内容的吸附目标。 */
  private getAncestorIdSet (items: readonly VFXItem[]): ReadonlySet<string> {
    const ids = new Set<string>();

    for (const item of items) {
      let current = item.parent;

      while (current) {
        ids.add(current.getInstanceId());
        current = current.parent;
      }
    }

    return ids;
  }

  /** 获取元素所在的最近吸附作用域；作用域元素自身属于外层。 */
  private getNearestSnapScopeId (item: VFXItem): string | undefined {
    let current = item.parent;

    while (current) {
      if (this.isSnapScopeItem(current)) {
        return current.getInstanceId();
      }
      current = current.parent;
    }

    return undefined;
  }

  /** 获取整个选区共同所在的最近吸附作用域。 */
  private getCommonSnapScopeId (items: readonly VFXItem[]): string | undefined {
    const scopeAncestorIds = items.map(item => {
      const ids: string[] = [];
      let current = item.parent;

      while (current) {
        if (this.isSnapScopeItem(current)) {
          ids.push(current.getInstanceId());
        }
        current = current.parent;
      }

      return ids;
    });
    const [first = [], ...rest] = scopeAncestorIds;

    return first.find(id => rest.every(ids => ids.includes(id)));
  }

  /** 画板和特效容器都会隔离内外吸附候选。 */
  private isSnapScopeItem (item: VFXItem): boolean {
    return isFramePlayerItem(item) || isEffectsPlayerItem(item);
  }

  /** 比较一个目标包围盒的 min / center / max 锚点。 */
  private considerBoxAlignment (
    sourceBox: Box2,
    targetBox: Box2,
    axis: SnapAxis,
    enabled: boolean,
  ): void {
    if (!enabled) {
      return;
    }

    const orthogonalAxis: SnapAxis = axis === 'x' ? 'y' : 'x';
    const sourceCenter = sourceBox.getCenter();
    const targetCenter = targetBox.getCenter();
    const sourceCoordinates = [sourceBox.min[axis], sourceCenter[axis], sourceBox.max[axis]];
    const targetCoordinates = [targetBox.min[axis], targetCenter[axis], targetBox.max[axis]];

    for (const sourceCoordinate of sourceCoordinates) {
      for (const targetCoordinate of targetCoordinates) {
        const point = new Vector2();

        point[axis] = sourceCoordinate;
        point[orthogonalAxis] = sourceCenter[orthogonalAxis];
        const target = new Vector2();

        target[axis] = targetCoordinate;
        target[orthogonalAxis] = targetCenter[orthogonalAxis];
        this.considerAxisCandidate(axis, {
          distance: sourceCoordinate - targetCoordinate,
          point,
          target,
          targetBox,
        });
      }
    }
  }

  /**
   * 添加等距候选：在现有 gap 中居中，或在 gap 两端复制相同间距。
   */
  private considerGapSnaps (sourceBox: Box2, boxes: readonly Box2[], axis: SnapAxis): void {
    const validBoxes = boxes.filter(box => !box.isEmpty());
    const orthogonalAxis: SnapAxis = axis === 'x' ? 'y' : 'x';
    const sourceSize = sourceBox.max[axis] - sourceBox.min[axis];

    for (let firstIndex = 0; firstIndex < validBoxes.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < validBoxes.length; secondIndex++) {
        let first = validBoxes[firstIndex];
        let second = validBoxes[secondIndex];

        if (first.min[axis] > second.min[axis]) {
          [first, second] = [second, first];
        }

        const gap = second.min[axis] - first.max[axis];

        if (gap <= SNAP_EPSILON || !this.rangesOverlap(first, second, orthogonalAxis)) {
          continue;
        }
        if (this.hasInterveningBox(first, second, validBoxes, axis, orthogonalAxis)) {
          continue;
        }

        const existingGap = this.createGapSegment(first, second, axis);

        // 居中：移动对象落在现有 gap 内，并使两侧间距相同。
        if (gap + SNAP_EPSILON >= sourceSize) {
          const desiredMin = first.max[axis] + (gap - sourceSize) / 2;
          const desiredBox = this.moveBoxAlongAxis(sourceBox, axis, desiredMin);

          if (this.rangesOverlap(desiredBox, first, orthogonalAxis) ||
            this.rangesOverlap(desiredBox, second, orthogonalAxis)) {
            this.considerAxisCandidate(axis, {
              distance: sourceBox.min[axis] - desiredMin,
              gaps: [
                this.createGapSegment(first, desiredBox, axis, existingGap.cross),
                this.createGapSegment(desiredBox, second, axis, existingGap.cross),
              ],
            });
          }
        }

        // 复制 gap 到现有对象对的前方。
        const beforeMax = first.min[axis] - gap;
        const beforeMin = beforeMax - sourceSize;
        const beforeBox = this.moveBoxAlongAxis(sourceBox, axis, beforeMin);

        if (this.rangesOverlap(beforeBox, first, orthogonalAxis)) {
          this.considerAxisCandidate(axis, {
            distance: sourceBox.min[axis] - beforeMin,
            gaps: [
              existingGap,
              this.createGapSegment(beforeBox, first, axis, existingGap.cross),
            ],
          });
        }

        // 复制 gap 到现有对象对的后方。
        const afterMin = second.max[axis] + gap;
        const afterBox = this.moveBoxAlongAxis(sourceBox, axis, afterMin);

        if (this.rangesOverlap(afterBox, second, orthogonalAxis)) {
          this.considerAxisCandidate(axis, {
            distance: sourceBox.min[axis] - afterMin,
            gaps: [
              existingGap,
              this.createGapSegment(second, afterBox, axis, existingGap.cross),
            ],
          });
        }
      }
    }
  }

  /** 只保留阈值内最近的候选；同一修正量的命中全部合并用于渲染。 */
  private considerAxisCandidate (axis: SnapAxis, candidate: AxisSnapCandidate): void {
    if (Math.abs(candidate.distance) > this.config.distance + SNAP_EPSILON) {
      return;
    }

    const current = this.axisSelections[axis];

    if (!current || Math.abs(candidate.distance) < Math.abs(current.distance) - SNAP_EPSILON) {
      this.axisSelections[axis] = {
        distance: candidate.distance,
        candidates: [candidate],
      };

      return;
    }

    if (Math.abs(candidate.distance - current.distance) <= SNAP_EPSILON) {
      current.candidates.push(candidate);
    }
  }

  /** 将内部轴命中发布到兼容的 TranslationSnapResult。 */
  private publishResult (): void {
    for (const axis of ['x', 'y'] as const) {
      const selection = this.axisSelections[axis];

      if (!selection) {
        continue;
      }
      this.result[axis] = selection.distance;

      const pointProperty = axis === 'x' ? 'xPoints' : 'yPoints';
      const pointMatches = selection.candidates.filter(
        (candidate): candidate is AxisSnapCandidate & { point: Vector2, target: Vector2 } =>
          candidate.point !== undefined && candidate.target !== undefined,
      );

      if (pointMatches.length === 0) {
        continue;
      }

      const pointGroups: TranslationPointSnapTarget[] = [];

      for (const match of pointMatches) {
        let group = pointGroups.find(item => this.pointsEqual(item.point, match.point));

        if (!group) {
          group = { point: match.point, targets: [] };
          pointGroups.push(group);
        }
        if (!group.targets.some(target => this.pointsEqual(target, match.target))) {
          group.targets.push(match.target);
        }
      }
      this.result[pointProperty] = pointGroups;
    }
  }

  /** 生成贯穿选区和全部命中目标完整范围的对齐线，并标记参与边段的端点。 */
  private appendAlignmentLines (
    lines: Line2[],
    axis: SnapAxis,
    correction: Vector2,
    snappedBox: Box2 | undefined,
  ): void {
    const selection = this.axisSelections[axis];

    if (!selection) {
      return;
    }

    const orthogonalAxis: SnapAxis = axis === 'x' ? 'y' : 'x';
    const matches = selection.candidates.filter(
      (candidate): candidate is AxisSnapCandidate & { point: Vector2, target: Vector2 } =>
        candidate.point !== undefined && candidate.target !== undefined,
    );
    const groups = new Map<string, typeof matches>();

    for (const match of matches) {
      const coordinate = match.target[axis];
      const key = coordinate.toFixed(6);
      const group = groups.get(key) ?? [];

      group.push(match);
      groups.set(key, group);
    }

    for (const matchesAtCoordinate of groups.values()) {
      const coordinate = matchesAtCoordinate[0].target[axis];
      let min = snappedBox?.min[orthogonalAxis] ?? Number.POSITIVE_INFINITY;
      let max = snappedBox?.max[orthogonalAxis] ?? Number.NEGATIVE_INFINITY;
      const markerPoints: Vector2[] = [];

      if (snappedBox) {
        markerPoints.push(
          this.createAxisPoint(axis, coordinate, snappedBox.min[orthogonalAxis]),
          this.createAxisPoint(axis, coordinate, snappedBox.max[orthogonalAxis]),
        );
      }

      for (const match of matchesAtCoordinate) {
        const snappedPoint = match.point.clone().subtract(correction);

        min = Math.min(min, snappedPoint[orthogonalAxis], match.target[orthogonalAxis]);
        max = Math.max(max, snappedPoint[orthogonalAxis], match.target[orthogonalAxis]);
        if (match.targetBox) {
          min = Math.min(min, match.targetBox.min[orthogonalAxis]);
          max = Math.max(max, match.targetBox.max[orthogonalAxis]);
          markerPoints.push(
            this.createAxisPoint(axis, coordinate, match.targetBox.min[orthogonalAxis]),
            this.createAxisPoint(axis, coordinate, match.targetBox.max[orthogonalAxis]),
          );
        } else {
          markerPoints.push(
            this.createAxisPoint(axis, coordinate, snappedPoint[orthogonalAxis]),
            this.createAxisPoint(axis, coordinate, match.target[orthogonalAxis]),
          );
        }
      }

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        continue;
      }
      const start = new Vector2();
      const end = new Vector2();

      start[axis] = coordinate;
      end[axis] = coordinate;
      start[orthogonalAxis] = min;
      end[orthogonalAxis] = max;
      lines.push(new Line2(start, end));

      for (const marker of this.deduplicatePoints(markerPoints)) {
        this.appendSnapMarker(lines, marker);
      }
    }
  }

  private appendSnapMarker (lines: Line2[], point: Vector2): void {
    lines.push(
      new Line2(
        new Vector2(point.x - SNAP_MARKER_HALF_SIZE, point.y - SNAP_MARKER_HALF_SIZE),
        new Vector2(point.x + SNAP_MARKER_HALF_SIZE, point.y + SNAP_MARKER_HALF_SIZE),
      ),
      new Line2(
        new Vector2(point.x - SNAP_MARKER_HALF_SIZE, point.y + SNAP_MARKER_HALF_SIZE),
        new Vector2(point.x + SNAP_MARKER_HALF_SIZE, point.y - SNAP_MARKER_HALF_SIZE),
      ),
    );
  }

  /** 创建位于指定吸附轴和正交轴坐标上的点。 */
  private createAxisPoint (axis: SnapAxis, coordinate: number, orthogonalCoordinate: number): Vector2 {
    return axis === 'x'
      ? new Vector2(coordinate, orthogonalCoordinate)
      : new Vector2(orthogonalCoordinate, coordinate);
  }

  /** 把等距 gap 绘制为间距线。 */
  private appendGapLines (lines: Line2[], axis: SnapAxis): void {
    const selection = this.axisSelections[axis];

    if (!selection) {
      return;
    }

    for (const candidate of selection.candidates) {
      for (const gap of candidate.gaps ?? []) {
        if (Math.abs(gap.end - gap.start) <= SNAP_EPSILON) {
          continue;
        }
        if (axis === 'x') {
          lines.push(new Line2(
            new Vector2(gap.start, gap.cross),
            new Vector2(gap.end, gap.cross),
          ));
        } else {
          lines.push(new Line2(
            new Vector2(gap.cross, gap.start),
            new Vector2(gap.cross, gap.end),
          ));
        }
      }
    }
  }

  /** 构造两个相邻包围盒之间的 gap 提示。 */
  private createGapSegment (
    first: Box2,
    second: Box2,
    axis: SnapAxis,
    crossCoordinate?: number,
  ): SnapGapSegment {
    const orthogonalAxis: SnapAxis = axis === 'x' ? 'y' : 'x';
    const overlapMin = Math.max(first.min[orthogonalAxis], second.min[orthogonalAxis]);
    const overlapMax = Math.min(first.max[orthogonalAxis], second.max[orthogonalAxis]);
    const cross = crossCoordinate ?? (overlapMin <= overlapMax
      ? (overlapMin + overlapMax) / 2
      : (first.getCenter()[orthogonalAxis] + second.getCenter()[orthogonalAxis]) / 2);

    return {
      axis,
      start: first.max[axis],
      end: second.min[axis],
      cross,
    };
  }

  /** 把包围盒沿单轴移动到指定 min 坐标。 */
  private moveBoxAlongAxis (box: Box2, axis: SnapAxis, min: number): Box2 {
    const translation = new Vector2();

    translation[axis] = min - box.min[axis];

    return box.clone().translate(translation);
  }

  /** 判断两个包围盒在指定轴上的投影是否相交或相切。 */
  private rangesOverlap (first: Box2, second: Box2, axis: SnapAxis): boolean {
    return Math.min(first.max[axis], second.max[axis]) + SNAP_EPSILON >=
      Math.max(first.min[axis], second.min[axis]);
  }

  private pointsEqual (first: Vector2, second: Vector2): boolean {
    return Math.abs(first.x - second.x) <= SNAP_EPSILON &&
      Math.abs(first.y - second.y) <= SNAP_EPSILON;
  }

  /** 合并共享同一屏幕坐标的吸附锚点。 */
  private deduplicatePoints (points: readonly Vector2[]): Vector2[] {
    const unique: Vector2[] = [];

    for (const point of points) {
      if (!unique.some(item => this.pointsEqual(item, point))) {
        unique.push(point);
      }
    }

    return unique;
  }

  /** 排除被第三个目标占据的非相邻 gap。 */
  private hasInterveningBox (
    first: Box2,
    second: Box2,
    boxes: readonly Box2[],
    axis: SnapAxis,
    orthogonalAxis: SnapAxis,
  ): boolean {
    return boxes.some(box => box !== first && box !== second &&
      box.min[axis] < second.min[axis] - SNAP_EPSILON &&
      box.max[axis] > first.max[axis] + SNAP_EPSILON &&
      this.rangesOverlap(box, first, orthogonalAxis) &&
      this.rangesOverlap(box, second, orthogonalAxis));
  }

  /** 去掉由多组等价命中生成的重复线段。 */
  private deduplicateLines (lines: readonly Line2[]): Line2[] {
    const unique = new Map<string, Line2>();

    for (const line of lines) {
      const forward = `${line.start.x.toFixed(4)},${line.start.y.toFixed(4)}:${line.end.x.toFixed(4)},${line.end.y.toFixed(4)}`;
      const reverse = `${line.end.x.toFixed(4)},${line.end.y.toFixed(4)}:${line.start.x.toFixed(4)},${line.start.y.toFixed(4)}`;

      if (!unique.has(forward) && !unique.has(reverse)) {
        unique.set(forward, line);
      }
    }

    return Array.from(unique.values());
  }

  /** 清空本帧求解与渲染状态。 */
  private clearFrameState (): void {
    this.results = [];
    this.result = {};
    this.axisSelections = {};
    this.sourceBox = undefined;
  }
}
