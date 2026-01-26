import { VFXItem } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';

// 颜色常量
const COLORS = {
  lightBlue: new ImGui.ImVec4(0.25, 0.34, 0.43, 1.0),
  highlightBlue: new ImGui.ImVec4(0.0, 0.43, 0.87, 1.0),
  eyeActive: new ImGui.Vec4(0.72, 0.72, 0.72, 1.0),
  eyeInactive: new ImGui.Vec4(0.46, 0.46, 0.46, 1.0),
  eyeOutline: new ImGui.Vec4(0.6, 0.6, 0.6, 1.0),
  eyeSlash: new ImGui.Vec4(0.35, 0.35, 0.35, 1.0),
  inactiveText: new ImGui.Vec4(0.5, 0.5, 0.5, 1.0),
  searchIcon: new ImGui.Vec4(0.5, 0.5, 0.5, 1.0),
} as const;

// 布局常量
const LAYOUT = {
  visibilityColumnWidth: 16,
  visibilitySpacing: 6,
} as const;

@editorWindow()
export class Hierarchy extends EditorWindow {
  // 绘制顺序缓存（用于范围选择）
  private hierarchyDrawOrder: VFXItem[] = [];
  // 选择锚点（用于 Shift 范围选择）
  private hierarchySelectionAnchor: VFXItem | null = null;
  // 可见性列位置缓存
  private visibilityColumnLocalX = 0;
  private visibilityColumnScreenX = 0;

  // 搜索相关
  private searchFilter = '';
  private searchMatchedItems: Set<VFXItem> = new Set();
  private expandedForSearch: Set<VFXItem> = new Set();

  @menuItem('Window/Hierarchy')
  static showWindow () {
    EditorWindow.getWindow(Hierarchy).open();
  }

  constructor () {
    super();
    this.title = 'Hierarchy';
    this.open();
  }

  override onGUI () {
    const composition = GalaceanEffects.player.getCompositions()[0];

    if (!composition) {
      ImGui.End();

      return;
    }

    // 绘制搜索框
    this.drawSearchBar();

    // 重置绘制顺序缓存
    this.hierarchyDrawOrder.length = 0;
    if (Selection.getSelectedObjects().length === 0) {
      this.hierarchySelectionAnchor = null;
    }

    // 缓存可见性列位置
    this.visibilityColumnLocalX = ImGui.GetCursorPosX();
    this.visibilityColumnScreenX = ImGui.GetCursorScreenPos().x;

    // 设置选中样式
    this.pushSelectionColors();

    // 绘制树形结构
    const baseFlags = ImGui.TreeNodeFlags.OpenOnArrow |
      ImGui.TreeNodeFlags.OpenOnDoubleClick |
      ImGui.TreeNodeFlags.SpanAvailWidth;

    ImGui.SetCursorPosX(this.visibilityColumnLocalX + LAYOUT.visibilityColumnWidth + LAYOUT.visibilitySpacing);
    const compositionId = `composition_${composition.id}`;

    if (ImGui.TreeNodeEx(compositionId, baseFlags | ImGui.TreeNodeFlags.DefaultOpen, 'Composition')) {
      this.drawVFXItemTreeNode(composition.rootItem, baseFlags);
      ImGui.TreePop();
    }

    ImGui.PopStyleColor(3);
  }

  private drawSearchBar (): void {
    const availWidth = ImGui.GetContentRegionAvail().x;
    const iconSize = 16;
    const iconPadding = 4;

    // 绘制搜索图标
    const cursorPos = ImGui.GetCursorScreenPos();
    const frameHeight = ImGui.GetFrameHeight();
    const drawList = ImGui.GetWindowDrawList();
    const iconColor = ImGui.GetColorU32(COLORS.searchIcon);

    // 绘制放大镜圆圈 - 与输入框垂直居中对齐
    const circleCenter = new ImGui.Vec2(cursorPos.x + iconSize * 0.4, cursorPos.y + frameHeight * 0.4);
    const circleRadius = iconSize * 0.28;

    drawList.AddCircle(circleCenter, circleRadius, iconColor, 12, 1.5);

    // 绘制放大镜手柄
    const handleStart = new ImGui.Vec2(
      circleCenter.x + circleRadius * 0.7,
      circleCenter.y + circleRadius * 0.7
    );
    const handleEnd = new ImGui.Vec2(
      circleCenter.x + circleRadius * 1.8,
      circleCenter.y + circleRadius * 1.8
    );

    drawList.AddLine(handleStart, handleEnd, iconColor, 1.5);

    // 输入框左侧留出图标空间
    ImGui.SetCursorPosX(ImGui.GetCursorPosX() + iconSize + iconPadding);
    ImGui.PushItemWidth(availWidth - iconSize - iconPadding);

    const prevFilter = this.searchFilter;

    if (ImGui.InputTextWithHint('##HierarchySearch', 'Search...', (value = this.searchFilter) => this.searchFilter = value)) {
      // 搜索内容变化时更新匹配项
      if (this.searchFilter !== prevFilter) {
        this.updateSearchMatches();
      }
    }

    ImGui.PopItemWidth();

    // 显示搜索结果数量
    if (this.searchFilter.length > 0) {
      ImGui.SameLine();
      ImGui.TextDisabled(`(${this.searchMatchedItems.size})`);
    }

    ImGui.Separator();
  }

  private updateSearchMatches (): void {
    this.searchMatchedItems.clear();
    this.expandedForSearch.clear();

    if (this.searchFilter.length === 0) {
      return;
    }

    const composition = GalaceanEffects.player.getCompositions()[0];

    if (!composition) {
      return;
    }

    const filterLower = this.searchFilter.toLowerCase();

    // 递归搜索匹配项
    this.searchInItem(composition.rootItem, filterLower);
  }

  private searchInItem (item: VFXItem, filterLower: string): boolean {
    let hasMatchInSubtree = false;

    // 检查子项
    for (const child of item.children) {
      if (this.searchInItem(child, filterLower)) {
        hasMatchInSubtree = true;
      }
    }

    // 检查当前项是否匹配
    const nameMatches = item.name.toLowerCase().includes(filterLower);

    if (nameMatches) {
      this.searchMatchedItems.add(item);
      hasMatchInSubtree = true;
    }

    // 如果子树中有匹配项，展开当前节点
    if (hasMatchInSubtree && !nameMatches) {
      this.expandedForSearch.add(item);
    }

    return hasMatchInSubtree;
  }

  private isItemVisible (item: VFXItem): boolean {
    // 无搜索过滤时，所有项都可见
    if (this.searchFilter.length === 0) {
      return true;
    }

    // 匹配的项可见
    if (this.searchMatchedItems.has(item)) {
      return true;
    }

    // 需要展开以显示匹配子项的项可见
    if (this.expandedForSearch.has(item)) {
      return true;
    }

    return false;
  }

  private pushSelectionColors (): void {
    if (ImGui.IsWindowFocused()) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, COLORS.highlightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, COLORS.lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, COLORS.highlightBlue);
    } else {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, COLORS.lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, COLORS.lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, COLORS.lightBlue);
    }
  }

  private drawVFXItemTreeNode (item: VFXItem, baseFlags: ImGui.TreeNodeFlags): void {
    // 搜索过滤
    if (!this.isItemVisible(item)) {
      return;
    }

    this.hierarchyDrawOrder.push(item);

    const isSelected = Selection.isSelected(item);
    const shouldForceOpen = this.expandedForSearch.has(item);

    // 构建节点标志
    let nodeFlags: ImGui.TreeNodeFlags = baseFlags;

    if (isSelected) {
      nodeFlags |= ImGui.TreeNodeFlags.Selected;
    }
    if (item.children.length === 0 || !this.hasVisibleChildren(item)) {
      nodeFlags |= ImGui.TreeNodeFlags.Leaf;
    }
    if (item.name === 'rootItem' || shouldForceOpen) {
      nodeFlags |= ImGui.TreeNodeFlags.DefaultOpen;
    }

    const isHoverSelectedNode = isSelected && ImGui.IsWindowFocused();

    if (isHoverSelectedNode) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, COLORS.highlightBlue);
    }

    // 设置非激活项的置灰文字颜色
    const needTextColorPop = !item.isActive;

    if (needTextColorPop) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, COLORS.inactiveText);
    }

    const itemId = `item_${item.getInstanceId()}`;

    ImGui.PushID(itemId);

    const drawList = ImGui.GetWindowDrawList();

    drawList.ChannelsSplit(2);
    drawList.ChannelsSetCurrent(1);

    const rowStartLocal = ImGui.GetCursorPos();
    const treeStartX = rowStartLocal.x + LAYOUT.visibilityColumnWidth + LAYOUT.visibilitySpacing;

    ImGui.SetCursorPos(new ImGui.Vec2(treeStartX, rowStartLocal.y));
    const nodeOpen = ImGui.TreeNodeEx(itemId, nodeFlags, item.name);

    // 恢复文字颜色
    if (needTextColorPop) {
      ImGui.PopStyleColor(1);
    }

    ImGui.SetItemAllowOverlap();
    const postTreeCursor = ImGui.GetCursorPos();
    const rowHovered = ImGui.IsItemHovered();
    const rowRectMin = ImGui.GetItemRectMin();
    const rowRectMax = ImGui.GetItemRectMax();
    const rowHeight = rowRectMax.y - rowRectMin.y;

    const buttonBounds = {
      min: new ImGui.Vec2(this.visibilityColumnScreenX, rowRectMin.y),
      max: new ImGui.Vec2(this.visibilityColumnScreenX + LAYOUT.visibilityColumnWidth, rowRectMin.y + rowHeight),
    };
    const buttonHovered = ImGui.IsMouseHoveringRect(buttonBounds.min, buttonBounds.max, false);
    const eyeClicking = buttonHovered && ImGui.IsMouseClicked(0);

    this.handleHierarchySelection(item, eyeClicking);

    if (isHoverSelectedNode) {
      ImGui.PopStyleColor(1);
    }

    // 绘制行背景
    const rowActive = ImGui.IsItemActive();
    const shouldHighlight = isSelected || rowHovered || rowActive || buttonHovered;

    drawList.ChannelsSetCurrent(0);
    if (shouldHighlight) {
      const windowPos = ImGui.GetWindowPos();
      const contentRegionMax = ImGui.GetWindowContentRegionMax();
      const rowBgMin = new ImGui.Vec2(this.visibilityColumnScreenX, rowRectMin.y);
      const rowBgMax = new ImGui.Vec2(windowPos.x + contentRegionMax.x, rowRectMin.y + rowHeight);
      const bgColor = isSelected
        ? ImGui.GetColorU32(ImGui.ImGuiCol.Header)
        : rowActive
          ? ImGui.GetColorU32(ImGui.ImGuiCol.HeaderActive)
          : ImGui.GetColorU32(ImGui.ImGuiCol.HeaderHovered);

      drawList.AddRectFilled(rowBgMin, rowBgMax, bgColor);
    }
    drawList.ChannelsSetCurrent(1);

    // 绘制可见性切换按钮
    ImGui.SetCursorPos(new ImGui.Vec2(this.visibilityColumnLocalX, rowStartLocal.y));
    const toggleTriggered = this.drawVisibilityToggle(item, buttonBounds, isSelected);

    ImGui.SetCursorPos(postTreeCursor);

    if (toggleTriggered) {
      this.toggleVisibility(item);
    }

    drawList.ChannelsMerge();

    // 递归绘制子节点
    if (nodeOpen) {
      for (const child of item.children) {
        this.drawVFXItemTreeNode(child, baseFlags);
      }
      ImGui.TreePop();
    }

    ImGui.PopID();
  }

  private hasVisibleChildren (item: VFXItem): boolean {
    if (this.searchFilter.length === 0) {
      return item.children.length > 0;
    }

    return item.children.some(child => this.isItemVisible(child));
  }

  private handleHierarchySelection (item: VFXItem, suppressSelection: boolean): void {
    if (suppressSelection) {
      return;
    }

    const itemClicked = ImGui.IsItemClicked();

    if (itemClicked && !ImGui.IsItemToggledOpen()) {
      const io = ImGui.GetIO();
      const additive = io.KeyCtrl || io.KeySuper;
      const range = io.KeyShift;

      if (range && this.hierarchySelectionAnchor && this.hierarchySelectionAnchor !== item) {
        this.applyRangeSelection(this.hierarchySelectionAnchor, item);
      } else if (additive) {
        this.toggleItemSelection(item);
      } else {
        Selection.select(item);
        this.hierarchySelectionAnchor = item;
      }
    }
  }

  private toggleItemSelection (item: VFXItem): void {
    if (Selection.isSelected(item)) {
      Selection.removeObject(item);
      if (this.hierarchySelectionAnchor === item) {
        const active = Selection.getSelectedObjects<VFXItem>()[0] ?? null;

        this.hierarchySelectionAnchor = active && Selection.isSelected(active) ? active : null;
      }
    } else {
      Selection.addObject(item);
      this.hierarchySelectionAnchor = item;
    }
  }

  private applyRangeSelection (anchor: VFXItem, target: VFXItem): void {
    const order = this.hierarchyDrawOrder;
    const anchorIndex = order.indexOf(anchor);
    const targetIndex = order.indexOf(target);

    if (anchorIndex === -1 || targetIndex === -1) {
      Selection.select(target);
      this.hierarchySelectionAnchor = target;

      return;
    }

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    const rangeItems = order.slice(start, end + 1);

    Selection.clear();
    for (const rangeItem of rangeItems) {
      Selection.addObject(rangeItem);
    }
  }

  private toggleVisibility (item: VFXItem): void {
    const targets = this.getVisibilityTargets(item);
    const nextState = !item.isVisible;

    for (const target of targets) {
      target.setVisible(nextState);
    }
  }

  private getVisibilityTargets (item: VFXItem): VFXItem[] {
    const selected = Selection.getSelectedObjects<VFXItem>()
      .filter((obj): obj is VFXItem => obj instanceof VFXItem);
    const result = new Set<VFXItem>();

    // 如果有多选，包含所有选中项及其子项
    if (selected.length > 1) {
      for (const candidate of selected) {
        result.add(candidate);
        this.collectDescendants(candidate, result);
      }
    }

    // 确保当前点击的项也被包含
    if (!result.has(item)) {
      result.add(item);
      this.collectDescendants(item, result);
    }

    return Array.from(result);
  }

  private collectDescendants (item: VFXItem, collection: Set<VFXItem>): void {
    for (const child of item.children) {
      collection.add(child);
      this.collectDescendants(child, collection);
    }
  }

  private drawVisibilityToggle (item: VFXItem, bounds: { min: ImGui.Vec2, max: ImGui.Vec2 }, isSelected: boolean): boolean {
    const size = new ImGui.Vec2(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);

    ImGui.SetCursorScreenPos(bounds.min);
    ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FramePadding, new ImGui.Vec2(0, 0));
    const clicked = ImGui.InvisibleButton('visibility_toggle', size);

    ImGui.PopStyleVar(1);

    const drawList = ImGui.GetWindowDrawList();
    const center = new ImGui.Vec2((bounds.min.x + bounds.max.x) * 0.5, (bounds.min.y + bounds.max.y) * 0.5);
    const extent = Math.min(size.x, size.y);
    const halfEyeWidth = Math.max(extent * 0.4, 3.9);
    const halfEyeHeight = Math.max(extent * 0.2, 2.1);
    const outlineColor = ImGui.GetColorU32(COLORS.eyeOutline);
    const thickness = isSelected ? 1.6 : 1.15;
    const arcSteps = 10;

    // 绘制眼睛上半部分
    let previous = new ImGui.Vec2(center.x - halfEyeWidth, center.y);

    for (let i = 1; i <= arcSteps; i++) {
      const t = i / arcSteps;
      const x = center.x - halfEyeWidth + halfEyeWidth * 2 * t;
      const y = center.y - Math.sin(t * Math.PI) * halfEyeHeight;
      const point = new ImGui.Vec2(x, y);

      drawList.AddLine(previous, point, outlineColor, thickness);
      previous = point;
    }

    // 绘制眼睛下半部分
    previous = new ImGui.Vec2(center.x + halfEyeWidth, center.y);
    for (let i = 1; i <= arcSteps; i++) {
      const t = i / arcSteps;
      const x = center.x + halfEyeWidth - halfEyeWidth * 2 * t;
      const y = center.y + Math.sin(t * Math.PI) * halfEyeHeight;
      const point = new ImGui.Vec2(x, y);

      drawList.AddLine(previous, point, outlineColor, thickness);
      previous = point;
    }

    // 绘制瞳孔
    const pupilRadius = Math.max(extent * 0.2, 1.8);

    if (item.isVisible) {
      drawList.AddCircleFilled(center, pupilRadius, ImGui.GetColorU32(COLORS.eyeActive), 12);
    } else {
      drawList.AddCircle(center, pupilRadius, ImGui.GetColorU32(COLORS.eyeInactive), 14, 1.1);
      // 绘制斜线表示不可见
      drawList.AddLine(
        new ImGui.Vec2(center.x - halfEyeWidth * 0.82, center.y + halfEyeHeight * 0.85),
        new ImGui.Vec2(center.x + halfEyeWidth * 0.82, center.y - halfEyeHeight * 0.85),
        ImGui.GetColorU32(COLORS.eyeSlash),
        1.5
      );
    }

    return clicked;
  }
}