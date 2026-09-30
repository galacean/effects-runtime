import { EventEmitter, type Engine, type Composition, type InputEventMouseButton, type Region, spec, type VFXItem, TextComponent, SpriteComponent, FrameComponent, addItem } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Ray, Vector2, setBoxFromPoints, transformedBoxContainsPoint } from '../math';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import {
  getPlayerItemById,
  getEffectsPlayerItemOwner,
  getItemViewBox,
  getItemViewTransform,
  getItemChildren,
  isGroupPlayerItem,
  isFramePlayerItem,
} from '../items';
import { viewPositionToNDC } from '../viewport';

/** Hover state shared by input observation and the Tool UI renderer. */
export type HoveringResults = {
  /** Externally observable hover target. */
  itemId?: string,
  /** Target currently submitted to the Tool UI hover renderer. */
  overlayItemId?: string,
};

/** 点选或框选的原始命中结果。 */
type HitTestResult = {
  /** 命中检测射线。 */
  ray: Ray,
  /** 引擎返回的命中区域。 */
  regions: Region[],
};

/**
 * 画板元素左上角点击交互区域尺寸
 */
const FRAME_INTERACTION_WIDTH = 40;
const FRAME_INTERACTION_HEIGHT = 20;

/** Selection 事件参数。 */
export type SelectionEvents = {
  /** 选中集变更。 */
  'selectionchange': [{
    /** 变更前的选中元素 ID。 */
    oldSelectedIds: string[],
    /** 变更后的选中元素 ID。 */
    newSelectedIds: string[],
  }],
  /** 预选态变更。 */
  'preselectchange': [{
    /** 当前预选元素 ID。 */
    preSelectedId: string | undefined,
  }],
};

/** 一次选区行为派发使用的稳定命中快照。 */
export type SelectionHitSnapshot = {
  /** 命中检测坐标。 */
  point: Vector2,
  /** 按层级过滤后的可选元素 ID。 */
  selectableIds: string[],
  /** 最上层可选元素 ID。 */
  topmostId?: string,
  /** 当前选中范围内的命中元素 ID。 */
  selectedScopeHitIds: string[],
  /** 跳过已选父组后，可继续下钻一层的元素 ID。 */
  drillTargetId?: string,
};

/** 管理选中状态、预选状态和场景命中查询。 */
export class Selection extends EventEmitter<SelectionEvents> {
  /** 本次交互开始前的选中快照。 */
  interactionStartSelectedIds: string[] = [];
  /** 命中检测需要排除的元素 ID。 */
  ignoreIds: string[] = ['sceneRoot'];
  /** 命中检测需要排除的元素名称。 */
  ignoreNames: string[] = [];

  /** 当前选中元素 ID。 */
  private _selectedIds: string[] = [];
  /** 当前允许穿透选择的特效容器 ID。 */
  private _effectsEditItemId: string | undefined;
  /** 当前组内交互的焦点容器 ID。 */
  private _focusedGroupId: string | undefined;
  private readonly engine: Engine;
  private readonly hoveringResults: HoveringResults;

  /**
   * @param engine Effects 引擎
   * @param hoveringResults 共享的预选状态
   */
  constructor (engine: Engine, hoveringResults: HoveringResults = {}) {
    super();
    this.engine = engine;
    this.hoveringResults = hoveringResults;
  }

  /** 选中元素 ID 的副本。 */
  get selectedIds (): string[] {
    return [...this._selectedIds];
  }

  /**
   * 替换选中元素并发出变更事件。
   * @param ids 新的选中元素 ID
   */
  set selectedIds (ids: string[]) {
    const old = [...this._selectedIds];

    this._selectedIds = this.normalizeHierarchySelection(ids);
    this.updateFocusedGroupFromSelection(this._selectedIds);
    this.emit('selectionchange', { oldSelectedIds: old, newSelectedIds: [...this._selectedIds] });
  }

  /** 对外可观察的 hover 命中结果。 */
  get preSelectedId (): string | undefined {
    return this.hoveringResults.itemId;
  }

  /** 当前 Tool UI 要绘制的 hover 目标。 */
  get hoverOverlayItemId (): string | undefined {
    return this.hoveringResults.overlayItemId;
  }

  /** @returns 当前正在内部编辑的特效容器 ID。 */
  getEffectsEditItemId (): string | undefined {
    return this._effectsEditItemId;
  }

  /** @returns 当前组内交互的焦点容器 ID。 */
  getFocusedGroupId (): string | undefined {
    return this._focusedGroupId;
  }

  /**
   * 设置当前组内交互的焦点容器。
   * @param groupId Group 实例 ID；传空值表示回到场景根层级
   */
  setFocusedGroup (groupId?: string | null): void {
    if (!groupId) {
      this._focusedGroupId = undefined;

      return;
    }

    const group = getPlayerItemById(this.engine.sceneServer.compositions[0], groupId);

    if (!group || !this.isSelectableGroup(group)) {
      throw new Error(`Selection.setFocusedGroup: Group with id ${groupId} does not exist`);
    }
    this._focusedGroupId = groupId;
  }

  /**
   * 放开指定特效容器的子树选择边界。
   * @param effectsItemId 特效容器 ID
   */
  enterEffectsEditScope (effectsItemId: string): void {
    this._effectsEditItemId = effectsItemId;
    this.setFocusedGroup();
  }

  /** 关闭特效子树选择边界。 */
  leaveEffectsEditScope (): void {
    this._effectsEditItemId = undefined;
    this.setFocusedGroup();
  }

  /** @returns 选中元素 ID 的内部只读引用。 */
  getSelectedIds (): string[] {
    return this._selectedIds;
  }

  /** @returns 当前选中 ID 对应的有效 VFXItem。 */
  getSelectedPlayerItems (): VFXItem[] {
    return this._selectedIds
      .map(id => getPlayerItemById(this.engine.sceneServer.compositions[0], id))
      .filter((item): item is VFXItem => !!item);
  }

  /**
   * 判断元素是否已选中。
   * @param id 元素 ID
   * @returns 是否已选中
   */
  isItemSelected (id: string): boolean {
    return this._selectedIds.includes(id);
  }

  /**
   * 追加尚未选中的元素并发出变更事件。
   * @param ids 待追加元素 ID
   */
  addSelectedItems (ids: string[]): void {
    const next = this.normalizeHierarchySelection([...this._selectedIds, ...ids]);

    if (this.sameIds(this._selectedIds, next)) {
      return;
    }
    const old = [...this._selectedIds];

    this._selectedIds = next;
    this.updateFocusedGroupFromSelection(next);
    this.emit('selectionchange', { oldSelectedIds: old, newSelectedIds: [...this._selectedIds] });
  }

  /**
   * 移除选中元素并发出变更事件。
   * @param ids 待移除元素 ID
   */
  removeSelectedItems (ids: string[]): void {
    const old = [...this._selectedIds];

    this._selectedIds = this._selectedIds.filter(id => !ids.includes(id));
    if (this._selectedIds.length !== old.length) {
      this.updateFocusedGroupFromSelection(this._selectedIds);
      this.emit('selectionchange', { oldSelectedIds: old, newSelectedIds: [...this._selectedIds] });
    }
  }

  /** 清空选中元素并发出变更事件。 */
  clearSelectedItems (): void {
    if (this._selectedIds.length === 0) {
      return;
    }
    const old = [...this._selectedIds];

    this._selectedIds = [];
    this.emit('selectionchange', { oldSelectedIds: old, newSelectedIds: [] });
  }

  /**
   * 替换选中元素并发出变更事件。
   * @param ids 新的选中元素 ID
   */
  setSelectedItems (ids: string[]): void {
    this.commitSelectedItems(ids);
  }

  /**
   * 原子更新选中元素、焦点容器和变更事件。
   * @param ids 新的选中元素 ID
   * @returns 选中集是否发生变化
   */
  commitSelectedItems (ids: string[]): boolean {
    const next = this.normalizeHierarchySelection(ids);

    if (this.sameIds(this._selectedIds, next)) {
      return false;
    }
    const old = [...this._selectedIds];

    this._selectedIds = next;
    this.updateFocusedGroupFromSelection(next);
    this.emit('selectionchange', {
      oldSelectedIds: old,
      newSelectedIds: [...next],
    });

    return true;
  }

  /**
   * 将元素加入选中集合并同步焦点容器，不发出事件。
   * @param id 元素 ID
   * @returns 更新后的选中元素 ID
   */
  addSelectedItem (id: string): string[] {
    this._selectedIds = this.normalizeHierarchySelection([...this._selectedIds, id]);
    this.updateFocusedGroupFromSelection(this._selectedIds);

    return this._selectedIds;
  }

  /** 清空选中集，不发出事件。 */
  clear (): void {
    this._selectedIds = [];
  }

  /**
   * 直接替换选中集，不发出事件。
   * @param ids 新的选中元素 ID
   */
  setSelectedIds (ids: string[]): void {
    this._selectedIds = this.normalizeHierarchySelection(ids);
    this.updateFocusedGroupFromSelection(this._selectedIds);
  }

  /**
   * 处理双击点选，并允许穿透已选父元素。
   * @param event 鼠标事件
   * @returns 命中的元素 id；无命中返回 undefined
   */
  pickOnDoubleClick (event: InputEventMouseButton): string | undefined {
    this.interactionStartSelectedIds = [...this._selectedIds];

    const point = new Vector2(event.position.x, event.position.y);
    const hitIds = this.hitTest(point);
    const regionIds = this.filterItemsByHierarchy(
      hitIds,
      group => !this.isItemSelected(group.getInstanceId()),
    );

    if (regionIds.length === 0) {
      return undefined;
    }
    const hitId = regionIds[0];

    if (!event.shiftPressed) {
      this._selectedIds = [];
    } else {
      const parent = getPlayerItemById(this.engine.sceneServer.compositions[0], hitId)?.parent;

      if (parent) {
        this._selectedIds = this._selectedIds.filter(id => id !== parent.getInstanceId());
      }
    }

    this.addSelectedItem(hitId);

    return hitId;
  }

  /**
   * 处理单击点选，Shift 按键用于切换命中元素的选中状态。
   * @param event 鼠标事件
   * @returns 命中的元素 id；无命中返回 undefined
   */
  pickOnClick (event: InputEventMouseButton): string | undefined {
    this.interactionStartSelectedIds = [...this._selectedIds];

    const point = new Vector2(event.position.x, event.position.y);
    const hitIds = this.hitTest(point);
    const regionIds = this.filterSelectedItems(hitIds);

    if (regionIds.length === 0) {
      if (!event.shiftPressed) {
        this._selectedIds = [];
      }

      return undefined;
    }
    let hitId = regionIds[0];

    if (!event.shiftPressed && this.isItemSelected(hitId)) {
      hitId = this.filterItemsByHierarchy(
        hitIds,
        group => !this.isItemSelected(group.getInstanceId()),
      )[0] ?? hitId;
    }

    if (event.shiftPressed) {
      if (this.isItemSelected(hitId)) {
        this._selectedIds = this._selectedIds.filter(id => id !== hitId);
      } else {
        this.addSelectedItem(hitId);
      }
    } else {
      this._selectedIds = [];
      this.addSelectedItem(hitId);
    }

    return hitId;
  }

  /**
   * 获取指定视图坐标下的可交互元素 ID。
   * @param point 视图坐标
   * @returns 按命中优先级排列的元素 ID
   */
  hitTest (point: Vector2): string[] {
    const playerComposition = this.engine.sceneServer.compositions[0];

    if (!playerComposition?.items) {
      return [];
    }
    const { x, y } = viewPositionToNDC(point, GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!));
    const result: HitTestResult = { ray: new Ray(), regions: [] };

    try {
      result.regions = playerComposition.hitTest(x, y, true);
      result.ray = playerComposition.getHitTestRay(x, y);
    } catch (e) {
      console.warn(e);
    }
    this.refreshResultRegions(result);
    const selectedIds = this.reorderHitTestResult(result, playerComposition).filter(id => id !== 'extra-camera' && !this.ignoreIds.includes(id) && !this.isIgnoredNameById(id) && getPlayerItemById(this.engine.sceneServer.compositions[0], id)?.type !== spec.ItemType.composition);

    return this.preSelectedFrameOutBound(point, selectedIds);
  }

  /**
   * 解析当前指针在焦点容器内的预选目标。
   * @param point 指针视图坐标
   * @returns 预选元素 ID
   */
  resolveHoverTarget (point: Vector2): string | undefined {
    return this.filterSelectedItems(this.hitTest(point))[0];
  }

  /**
   * 解析并提交当前指针的预选目标。
   * @param point 指针视图坐标
   */
  commitHoverTarget (point: Vector2): void {
    const itemId = this.resolveHoverTarget(point);

    this.setHoverOverlayTarget(itemId);
    this.commitHover(itemId);
  }

  /**
   * 设置当前工具的预选绘制目标。
   * @param itemId 元素 ID
   */
  setHoverOverlayTarget (itemId?: string): void {
    this.hoveringResults.overlayItemId = itemId;
  }

  /** 清空预选命中和绘制目标。 */
  clearHover (): void {
    this.setHoverOverlayTarget(undefined);
    this.commitHover(undefined);
  }

  /**
   * 按当前焦点容器过滤交互命中。
   * @param selectedIds 原始命中元素 ID
   * @returns 可选元素 ID
   */
  filterSelectedItems (selectedIds: string[]): string[] {
    return this.filterItemsByHierarchy(selectedIds);
  }

  /**
   * 添加忽略交互的元素 ID。
   * @param ids 元素 ID
   */
  addIgnoreIds (ids: string[]): void {
    ids.forEach(id => addItem(this.ignoreIds, id));
  }
  /**
   * 删除忽略交互的元素 ID。
   * @param ids 元素 ID
   */
  deleteIgnoreIds (ids: string[]): void {
    ids.forEach(id => {
      const index = this.ignoreIds.indexOf(id);

      if (index >= 0) {
        this.ignoreIds.splice(index, 1);
      }
    });
  }
  /**
   * 添加忽略交互的元素名称。
   * @param names 元素名称
   */
  addIgnoreNames (names: string[]): void {
    names.forEach(name => addItem(this.ignoreNames, name));
  }
  /**
   * 删除忽略交互的元素名称。
   * @param names 元素名称
   */
  deleteIgnoreNames (names: string[]): void {
    names.forEach(name => {
      const index = this.ignoreNames.indexOf(name);

      if (index >= 0) {
        this.ignoreNames.splice(index, 1);
      }
    });
  }
  /**
   * 替换忽略交互的元素名称。
   * @param names 元素名称
   */
  setIgnoreNames (names: string[]): void {
    this.ignoreNames = [...names];
  }

  /**
   * 查找指针下最上层的未选元素。
   * @param point 指针视图坐标
   * @returns 未选元素 ID
   */
  findUnselectedItem (point: Vector2): string | undefined {
    const id = this.filterSelectedItems(this.hitTest(point))[0] ?? '';

    if (!id) {
      return undefined;
    }

    return this.getSelectedScopeIdSet().has(id) ? undefined : id;
  }

  /**
   * 创建一次行为派发使用的选区命中快照。
   * @param point 命中检测坐标
   * @returns 选区命中快照
   */
  createHitSnapshot (point: Vector2): SelectionHitSnapshot {
    const hitIds = this.hitTest(point);
    const selectableIds = this.filterSelectedItems(hitIds);
    const drillableIds = this.filterItemsByHierarchy(
      hitIds,
      group => !this.isItemSelected(group.getInstanceId()),
    );
    const selectedScopeIds = this.getSelectedScopeIdSet();

    return {
      point: point.clone(),
      selectableIds: [...selectableIds],
      topmostId: selectableIds[0],
      selectedScopeHitIds: selectableIds.filter(id => selectedScopeIds.has(id)),
      drillTargetId: drillableIds[0],
    };
  }

  /**
   * 判断坐标是否位于当前焦点容器的视图范围内。
   * @param point 视图坐标
   * @returns 是否位于当前焦点容器内
   */
  isPointInFocusedGroup (point: Vector2): boolean {
    if (!this._focusedGroupId) {
      return false;
    }
    const group = getPlayerItemById(this.engine.sceneServer.compositions[0], this._focusedGroupId);

    if (!group) {
      return false;
    }
    const containerSize = GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!);
    const transform = getItemViewTransform(group, containerSize);

    return !!transform && transformedBoxContainsPoint(transform, point);
  }

  /**
   * 判断坐标是否落在当前选区的视图包围内。
   *
   * 单选保留元素变换后四边形的精确命中；多选使用与变换线框一致的
   * 整体轴对齐包围盒，使元素之间的选框空白区域也可用于拖动选区。
   * @param point 视图坐标
   * @returns 是否命中当前选区
   */
  isPointInSelectedViewBox (point: Vector2): boolean {
    const items = this.getSelectedPlayerItems();

    if (items.length === 0) {
      return false;
    }
    const containerSize = GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!);

    if (items.length === 1) {
      const transform = getItemViewTransform(items[0], containerSize);

      return !!transform && transformedBoxContainsPoint(transform, point);
    }

    const selectionBox = new Box2();

    for (const item of items) {
      const itemBox = getItemViewBox(item, containerSize);

      if (!itemBox.isEmpty()) {
        selectionBox.union(itemBox);
      }
    }

    return !selectionBox.isEmpty() && selectionBox.containsPoint(point);
  }

  /**
   * 判断坐标是否位于当前特效编辑容器的视图范围内。
   * @param point 视图坐标
   * @returns 是否位于当前特效容器内
   */
  isPointInEffectsEditScope (point: Vector2): boolean {
    if (!this._effectsEditItemId) {
      return false;
    }
    const effectsItem = getPlayerItemById(this.engine.sceneServer.compositions[0], this._effectsEditItemId);

    if (!effectsItem) {
      return false;
    }
    const containerSize = GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!);
    const transform = getItemViewTransform(effectsItem, containerSize);

    return !!transform && transformedBoxContainsPoint(transform, point);
  }

  /**
   * 将框选候选按当前特效编辑范围解析为可选元素。
   *
   * 默认模式把特效子树归并为容器；特效编辑模式只保留当前容器的内部元素。
   * @param item 原始播放器元素
   * @returns 当前模式下的框选候选；不可选时返回 undefined
   */
  resolveMarqueeSelectableItem (item: VFXItem): VFXItem | undefined {
    const effectsOwner = getEffectsPlayerItemOwner(item);

    if (!this._effectsEditItemId) {
      return effectsOwner ?? item;
    }
    if (
      effectsOwner?.getInstanceId() !== this._effectsEditItemId
      || item.getInstanceId() === this._effectsEditItemId
      || item.type === spec.ItemType.composition
    ) {
      return undefined;
    }

    return item;
  }

  /**
   * 提交预选结果并在变化时发出事件。
   * @param itemId 预选元素 ID
   */
  private commitHover (itemId: string | undefined): void {
    const previousId = this.hoveringResults.itemId;

    if (itemId === previousId) {
      return;
    }
    this.hoveringResults.itemId = itemId;
    this.emit('preselectchange', { preSelectedId: itemId });
  }

  /**
   * 按场景层级归并原始命中元素。
   * @param selectedIds 原始命中元素 ID
   * @param groupFilter 可选的父组过滤条件
   * @returns 归并后的元素 ID
   */
  private filterItemsByHierarchy (
    selectedIds: string[],
    groupFilter?: (group: VFXItem) => boolean,
  ): string[] {
    const resultSelectedIds: string[] = [];

    selectedIds.forEach(id => {
      const item = getPlayerItemById(this.engine.sceneServer.compositions[0], id);

      if (!item) {
        return;
      }
      const effectsOwner = getEffectsPlayerItemOwner(item);

      if (
        this._effectsEditItemId
        && effectsOwner?.getInstanceId() !== this._effectsEditItemId
      ) {
        return;
      }
      if (effectsOwner) {
        const effectsOwnerId = effectsOwner.getInstanceId();

        if (!this._effectsEditItemId) {
          if (!this.ignoreIds.includes(effectsOwnerId) && !this.isIgnoredNameById(effectsOwnerId)) {
            addItem(resultSelectedIds, effectsOwnerId);
          }

          return;
        }
        if (effectsOwnerId !== this._effectsEditItemId || id === effectsOwnerId) {
          return;
        }
      }

      const selectableItem = this.getOutermostSelectableItem(item, groupFilter);

      if (selectableItem) {
        addItem(resultSelectedIds, selectableItem.getInstanceId());
      }
    });

    return resultSelectedIds;
  }

  /**
   * 获取不高于当前焦点容器的最外层可选元素。
   * @param item 原始命中元素
   * @param groupFilter 可选的父组过滤条件
   * @returns 当前层级可选元素
   */
  private getOutermostSelectableItem (
    item: VFXItem,
    groupFilter?: (group: VFXItem) => boolean,
  ): VFXItem | undefined {
    const effectsOwner = getEffectsPlayerItemOwner(item);
    const focusedGroup = this._focusedGroupId
      ? getPlayerItemById(this.engine.sceneServer.compositions[0], this._focusedGroupId)
      : undefined;
    let match = this.isDirectlySelectable(item) ? item : undefined;
    let node: VFXItem | undefined = item;

    while (node) {
      if (effectsOwner && node === effectsOwner) {
        break;
      }

      if (focusedGroup?.getInstanceId() === node.getInstanceId()) {
        break;
      }

      if (
        this.isSelectableGroup(node)
        && !this.isRuntimeAncestor(node, focusedGroup)
        && (groupFilter?.(node) ?? true)
      ) {
        match = node;
      }
      node = node.parent;
    }

    return match;
  }

  /**
   * 判断元素名称是否在忽略列表中。
   * @param id 元素 ID
   * @returns 是否忽略该元素
   */
  private isIgnoredNameById (id: string): boolean {
    if (this.ignoreNames.length === 0) {
      return false;
    }
    const item = getPlayerItemById(this.engine.sceneServer.compositions[0], id);

    return !!item && this.ignoreNames.includes(item.name);
  }

  /** @returns 选中元素及其后代组成的命中范围。 */
  private getSelectedScopeIdSet (): Set<string> {
    const ids = new Set(this._selectedIds);
    const selectedItems = this._selectedIds
      .map(id => getPlayerItemById(this.engine.sceneServer.compositions[0], id))
      .filter((item): item is VFXItem => !!item);

    for (const item of selectedItems) {
      for (const child of getItemChildren(item)) {
        ids.add(child.getInstanceId());
      }
    }

    return ids;
  }

  /**
   * 将特效子元素命中区域归并到特效容器。
   * @param hitTestResult 原始命中结果
   */
  private refreshResultRegions (hitTestResult: HitTestResult): void {
    const playerComposition = this.engine.sceneServer.compositions[0];

    if (!playerComposition || this._effectsEditItemId) {
      return;
    }
    const effectsItems = playerComposition.items.filter(item => item.name === '特效' && item.getComponent(FrameComponent) !== undefined);
    const effectsItemMap = new Map<string, string>();

    effectsItems.forEach(item => {
      const compositionChild = item.children?.[0];

      if (compositionChild?.type === spec.ItemType.composition) {
        compositionChild.children.forEach(subChild => {
          effectsItemMap.set(subChild.getInstanceId(), item.getInstanceId());
        });
      }
    });
    hitTestResult.regions.forEach(region => {
      region.id = effectsItemMap.get(region.id) ?? region.id;
    });
  }

  /**
   * 按渲染顺序和深度整理命中结果。
   * @param hitTestResult 原始命中结果
   * @param playerComposition 播放合成
   * @returns 排序后的元素 ID
   */
  private reorderHitTestResult (hitTestResult: HitTestResult, playerComposition: Composition): string[] {
    // 1. 校验命中区域并按渲染顺序反转。
    if (hitTestResult.regions.length === 0 || !playerComposition) {
      return [];
    }
    const { ray } = hitTestResult;
    const regions = hitTestResult.regions.reverse();
    const results: [string, number][] = [];

    // 2. 解析区域对应元素及其射线距离。
    regions.forEach(region => {
      let item: VFXItem | undefined;
      /**
       * 在元素树中查找命中区域。
       * @param items 当前元素列表
       * @param id 目标元素 ID
       */
      const dfsItem = (items: VFXItem[], id: string) => {
        for (const i of items) {
          if (i.getInstanceId() === id) {
            item = i;
          }
          if (item) {
            return;
          }
          dfsItem(i.children, id);
        }
      };

      dfsItem(playerComposition.items, region.id);
      if (item === undefined) {
        return;
      }
      const targetItemId = item.getInstanceId();
      const distance = ray.origin.clone().distance(region.position.clone());
      const isNeedDepthTest = item.type === spec.ItemType.mesh
        || item.getComponent(SpriteComponent)?.renderer?.occlusion
        || item.getComponent(TextComponent)?.renderer?.occlusion
        || item.getComponent(VideoComponent)?.renderer?.occlusion
        || item.getComponent(RichTextComponent)?.renderer?.occlusion;

      // 3. 需要深度测试的元素按射线距离插入，其余保留渲染顺序。
      if (isNeedDepthTest && results.length > 0) {
        let tryAdd = true;

        results.forEach((result, i) => {
          if (!tryAdd) {
            return;
          }
          if (distance <= result[1]) {
            results.splice(i, 0, [targetItemId, distance]);
            tryAdd = false;

            return;
          }
          if (i === results.length - 1) {
            results.push([targetItemId, distance]);
          }
        });
      } else {
        results.push([targetItemId, distance]);
      }
    });

    // 4. 返回排序后的元素 ID。
    return results.map(result => result[0]);
  }

  /**
   * 将画板左上角扩展交互区的命中加入结果。
   * @param mouse 指针视图坐标
   * @param currentSelectedIds 当前命中元素 ID
   * @returns 补充画板后的命中元素 ID
   */
  private preSelectedFrameOutBound (mouse: Vector2, currentSelectedIds: string[]): string[] {
    const playerComposition = this.engine.sceneServer.compositions[0];

    if (!playerComposition) {
      return currentSelectedIds;
    }
    const framePlayerItems = playerComposition.items.filter(item => isFramePlayerItem(item));
    const containerSize = GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!);
    const frameBoxInfoes = framePlayerItems.map(item => ({
      id: item.getInstanceId(),
      box: getItemViewBox(item, containerSize),
    }));

    if (!frameBoxInfoes?.length) {
      return currentSelectedIds;
    }
    let hasSelectedFrame = false;

    frameBoxInfoes.forEach(frameBoxInfo => {
      if (hasSelectedFrame) {
        return;
      }
      const { min } = frameBoxInfo.box;
      const interactionBox = setBoxFromPoints(new Box2(), [min.clone(), min.clone().add(new Vector2(FRAME_INTERACTION_WIDTH, -FRAME_INTERACTION_HEIGHT))]);

      if (interactionBox.containsPoint(mouse)) {
        hasSelectedFrame = true;
        currentSelectedIds.splice(0, 0, frameBoxInfo.id);
      }
    });

    return currentSelectedIds;
  }

  /**
   * 根据当前非空选区更新共同的最近父组；清空选区时保留已有焦点。
   * @param selectedIds 当前选中元素 ID
   */
  private updateFocusedGroupFromSelection (selectedIds: readonly string[]): void {
    if (selectedIds.length === 0) {
      return;
    }

    const selectedItems = selectedIds
      .map(id => getPlayerItemById(this.engine.sceneServer.compositions[0], id))
      .filter((item): item is VFXItem => !!item);

    if (selectedItems.length !== selectedIds.length) {
      this._focusedGroupId = undefined;

      return;
    }

    const ancestorLists = selectedItems.map(item => this.getGroupAncestors(item));
    const commonGroup = ancestorLists[0]?.find(candidate => (
      ancestorLists.slice(1).every(ancestors => (
        ancestors.some(group => group.getInstanceId() === candidate.getInstanceId())
      ))
    ));

    this._focusedGroupId = commonGroup?.getInstanceId();
  }

  /**
   * 获取元素从近到远的可聚焦父组。
   * @param item 当前元素
   * @returns 父组列表
   */
  private getGroupAncestors (item: VFXItem): VFXItem[] {
    const groups: VFXItem[] = [];
    let parent = item.parent;

    while (parent) {
      if (this._effectsEditItemId && parent.getInstanceId() === this._effectsEditItemId) {
        break;
      }
      if (this.isSelectableGroup(parent)) {
        groups.push(parent);
      }
      parent = parent.parent;
    }

    return groups;
  }

  /**
   * 判断元素是否可作为组内交互焦点。
   * @param item 待检查元素
   * @returns 是否为可聚焦 Group
   */
  private isSelectableGroup (item: VFXItem): boolean {
    const id = item.getInstanceId();

    return isGroupPlayerItem(item)
      && !this.ignoreIds.includes(id)
      && !this.isIgnoredNameById(id);
  }

  /**
   * 判断原始命中元素能否直接进入选区。
   * @param item 待检查元素
   * @returns 是否可直接选择
   */
  private isDirectlySelectable (item: VFXItem): boolean {
    const id = item.getInstanceId();

    return item.type !== spec.ItemType.composition
      && !this.ignoreIds.includes(id)
      && !this.isIgnoredNameById(id);
  }

  /**
   * 判断 ancestor 是否为 item 的运行时祖先。
   * @param ancestor 候选祖先
   * @param item 当前元素
   * @returns 是否存在祖先关系
   */
  private isRuntimeAncestor (ancestor: VFXItem, item: VFXItem | undefined): boolean {
    let parent = item?.parent;

    while (parent) {
      if (parent.getInstanceId() === ancestor.getInstanceId()) {
        return true;
      }
      parent = parent.parent;
    }

    return false;
  }

  /**
   * 将选区归一化为不存在祖先关系的节点集合。
   *
   * 按输入顺序处理，后加入的交互目标胜出：深入子元素会移除已选祖先，
   * 选择外层容器会移除已选后代
   * @param ids 待提交的选中 ID
   * @returns 保持稳定顺序的层级互斥选区
   */
  private normalizeHierarchySelection (ids: readonly string[]): string[] {
    const uniqueIds = Array.from(new Set(ids));
    const itemById = new Map<string, VFXItem>();
    /**
     * 一次遍历建立运行时节点索引，避免框选大量元素时反复搜索整棵树。
     * @param items 当前层节点
     */
    const collectItems = (items: VFXItem[]): void => {
      for (const item of items) {
        const id = item.getInstanceId();

        if (itemById.has(id)) {
          continue;
        }
        itemById.set(id, item);
        collectItems(item.children);
      }
    };

    collectItems(this.engine.sceneServer.compositions[0]?.items ?? []);

    const acceptedIds: string[] = [];
    const acceptedIdSet = new Set<string>();
    const acceptedAncestorIds = new Set<string>();

    // 从后向前处理，使本次交互最后加入的目标覆盖已有祖先或后代。
    for (let index = uniqueIds.length - 1; index >= 0; index--) {
      const id = uniqueIds[index];
      const ancestorIds: string[] = [];
      let parent = itemById.get(id)?.parent;

      while (parent) {
        ancestorIds.push(parent.getInstanceId());
        parent = parent.parent;
      }

      const hasAcceptedAncestor = ancestorIds.some(ancestorId => acceptedIdSet.has(ancestorId));
      const isAncestorOfAccepted = acceptedAncestorIds.has(id);

      if (hasAcceptedAncestor || isAncestorOfAccepted) {
        continue;
      }

      acceptedIds.push(id);
      acceptedIdSet.add(id);
      ancestorIds.forEach(ancestorId => acceptedAncestorIds.add(ancestorId));
    }

    return acceptedIds.reverse();
  }

  /**
   * 比较两个有序 ID 列表。
   * @param left 左侧 ID 列表
   * @param right 右侧 ID 列表
   * @returns 是否完全相同
   */
  private sameIds (left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((id, index) => id === right[index]);
  }
}
