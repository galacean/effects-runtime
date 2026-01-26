import { VFXItem } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';

@editorWindow()
export class Hierarchy extends EditorWindow {
  private lightBlue = new ImGui.ImVec4(0.25, 0.34, 0.43, 1.0);
  private highlightBlue = new ImGui.ImVec4(0.000, 0.43, 0.87, 1.000);
  private hierarchyDrawOrder: VFXItem[] = [];
  private hierarchySelectionAnchor: VFXItem | null = null;
  private hierarchyVisibilityColumnWidth = 16;
  private hierarchyVisibilitySpacing = 6;
  private hierarchyEyeActiveColor = new ImGui.Vec4(0.72, 0.72, 0.72, 1.0);
  private hierarchyEyeInactiveColor = new ImGui.Vec4(0.46, 0.46, 0.46, 1.0);
  private hierarchyEyeOutlineColor = new ImGui.Vec4(0.6, 0.6, 0.6, 1.0);
  private hierarchyEyeHoverBgColor = new ImGui.Vec4(0.92, 0.92, 0.92, 0.35);
  private hierarchyEyeSlashColor = new ImGui.Vec4(0.35, 0.35, 0.35, 1.0);
  private hierarchyInactiveTextColor = new ImGui.Vec4(0.5, 0.5, 0.5, 1.0); // 非激活状态的置灰文字颜色
  private hierarchyVisibilityColumnLocalX = 0;
  private hierarchyVisibilityColumnScreenX = 0;

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
    if (!GalaceanEffects.player.getCompositions()[0]) {
      ImGui.End();

      return;
    }
    const base_flags = STATIC<ImGui.TreeNodeFlags>(UNIQUE('base_flags#f8c171be'),
      ImGui.TreeNodeFlags.OpenOnArrow |
      ImGui.TreeNodeFlags.OpenOnDoubleClick |
      ImGui.TreeNodeFlags.SpanAvailWidth
    );

    this.hierarchyDrawOrder.length = 0;
    if (Selection.getSelectedObjects().length === 0) {
      this.hierarchySelectionAnchor = null;
    }

    this.hierarchyVisibilityColumnLocalX = ImGui.GetCursorPosX();
    this.hierarchyVisibilityColumnScreenX = ImGui.GetCursorScreenPos().x;

    const highlightBlue = this.highlightBlue;
    const lightBlue = this.lightBlue;

    if (ImGui.IsWindowFocused()) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, highlightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, highlightBlue);
    } else {
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, lightBlue);
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, lightBlue);
    }

    ImGui.SetCursorPosX(this.hierarchyVisibilityColumnLocalX + this.hierarchyVisibilityColumnWidth + this.hierarchyVisibilitySpacing);
    const composition = GalaceanEffects.player.getCompositions()[0];
    const compositionId = `composition_${composition.id}`;

    if (ImGui.TreeNodeEx(compositionId, base_flags.value | ImGui.TreeNodeFlags.DefaultOpen, 'Composition')) {
      this.drawVFXItemTreeNode(composition.rootItem, base_flags.value);
      ImGui.TreePop();
    }

    ImGui.PopStyleColor(3);
  }

  private drawVFXItemTreeNode (item: VFXItem, baseFlags: ImGui.TreeNodeFlags) {
    this.hierarchyDrawOrder.push(item);

    let nodeFlags: ImGui.TreeNodeFlags = baseFlags;
    const preSelected = Selection.isSelected(item);

    if (preSelected) {
      nodeFlags |= ImGui.TreeNodeFlags.Selected;
    }
    if (item.children.length === 0) {
      nodeFlags |= ImGui.TreeNodeFlags.Leaf;
    }
    if (item.name === 'rootItem') {
      nodeFlags |= ImGui.TreeNodeFlags.DefaultOpen;
    }

    const isHoverSelectedNode = preSelected && ImGui.IsWindowFocused();

    if (isHoverSelectedNode) {
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, this.highlightBlue);
    }

    // 使用层次路径和当前绘制索引创建唯一ID，确保即使同名节点也有不同的ID
    const drawIndex = this.hierarchyDrawOrder.length;
    const itemId = `item_${item.id}_${drawIndex}`;

    ImGui.PushID(itemId);

    const drawList = ImGui.GetWindowDrawList();

    drawList.ChannelsSplit(2);
    drawList.ChannelsSetCurrent(1);

    const rowStartLocal = ImGui.GetCursorPos();
    const rowStartScreen = ImGui.GetCursorScreenPos();
    const frameHeight = ImGui.GetFrameHeight();
    const visibilityWidth = this.hierarchyVisibilityColumnWidth;
    const treeStartX = rowStartLocal.x + visibilityWidth + this.hierarchyVisibilitySpacing;

    // 根据VFXItem的isActive状态设置文字颜色
    const needTextColorPop = !item.isActive;

    if (needTextColorPop) {
      // 设置置灰颜色
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, this.hierarchyInactiveTextColor);
    }

    ImGui.SetCursorPos(new ImGui.Vec2(treeStartX, rowStartLocal.y));
    const nodeOpen = ImGui.TreeNodeEx(itemId, nodeFlags, item.name);

    // 如果设置了置灰颜色，现在恢复原来的颜色
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
      min: new ImGui.Vec2(this.hierarchyVisibilityColumnScreenX, rowRectMin.y),
      max: new ImGui.Vec2(this.hierarchyVisibilityColumnScreenX + visibilityWidth, rowRectMin.y + rowHeight),
    };
    const buttonHovered = ImGui.IsMouseHoveringRect(buttonBounds.min, buttonBounds.max, false);
    const eyeClicking = buttonHovered && ImGui.IsMouseClicked(0);

    this.handleHierarchySelection(item, eyeClicking);

    if (isHoverSelectedNode) {
      ImGui.PopStyleColor(1);
    }

    const rowSelected = Selection.isSelected(item);
    const rowActive = ImGui.IsItemActive();
    const shouldHighlight = rowSelected || rowHovered || rowActive || buttonHovered;

    drawList.ChannelsSetCurrent(0);
    if (shouldHighlight) {
      const windowPos = ImGui.GetWindowPos();
      const contentRegionMax = ImGui.GetWindowContentRegionMax();
      const rowBgMin = new ImGui.Vec2(this.hierarchyVisibilityColumnScreenX, rowRectMin.y);
      const rowBgMax = new ImGui.Vec2(windowPos.x + contentRegionMax.x, rowRectMin.y + rowHeight);
      const bgColor = rowSelected
        ? ImGui.GetColorU32(ImGui.ImGuiCol.Header)
        : rowActive
          ? ImGui.GetColorU32(ImGui.ImGuiCol.HeaderActive)
          : ImGui.GetColorU32(ImGui.ImGuiCol.HeaderHovered);

      drawList.AddRectFilled(rowBgMin, rowBgMax, bgColor);
    }
    drawList.ChannelsSetCurrent(1);

    ImGui.SetCursorPos(new ImGui.Vec2(this.hierarchyVisibilityColumnLocalX, rowStartLocal.y));
    const toggleTriggered = this.drawHierarchyVisibilityToggle(item, buttonBounds, rowSelected);

    ImGui.SetCursorPos(postTreeCursor);

    if (toggleTriggered) {
      const targets = this.getHierarchyVisibilityTargets(item);
      const nextState = !item.isVisible;

      for (const target of targets) {
        target.setVisible(nextState);
      }
    }

    drawList.ChannelsMerge();

    if (nodeOpen) {
      for (const child of item.children) {
        this.drawVFXItemTreeNode(child, baseFlags);
      }
      ImGui.TreePop();
    }

    ImGui.PopID();
  }

  private handleHierarchySelection (item: VFXItem, suppressSelection = false) {
    if (suppressSelection) {
      return;
    }

    const itemClicked = ImGui.IsItemClicked();

    if (itemClicked && !ImGui.IsItemToggledOpen()) {
      const io = ImGui.GetIO();
      const additive = io.KeyCtrl || io.KeySuper;
      const range = io.KeyShift;

      if (range && this.hierarchySelectionAnchor && this.hierarchySelectionAnchor !== item) {
        this.applyHierarchyRangeSelection(this.hierarchySelectionAnchor, item);
      } else if (additive) {
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
      } else {
        Selection.select(item);
        this.hierarchySelectionAnchor = item;
      }
    }
  }

  private applyHierarchyRangeSelection (anchor: VFXItem, target: VFXItem) {
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
    for (const item of rangeItems) {
      Selection.addObject(item);
    }
  }

  private getHierarchyVisibilityTargets (item: VFXItem): VFXItem[] {
    const selected = Selection.getSelectedObjects<VFXItem>().filter((candidate): candidate is VFXItem => candidate instanceof VFXItem);
    const result = new Set<VFXItem>();

    if (selected.length > 1) {
      for (const candidate of selected) {
        if (!result.has(candidate)) {
          result.add(candidate);
        }
        this.collectHierarchyDescendants(candidate, result);
      }
    }

    if (!result.has(item)) {
      result.add(item);
      this.collectHierarchyDescendants(item, result);
    }

    return Array.from(result);
  }

  private collectHierarchyDescendants (item: VFXItem, collection: Set<VFXItem>) {
    for (const child of item.children) {
      if (!collection.has(child)) {
        collection.add(child);
      }
      this.collectHierarchyDescendants(child, collection);
    }
  }

  private drawHierarchyVisibilityToggle (item: VFXItem, bounds: { min: ImGui.Vec2, max: ImGui.Vec2 }, rowSelected: boolean): boolean {
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
    const outlineColor = ImGui.GetColorU32(this.hierarchyEyeOutlineColor);
    const thickness = rowSelected ? 1.6 : 1.15;
    const arcSteps = 10;

    let previous = new ImGui.Vec2(center.x - halfEyeWidth, center.y);

    for (let i = 1; i <= arcSteps; i++) {
      const t = i / arcSteps;
      const x = center.x - halfEyeWidth + (halfEyeWidth * 2) * t;
      const y = center.y - Math.sin(t * Math.PI) * halfEyeHeight;
      const point = new ImGui.Vec2(x, y);

      drawList.AddLine(previous, point, outlineColor, thickness);
      previous = point;
    }

    previous = new ImGui.Vec2(center.x + halfEyeWidth, center.y);
    for (let i = 1; i <= arcSteps; i++) {
      const t = i / arcSteps;
      const x = center.x + halfEyeWidth - (halfEyeWidth * 2) * t;
      const y = center.y + Math.sin(t * Math.PI) * halfEyeHeight;
      const point = new ImGui.Vec2(x, y);

      drawList.AddLine(previous, point, outlineColor, thickness);
      previous = point;
    }

    const pupilRadius = Math.max(extent * 0.2, 1.8);

    if (item.isVisible) {
      drawList.AddCircleFilled(center, pupilRadius, ImGui.GetColorU32(this.hierarchyEyeActiveColor), 12);
    } else {
      drawList.AddCircle(center, pupilRadius, ImGui.GetColorU32(this.hierarchyEyeInactiveColor), 14, 1.1);
      drawList.AddLine(
        new ImGui.Vec2(center.x - halfEyeWidth * 0.82, center.y + halfEyeHeight * 0.85),
        new ImGui.Vec2(center.x + halfEyeWidth * 0.82, center.y - halfEyeHeight * 0.85),
        ImGui.GetColorU32(this.hierarchyEyeSlashColor),
        1.5
      );
    }

    return clicked;
  }
}

function UNIQUE (key: string): string { return key; }

class Static<T> {
  constructor (public value: T) {}
  access: ImGui.Access<T> = (value: T = this.value): T => this.value = value;
}

const _static_map: Map<string, Static<any>> = new Map();

function STATIC<T> (key: string, init: T): Static<T> {
  let value: Static<T> | undefined = _static_map.get(key);

  if (value === undefined) { _static_map.set(key, value = new Static<T>(init)); }

  return value;
}