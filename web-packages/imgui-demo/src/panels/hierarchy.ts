import type { Composition } from '@galacean/effects';
import { spec, VFXItem } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';
import { EditorColors } from './theme';
import { searchBar } from '../widgets';

// 颜色常量
const COLORS = {
  selectionFocused: EditorColors.selectionFocused,
  selectionUnfocused: EditorColors.selectionUnfocused,
  eyeActive: EditorColors.iconActive,
  eyeInactive: new ImGui.Vec4(0.46, 0.46, 0.46, 1.0),
  eyeOutline: new ImGui.Vec4(0.6, 0.6, 0.6, 1.0),
  eyeSlash: new ImGui.Vec4(0.35, 0.35, 0.35, 1.0),
  inactiveText: EditorColors.textSecondary,
  searchIcon: EditorColors.iconDefault,
} as const;

// 布局常量
const LAYOUT = {
  visibilityColumnWidth: 16,
  visibilitySpacing: 6,
  iconPadding: '   ',
} as const;

@editorWindow()
export class Hierarchy extends EditorWindow {
  // 扁平 item 列表（用于原生多选的 index ↔ 对象映射）
  private flatItemList: (VFXItem | Composition)[] = [];
  // 可见性列位置缓存
  private visibilityColumnLocalX = 0;
  private visibilityColumnScreenX = 0;

  // 搜索相关
  private searchFilterBuffer: ImGui.ImScalar<string> = [''];
  private searchMatchedItems: VFXItem[] = [];

  private get searchFilter (): string {
    return this.searchFilterBuffer[0];
  }

  private set searchFilter (value: string) {
    this.searchFilterBuffer[0] = value;
  }

  // 自动展开相关
  private itemsToExpand: Set<VFXItem> = new Set();
  private lastSelectedItem: VFXItem | null = null;
  private wasInSearchMode = false;

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
      return;
    }

    // 绘制搜索框
    this.drawSearchBar();

    // 构建扁平 item 列表（用于原生多选的 index ↔ 对象映射）
    this.buildFlatItemList(composition);

    // 检测选中项变化，自动展开到选中元素
    this.checkSelectionChanged();

    // 缓存可见性列位置
    this.visibilityColumnLocalX = ImGui.GetCursorPosX();
    this.visibilityColumnScreenX = ImGui.GetCursorScreenPos().x;

    // 选中样式（与 sequencer 轨道选中色一致：#408CE6）
    // 聚焦时用亮蓝色，非聚焦时用暗淡灰蓝色
    if (ImGui.IsWindowFocused()) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, new ImGui.Vec4(0.25, 0.55, 0.90, 0.45));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, new ImGui.Vec4(0.25, 0.55, 0.90, 0.65));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, new ImGui.Vec4(0.25, 0.55, 0.90, 0.80));
    } else {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, new ImGui.Vec4(0.25, 0.55, 0.90, 0.20));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, new ImGui.Vec4(0.25, 0.55, 0.90, 0.20));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, new ImGui.Vec4(0.25, 0.55, 0.90, 0.20));
    }
    // 开始原生多选
    const selectionSize = Selection.getSelectedObjects().length;

    // 有选中项时显示蓝色导航边框，无选中项时隐藏避免残留
    if (selectionSize > 0) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.NavCursor, new ImGui.Vec4(0.25, 0.55, 0.90, 0.80));
    } else {
      ImGui.PushStyleColor(ImGui.ImGuiCol.NavCursor, new ImGui.Vec4(0, 0, 0, 0));
    }
    const msFlags = ImGui.MultiSelectFlags.ClearOnEscape
      | ImGui.MultiSelectFlags.ClearOnClickVoid;
    const msIo = ImGui.BeginMultiSelect(msFlags, selectionSize, this.flatItemList.length);

    if (msIo) {
      this.applyMultiSelectRequests(msIo);
    }

    // 如果有搜索条件，显示平铺的搜索结果
    if (this.searchFilter.length > 0) {
      this.drawFlatSearchResults();
    } else {
      // 正常的树形结构
      const baseFlags = ImGui.TreeNodeFlags.OpenOnArrow |
        ImGui.TreeNodeFlags.OpenOnDoubleClick |
        ImGui.TreeNodeFlags.SpanAvailWidth;

      const compositionId = `composition_${composition.id}`;

      // Composition 选中状态
      const isCompositionSelected = Selection.isSelected(composition);
      let compositionFlags = baseFlags | ImGui.TreeNodeFlags.DefaultOpen;

      if (isCompositionSelected) {
        compositionFlags |= ImGui.TreeNodeFlags.Selected;
      }

      // Composition 箭头与小眼睛右侧对齐
      ImGui.SetCursorPosX(this.visibilityColumnLocalX + LAYOUT.visibilityColumnWidth + LAYOUT.visibilitySpacing);

      // 设置 Composition 的多选用户数据（index 0）
      ImGui.SetNextItemSelectionUserData(0);
      const compositionNodeOpen = ImGui.TreeNodeEx(compositionId, compositionFlags, 'Composition');

      // 处理 Composition 的多选切换
      if (ImGui.IsItemToggledSelection()) {
        if (Selection.isSelected(composition)) {
          Selection.removeObject(composition);
        } else {
          Selection.addObject(composition);
        }
      }

      if (compositionNodeOpen) {
        this.drawVFXItemTreeNode(composition.rootItem, baseFlags);
        ImGui.TreePop();
      }
    }

    // 结束原生多选
    const msIoEnd = ImGui.EndMultiSelect();

    if (msIoEnd) {
      this.applyMultiSelectRequests(msIoEnd);
    }

    ImGui.PopStyleColor(4);
  }

  private drawSearchBar (): void {
    if (searchBar('##HierarchySearch', this.searchFilterBuffer)) {
      this.updateSearchMatches();
    }
    ImGui.Dummy(new ImGui.Vec2(0, 6));
  }

  private checkSelectionChanged (): void {
    const selectedItems = Selection.getSelectedObjects<VFXItem>()
      .filter((obj): obj is VFXItem => obj instanceof VFXItem);
    const currentSelected = selectedItems[0] ?? null;
    const isInSearchMode = this.searchFilter.length > 0;

    // 检测从搜索模式退出
    if (this.wasInSearchMode && !isInSearchMode && currentSelected) {
      this.expandToItem(currentSelected);
    }

    // 检测选中项是否变化
    if (currentSelected !== this.lastSelectedItem) {
      this.lastSelectedItem = currentSelected;

      // 如果有选中项且不在搜索模式，展开到选中元素
      if (currentSelected && !isInSearchMode) {
        this.expandToItem(currentSelected);
      }
    }

    this.wasInSearchMode = isInSearchMode;
  }

  private expandToItem (item: VFXItem): void {
    let parent = item.parent;

    while (parent) {
      this.itemsToExpand.add(parent);
      parent = parent.parent;
    }
  }

  private updateSearchMatches (): void {
    this.searchMatchedItems = [];

    if (this.searchFilter.length === 0) {
      return;
    }

    const composition = GalaceanEffects.player.getCompositions()[0];

    if (!composition) {
      return;
    }

    const filterLower = this.searchFilter.toLowerCase();

    // 递归收集所有匹配项（平铺列表）
    this.collectMatchedItems(composition.rootItem, filterLower);
  }

  private collectMatchedItems (item: VFXItem, filterLower: string): void {
    // 检查当前项是否匹配
    if (item.name.toLowerCase().includes(filterLower)) {
      this.searchMatchedItems.push(item);
    }

    // 递归检查子项
    for (const child of item.children) {
      this.collectMatchedItems(child, filterLower);
    }
  }

  private drawVFXItemTreeNode (item: VFXItem, baseFlags: ImGui.TreeNodeFlags): void {
    const isSelected = Selection.isSelected(item);
    const shouldForceOpen = this.itemsToExpand.has(item);

    // 构建节点标志
    let nodeFlags: ImGui.TreeNodeFlags = baseFlags;

    if (isSelected) {
      nodeFlags |= ImGui.TreeNodeFlags.Selected;
    }
    if (item.children.length === 0) {
      nodeFlags |= ImGui.TreeNodeFlags.Leaf;
    }
    if (item.name === 'rootItem') {
      nodeFlags |= ImGui.TreeNodeFlags.DefaultOpen;
    }

    // 使用 SetNextItemOpen 强制展开节点（这会覆盖缓存的状态）
    if (shouldForceOpen) {
      ImGui.SetNextItemOpen(true);
      this.itemsToExpand.delete(item);
    }

    // 设置非激活项的置灰文字颜色
    const needTextColorPop = !item.isActive;

    if (needTextColorPop) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, COLORS.inactiveText);
    }

    const itemId = `item_${item.getInstanceId()}`;

    ImGui.PushID(itemId);

    const rowStartLocal = ImGui.GetCursorPos();
    const treeStartX = rowStartLocal.x + LAYOUT.visibilityColumnWidth + LAYOUT.visibilitySpacing;

    ImGui.SetCursorPos(new ImGui.Vec2(treeStartX, rowStartLocal.y));

    // 设置原生多选用户数据
    const itemIndex = this.flatItemList.indexOf(item);

    ImGui.SetNextItemSelectionUserData(itemIndex);
    const nodeOpen = ImGui.TreeNodeEx(itemId, nodeFlags, LAYOUT.iconPadding + item.name);

    // 处理原生多选切换
    if (ImGui.IsItemToggledSelection()) {
      if (Selection.isSelected(item)) {
        Selection.removeObject(item);
      } else {
        Selection.addObject(item);
      }
    }

    // 恢复文字颜色
    if (needTextColorPop) {
      ImGui.PopStyleColor(1);
    }

    ImGui.SetNextItemAllowOverlap();
    const rowRectMin = ImGui.GetItemRectMin();
    const rowRectMax = ImGui.GetItemRectMax();
    const rowHeight = rowRectMax.y - rowRectMin.y;

    // 绘制类型图标
    const drawList = ImGui.GetWindowDrawList();

    this.drawItemTypeIcon(drawList, item.type, rowRectMin, rowHeight);

    // 绘制可见性切换按钮
    const buttonBounds = {
      min: new ImGui.Vec2(this.visibilityColumnScreenX, rowRectMin.y),
      max: new ImGui.Vec2(this.visibilityColumnScreenX + LAYOUT.visibilityColumnWidth, rowRectMin.y + rowHeight),
    };
    const toggleTriggered = this.drawVisibilityToggle(item, buttonBounds, isSelected);

    if (toggleTriggered) {
      this.toggleVisibility(item);
    }

    // 递归绘制子节点
    if (nodeOpen) {
      for (const child of item.children) {
        this.drawVFXItemTreeNode(child, baseFlags);
      }
      ImGui.TreePop();
    }

    ImGui.PopID();
  }

  private drawFlatSearchResults (): void {
    const baseFlags = ImGui.TreeNodeFlags.Leaf |
      ImGui.TreeNodeFlags.NoTreePushOnOpen |
      ImGui.TreeNodeFlags.SpanAvailWidth;

    for (const item of this.searchMatchedItems) {
      const isSelected = Selection.isSelected(item);
      let nodeFlags = baseFlags;

      if (isSelected) {
        nodeFlags |= ImGui.TreeNodeFlags.Selected;
      }

      // 设置非激活项的置灰文字颜色
      const needTextColorPop = !item.isActive;

      if (needTextColorPop) {
        ImGui.PushStyleColor(ImGui.ImGuiCol.Text, COLORS.inactiveText);
      }

      const itemId = `search_item_${item.getInstanceId()}`;

      ImGui.PushID(itemId);

      const rowStartLocal = ImGui.GetCursorPos();
      const treeStartX = rowStartLocal.x + LAYOUT.visibilityColumnWidth + LAYOUT.visibilitySpacing;

      ImGui.SetCursorPos(new ImGui.Vec2(treeStartX, rowStartLocal.y));

      // 设置原生多选用户数据
      const itemIndex = this.flatItemList.indexOf(item);

      ImGui.SetNextItemSelectionUserData(itemIndex);
      ImGui.SetNextItemAllowOverlap();
      ImGui.TreeNodeEx(itemId, nodeFlags, LAYOUT.iconPadding + item.name);

      // 处理原生多选切换
      if (ImGui.IsItemToggledSelection()) {
        if (Selection.isSelected(item)) {
          Selection.removeObject(item);
        } else {
          Selection.addObject(item);
        }
      }

      // 恢复文字颜色
      if (needTextColorPop) {
        ImGui.PopStyleColor(1);
      }

      const rowRectMin = ImGui.GetItemRectMin();
      const rowRectMax = ImGui.GetItemRectMax();
      const rowHeight = rowRectMax.y - rowRectMin.y;

      // 绘制类型图标
      const drawList = ImGui.GetWindowDrawList();

      this.drawItemTypeIcon(drawList, item.type, rowRectMin, rowHeight);

      // 绘制可见性切换按钮
      const buttonBounds = {
        min: new ImGui.Vec2(this.visibilityColumnScreenX, rowRectMin.y),
        max: new ImGui.Vec2(this.visibilityColumnScreenX + LAYOUT.visibilityColumnWidth, rowRectMin.y + rowHeight),
      };
      const toggleTriggered = this.drawVisibilityToggle(item, buttonBounds, isSelected);

      if (toggleTriggered) {
        this.toggleVisibility(item);
      }

      ImGui.PopID();
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

  /**
   * 手动处理 ImGuiMultiSelectIO 的请求（Clear/SelectAll/SetRange）
   */
  private applyMultiSelectRequests (msIo: ImGui.ImGuiMultiSelectIO): void {
    for (const request of msIo.Requests) {
      if (request.Type === ImGui.SelectionRequestType.SetAll) {
        if (request.Selected) {
          for (const item of this.flatItemList) {
            Selection.addObject(item);
          }
        } else {
          Selection.clear();
        }
      } else if (request.Type === ImGui.SelectionRequestType.SetRange) {
        const rangeStart = Math.min(request.RangeFirstItem, request.RangeLastItem);
        const rangeEnd = Math.max(request.RangeFirstItem, request.RangeLastItem);

        for (let idx = rangeStart; idx <= rangeEnd; idx++) {
          const item = this.flatItemList[idx];

          if (item) {
            if (request.Selected) {
              Selection.addObject(item);
            } else {
              Selection.removeObject(item);
            }
          }
        }
      }
    }
  }

  /**
   * 构建扁平 item 列表（composition + 所有 VFXItem），用于原生多选的 index ↔ 对象映射
   */
  private buildFlatItemList (composition: Composition): void {
    this.flatItemList.length = 0;
    // composition 自身作为第一个 item
    this.flatItemList.push(composition);
    // 递归收集所有 VFXItem
    this.collectItemsFlat(composition.rootItem);
  }

  private collectItemsFlat (item: VFXItem): void {
    this.flatItemList.push(item);
    for (const child of item.children) {
      this.collectItemsFlat(child);
    }
  }

  private drawItemTypeIcon (drawList: ImGui.ImDrawList, itemType: spec.ItemType, rowRectMin: ImGui.Vec2, rowHeight: number): void {
    // 图标中心：树节点箭头之后，文本之前
    const fontSize = ImGui.GetFontSize();
    const cx = rowRectMin.x + fontSize + 8;
    const cy = rowRectMin.y + rowHeight / 2;
    const lw = 1.5; // 稍粗的描边增加现代感

    switch (itemType) {
      case spec.ItemType.sprite: {
        // 图片/图层 — 扁平化圆角矩形背景 + 实心山峰 + 太阳
        const cBg = ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.6, 1.0, 0.2));
        const cFg = ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.6, 1.0, 1.0));

        drawList.AddRectFilled(new ImGui.Vec2(cx - 5.5, cy - 4.5), new ImGui.Vec2(cx + 5.5, cy + 4.5), cBg, 2);
        drawList.AddRect(new ImGui.Vec2(cx - 5.5, cy - 4.5), new ImGui.Vec2(cx + 5.5, cy + 4.5), cFg, 2, 0, 1.2);
        drawList.AddTriangleFilled(new ImGui.Vec2(cx - 5, cy + 3.5), new ImGui.Vec2(cx - 1, cy - 1), new ImGui.Vec2(cx + 2, cy + 3.5), cFg);
        drawList.AddTriangleFilled(new ImGui.Vec2(cx - 1, cy + 3.5), new ImGui.Vec2(cx + 2, cy + 0.5), new ImGui.Vec2(cx + 5, cy + 3.5), cFg);
        drawList.AddCircleFilled(new ImGui.Vec2(cx + 2.5, cy - 1.5), 1.2, cFg, 6);

        break;
      }
      case spec.ItemType.particle: {
        // 粒子/火花 — 更复杂、对称的八角星芒与散落粒子
        const cCore = ImGui.GetColorU32(new ImGui.Vec4(1.0, 0.9, 0.4, 1.0));
        const cGlow = ImGui.GetColorU32(new ImGui.Vec4(1.0, 0.6, 0.1, 1.0));

        // 主四角星
        const r1 = 5;
        const w1 = 1.0;

        drawList.AddQuadFilled(
          new ImGui.Vec2(cx, cy - r1), new ImGui.Vec2(cx + w1, cy),
          new ImGui.Vec2(cx, cy + r1), new ImGui.Vec2(cx - w1, cy), cGlow
        );
        drawList.AddQuadFilled(
          new ImGui.Vec2(cx - r1, cy), new ImGui.Vec2(cx, cy - w1),
          new ImGui.Vec2(cx + r1, cy), new ImGui.Vec2(cx, cy + w1), cGlow
        );

        // 次小四角星（对角旋转45度）
        const rDi = 3.5;
        const wDi = 0.7;
        const sin45 = 0.7071;
        const offR = rDi * sin45;
        const offW = wDi * sin45;

        drawList.AddQuadFilled(
          new ImGui.Vec2(cx + offR, cy - offR), new ImGui.Vec2(cx + offW, cy + offW),
          new ImGui.Vec2(cx - offR, cy + offR), new ImGui.Vec2(cx - offW, cy - offW), cGlow
        );
        drawList.AddQuadFilled(
          new ImGui.Vec2(cx - offR, cy - offR), new ImGui.Vec2(cx + offW, cy - offW),
          new ImGui.Vec2(cx + offR, cy + offR), new ImGui.Vec2(cx - offW, cy + offW), cGlow
        );

        // 内层高亮十字
        const r2 = 2.5;
        const w2 = 0.7;

        drawList.AddQuadFilled(
          new ImGui.Vec2(cx, cy - r2), new ImGui.Vec2(cx + w2, cy),
          new ImGui.Vec2(cx, cy + r2), new ImGui.Vec2(cx - w2, cy), cCore
        );
        drawList.AddQuadFilled(
          new ImGui.Vec2(cx - r2, cy), new ImGui.Vec2(cx, cy - w2),
          new ImGui.Vec2(cx + r2, cy), new ImGui.Vec2(cx, cy + w2), cCore
        );

        // 散落粒子
        drawList.AddCircleFilled(new ImGui.Vec2(cx - 3.5, cy - 3), 0.8, cCore, 4);
        drawList.AddCircleFilled(new ImGui.Vec2(cx + 3.5, cy + 3.5), 0.8, cCore, 4);

        // 中心高亮圆点
        drawList.AddCircleFilled(new ImGui.Vec2(cx, cy), 1.2, ImGui.GetColorU32(new ImGui.Vec4(1, 1, 1, 1)), 6);

        break;
      }
      case spec.ItemType.null: {
        // 空节点 — 深黄色文件夹图标（颜色加深，参考图片）
        const cBack = ImGui.GetColorU32(new ImGui.Vec4(0.7, 0.5, 0.05, 1.0));
        const cFront = ImGui.GetColorU32(new ImGui.Vec4(0.85, 0.65, 0.1, 1.0));

        // 文件夹背板和切角标签
        drawList.AddRectFilled(new ImGui.Vec2(cx - 5, cy - 3.5), new ImGui.Vec2(cx - 0.5, cy - 2), cBack, 1.0);
        drawList.AddRectFilled(new ImGui.Vec2(cx - 5, cy - 2.5), new ImGui.Vec2(cx + 5, cy + 3.5), cBack, 1.0);

        // 文件夹前层盖板
        drawList.AddRectFilled(new ImGui.Vec2(cx - 5, cy - 1), new ImGui.Vec2(cx + 5, cy + 3.5), cFront, 1.0);

        break;
      }
      case spec.ItemType.camera: {
        // 摄像机 — 扁平化实心机身 + 镜头
        const c = ImGui.GetColorU32(new ImGui.Vec4(0.75, 0.4, 0.85, 1.0));

        drawList.AddRectFilled(new ImGui.Vec2(cx - 5, cy - 3), new ImGui.Vec2(cx + 1, cy + 3), c, 1.5);
        drawList.AddTriangleFilled(
          new ImGui.Vec2(cx + 1, cy - 1.5),
          new ImGui.Vec2(cx + 5, cy - 3.5),
          new ImGui.Vec2(cx + 5, cy + 3.5),
          c
        );

        break;
      }
      case spec.ItemType.composition: {
        // 预合成 — 等距透视的堆叠层，代表图层组合
        const c1 = ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.8, 0.6, 0.4));
        const c2 = ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.8, 0.6, 1.0));

        drawList.AddQuadFilled(new ImGui.Vec2(cx, cy - 4), new ImGui.Vec2(cx + 5, cy - 1.5), new ImGui.Vec2(cx, cy + 1), new ImGui.Vec2(cx - 5, cy - 1.5), c2);
        drawList.AddQuad(new ImGui.Vec2(cx, cy - 1), new ImGui.Vec2(cx + 5, cy + 1.5), new ImGui.Vec2(cx, cy + 4), new ImGui.Vec2(cx - 5, cy + 1.5), c2, lw);

        break;
      }
      case spec.ItemType.mesh: {
        // 3D 网格 — 等距透视实心正方体（三面不同明度）
        const cTop = ImGui.GetColorU32(new ImGui.Vec4(0.5, 0.85, 0.5, 1.0));
        const cLeft = ImGui.GetColorU32(new ImGui.Vec4(0.35, 0.7, 0.35, 1.0));
        const cRight = ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.55, 0.2, 1.0));

        const topY = cy - 4, botY = cy + 4;
        const leftX = cx - 4, rightX = cx + 4;
        const midY = cy - 0.5;

        // 顶面
        drawList.AddQuadFilled(new ImGui.Vec2(cx, topY), new ImGui.Vec2(rightX, midY - 1.5), new ImGui.Vec2(cx, cy - 0.5), new ImGui.Vec2(leftX, midY - 1.5), cTop);
        // 左面
        drawList.AddQuadFilled(new ImGui.Vec2(leftX, midY - 1.5), new ImGui.Vec2(cx, cy - 0.5), new ImGui.Vec2(cx, botY), new ImGui.Vec2(leftX, botY - 1.5), cLeft);
        // 右面
        drawList.AddQuadFilled(new ImGui.Vec2(cx, cy - 0.5), new ImGui.Vec2(rightX, midY - 1.5), new ImGui.Vec2(rightX, botY - 1.5), new ImGui.Vec2(cx, botY), cRight);

        break;
      }
      case spec.ItemType.text:
      case spec.ItemType.richtext as spec.ItemType: {
        // 文本 — 粗体无衬线 T，现代清晰
        const c = ImGui.GetColorU32(new ImGui.Vec4(0.3, 0.65, 1.0, 1.0));

        drawList.AddRectFilled(new ImGui.Vec2(cx - 4.5, cy - 4.5), new ImGui.Vec2(cx + 4.5, cy - 1.5), c, 0.5);
        drawList.AddRectFilled(new ImGui.Vec2(cx - 1.5, cy - 1.5), new ImGui.Vec2(cx + 1.5, cy + 4.5), c, 0.5);

        break;
      }
      case spec.ItemType.light: {
        // 灯光 — 清新太阳形发光体
        const c = ImGui.GetColorU32(new ImGui.Vec4(1.0, 0.75, 0.1, 1.0));

        drawList.AddCircleFilled(new ImGui.Vec2(cx, cy), 2.2, c, 12);
        // 发散光线
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;

          drawList.AddLine(new ImGui.Vec2(cx + Math.cos(angle) * 3.5, cy + Math.sin(angle) * 3.5), new ImGui.Vec2(cx + Math.cos(angle) * 5, cy + Math.sin(angle) * 5), c, 1.5);
        }

        break;
      }
      case spec.ItemType.tree: {
        // 节点树 — 块状横向树状拓扑图
        const c = ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.8, 0.6, 1.0));

        drawList.AddRectFilled(new ImGui.Vec2(cx - 4.5, cy - 1), new ImGui.Vec2(cx - 1.5, cy + 1), c, 0.5);
        drawList.AddRectFilled(new ImGui.Vec2(cx + 1.5, cy - 4), new ImGui.Vec2(cx + 4.5, cy - 2), c, 0.5);
        drawList.AddRectFilled(new ImGui.Vec2(cx + 1.5, cy + 2), new ImGui.Vec2(cx + 4.5, cy + 4), c, 0.5);
        drawList.AddLine(new ImGui.Vec2(cx - 1.5, cy), new ImGui.Vec2(cx + 0.5, cy), c, 1.2);
        drawList.AddLine(new ImGui.Vec2(cx + 0.5, cy - 3), new ImGui.Vec2(cx + 0.5, cy + 3), c, 1.2);
        drawList.AddLine(new ImGui.Vec2(cx + 0.5, cy - 3), new ImGui.Vec2(cx + 1.5, cy - 3), c, 1.2);
        drawList.AddLine(new ImGui.Vec2(cx + 0.5, cy + 3), new ImGui.Vec2(cx + 1.5, cy + 3), c, 1.2);

        break;
      }
      case spec.ItemType.interact: {
        // 交互 — 现代同心波纹（类似触控反馈）
        const c = ImGui.GetColorU32(new ImGui.Vec4(0.9, 0.45, 0.45, 1.0));

        drawList.AddCircleFilled(new ImGui.Vec2(cx, cy), 1.5, c, 8);
        drawList.AddCircle(new ImGui.Vec2(cx, cy), 3.5, c, 12, 1.5);
        drawList.AddCircle(new ImGui.Vec2(cx, cy), 5.5, ImGui.GetColorU32(new ImGui.Vec4(0.9, 0.45, 0.45, 0.3)), 12, 1.2);

        break;
      }
      case spec.ItemType.video: {
        // 视频 — 扁平圆角媒体块，中间镂空播放键
        const c = ImGui.GetColorU32(new ImGui.Vec4(0.9, 0.35, 0.45, 1.0));

        drawList.AddRectFilled(new ImGui.Vec2(cx - 5, cy - 3.5), new ImGui.Vec2(cx + 5, cy + 3.5), c, 1.5);
        drawList.AddTriangleFilled(
          new ImGui.Vec2(cx - 1.5, cy - 1.5),
          new ImGui.Vec2(cx + 2, cy),
          new ImGui.Vec2(cx - 1.5, cy + 1.5),
          ImGui.GetColorU32(new ImGui.Vec4(0.1, 0.1, 0.1, 1.0)) // 黑色镂空视觉
        );

        break;
      }
      case spec.ItemType.audio: {
        // 音频 — 清晰等距的柱状律动条
        const c = ImGui.GetColorU32(new ImGui.Vec4(0.5, 0.8, 0.4, 1.0));

        drawList.AddRectFilled(new ImGui.Vec2(cx - 4, cy - 1), new ImGui.Vec2(cx - 2, cy + 3), c, 1);
        drawList.AddRectFilled(new ImGui.Vec2(cx - 1, cy - 4), new ImGui.Vec2(cx + 1, cy + 3), c, 1);
        drawList.AddRectFilled(new ImGui.Vec2(cx + 2, cy - 2), new ImGui.Vec2(cx + 4, cy + 3), c, 1);

        break;
      }
      case spec.ItemType.spine as spec.ItemType: {
        // 骨骼动画 — 圆润相连的关节点
        const c = ImGui.GetColorU32(new ImGui.Vec4(0.85, 0.7, 0.5, 1.0));

        drawList.AddCircleFilled(new ImGui.Vec2(cx - 2.5, cy + 1.5), 2.0, c, 8);
        drawList.AddCircleFilled(new ImGui.Vec2(cx + 2.5, cy - 1.5), 2.5, c, 8);
        drawList.AddLine(new ImGui.Vec2(cx - 2.5, cy + 1.5), new ImGui.Vec2(cx + 2.5, cy - 1.5), c, 3.0);

        break;
      }
      default: {
        // 默认 — 高度对称的四个方块网格
        const c1 = ImGui.GetColorU32(new ImGui.Vec4(0.65, 0.65, 0.7, 1.0));

        drawList.AddRectFilled(new ImGui.Vec2(cx - 5.0, cy - 5.0), new ImGui.Vec2(cx - 0.5, cy - 0.5), c1, 1.0);
        drawList.AddRectFilled(new ImGui.Vec2(cx + 0.5, cy - 5.0), new ImGui.Vec2(cx + 5.0, cy - 0.5), c1, 1.0);
        drawList.AddRectFilled(new ImGui.Vec2(cx - 5.0, cy + 0.5), new ImGui.Vec2(cx - 0.5, cy + 5.0), c1, 1.0);
        drawList.AddRectFilled(new ImGui.Vec2(cx + 0.5, cy + 0.5), new ImGui.Vec2(cx + 5.0, cy + 5.0), c1, 1.0);

        break;
      }
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