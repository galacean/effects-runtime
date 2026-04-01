import inspireList from '../asset/inspire-list';
import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';
import { Selection } from '../core/selection';

type InspireEntry = { url: string, name: string };

const COLORS = {
  selectedFocused: new ImGui.ImVec4(0.17, 0.37, 0.57, 1.0),
  selectedUnfocused: new ImGui.ImVec4(0.25, 0.30, 0.35, 1.0),
  hovered: new ImGui.ImVec4(0.22, 0.26, 0.30, 1.0),
  playingBg: new ImGui.ImVec4(0.14, 0.35, 0.22, 1.0),
  playingHovered: new ImGui.ImVec4(0.18, 0.42, 0.28, 1.0),
  // 图标 - 深黄色文件夹风格
  iconFill: new ImGui.ImVec4(0.78, 0.60, 0.18, 1.0),
  iconBorder: new ImGui.ImVec4(0.62, 0.48, 0.14, 1.0),
  iconHole: new ImGui.ImVec4(0.52, 0.40, 0.10, 1.0),
  iconPlayingFill: new ImGui.ImVec4(0.30, 0.65, 0.40, 1.0),
  iconSelectedFill: new ImGui.ImVec4(0.92, 0.78, 0.40, 1.0),
  iconSelectedBorder: new ImGui.ImVec4(0.80, 0.66, 0.28, 1.0),
  iconSelectedHole: new ImGui.ImVec4(0.70, 0.55, 0.18, 1.0),
  listBg: new ImGui.ImVec4(0.12, 0.12, 0.12, 1.0),
  listBorder: new ImGui.ImVec4(0.08, 0.08, 0.08, 1.0),
  searchIcon: new ImGui.Vec4(0.5, 0.5, 0.5, 1.0),
  dimText: new ImGui.Vec4(0.45, 0.45, 0.45, 1.0),
} as const;

const LAYOUT = {
  iconSize: 14,
  iconTextGap: 6,
  rowPaddingLeft: 6,
  rowHeight: 22,
} as const;

@editorWindow()
export class Composition extends EditorWindow {

  private currentItem = -1;
  private compositionNames: string[] = [];
  private compositionURLs: string[] = [];
  private currentCompositionURL = '';
  private playingIndex = -1;

  private searchFilterBuffer: ImGui.ImScalar<string> = [''];
  private filteredIndices: number[] = [];

  @menuItem('Window/Composition')
  static showWindow () {
    EditorWindow.getWindow(Composition).open();
  }

  constructor () {
    super();
    this.title = 'Composition';

    for (const key of Object.keys(inspireList)) {
      const entry = inspireList[key as keyof typeof inspireList] as InspireEntry;

      this.compositionNames.push(entry.name);
      this.compositionURLs.push(entry.url);
    }

    this.updateFilteredList();
    this.open();
  }

  protected override onGUI (): void {
    this.drawSearchBar();
    ImGui.Spacing();
    this.drawURLSection();

    ImGui.Spacing();
    ImGui.Separator();
    ImGui.Spacing();

    this.drawCompositionList();
  }

  private drawURLSection (): void {
    ImGui.AlignTextToFramePadding();
    ImGui.Text('URL');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(ImGui.GetContentRegionAvail().x);
    if (ImGui.InputText(
      '##CompositionURL',
      (value = this.currentCompositionURL) => this.currentCompositionURL = value,
      undefined,
      ImGui.InputTextFlags.EnterReturnsTrue,
    )) {
      this.playURL(this.currentCompositionURL);
    }
  }

  private drawCompositionList (): void {
    const listHeight = ImGui.GetContentRegionAvail().y;

    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, COLORS.listBg);
    ImGui.PushStyleColor(ImGui.ImGuiCol.Border, COLORS.listBorder);
    ImGui.PushStyleVar(ImGui.ImGuiStyleVar.WindowPadding, new ImGui.Vec2(0, 2));
    ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.Vec2(0, 1));

    if (ImGui.BeginChild('##CompositionList', new ImGui.Vec2(0, listHeight), true)) {
      const indices = this.filteredIndices;
      const focused = ImGui.IsWindowFocused();
      const drawList = ImGui.GetWindowDrawList();
      const windowPos = ImGui.GetWindowPos();
      const contentMax = ImGui.GetWindowContentRegionMax();
      const rowFullRight = windowPos.x + contentMax.x;

      for (const idx of indices) {
        const isSelected = idx === this.currentItem;
        const isPlaying = idx === this.playingIndex;

        ImGui.PushID(idx);

        const rowScreenPos = ImGui.GetCursorScreenPos();
        const rowMinY = rowScreenPos.y;
        const rowMaxY = rowMinY + LAYOUT.rowHeight;

        const rowHovered = ImGui.IsMouseHoveringRect(
          new ImGui.Vec2(windowPos.x, rowMinY),
          new ImGui.Vec2(rowFullRight, rowMaxY),
        );

        if (isSelected) {
          const bgColor = focused ? COLORS.selectedFocused : COLORS.selectedUnfocused;

          drawList.AddRectFilled(
            new ImGui.Vec2(windowPos.x, rowMinY),
            new ImGui.Vec2(rowFullRight, rowMaxY),
            ImGui.GetColorU32(bgColor),
          );
        } else if (isPlaying) {
          const bgColor = rowHovered ? COLORS.playingHovered : COLORS.playingBg;

          drawList.AddRectFilled(
            new ImGui.Vec2(windowPos.x, rowMinY),
            new ImGui.Vec2(rowFullRight, rowMaxY),
            ImGui.GetColorU32(bgColor),
          );
        } else if (rowHovered) {
          drawList.AddRectFilled(
            new ImGui.Vec2(windowPos.x, rowMinY),
            new ImGui.Vec2(rowFullRight, rowMaxY),
            ImGui.GetColorU32(COLORS.hovered),
          );
        }

        const iconX = rowScreenPos.x + LAYOUT.rowPaddingLeft;
        const iconY = rowMinY + (LAYOUT.rowHeight - LAYOUT.iconSize) * 0.5;

        this.drawItemIcon(drawList, iconX, iconY, LAYOUT.iconSize, isSelected, isPlaying);

        const textX = LAYOUT.rowPaddingLeft + LAYOUT.iconSize + LAYOUT.iconTextGap;
        const textY = (LAYOUT.rowHeight - ImGui.GetTextLineHeight()) * 0.5;

        ImGui.SetCursorPos(new ImGui.Vec2(textX, ImGui.GetCursorPos().y + textY));
        ImGui.Text(this.compositionNames[idx]);

        ImGui.SetCursorScreenPos(new ImGui.Vec2(windowPos.x, rowMinY));
        ImGui.InvisibleButton(`##row_${idx}`, new ImGui.Vec2(rowFullRight - windowPos.x, LAYOUT.rowHeight));

        if (ImGui.IsItemClicked()) {
          this.currentItem = idx;
          this.currentCompositionURL = this.compositionURLs[idx];
          Selection.select(null);
          this.playURL(this.currentCompositionURL, idx);
        }

        ImGui.PopID();
      }

      if (indices.length === 0 && this.searchFilterBuffer[0].length > 0) {
        const padding = LAYOUT.rowPaddingLeft + LAYOUT.iconSize + LAYOUT.iconTextGap;

        ImGui.SetCursorPosX(padding);
        ImGui.SetCursorPosY(ImGui.GetCursorPosY() + 8);
        ImGui.PushStyleColor(ImGui.ImGuiCol.Text, COLORS.dimText);
        ImGui.Text('没有匹配的合成');
        ImGui.PopStyleColor(1);
      }
    }
    ImGui.EndChild();

    ImGui.PopStyleVar(2);
    ImGui.PopStyleColor(2);
  }

  private drawItemIcon (drawList: ImGui.DrawList, x: number, y: number, size: number, isSelected: boolean, isPlaying: boolean): void {
    const fillColor = ImGui.GetColorU32(
      isSelected ? COLORS.iconSelectedFill : isPlaying ? COLORS.iconPlayingFill : COLORS.iconFill,
    );
    const borderColor = ImGui.GetColorU32(isSelected ? COLORS.iconSelectedBorder : COLORS.iconBorder);
    const holeColor = ImGui.GetColorU32(isSelected ? COLORS.iconSelectedHole : COLORS.iconHole);

    const min = new ImGui.Vec2(x, y);
    const max = new ImGui.Vec2(x + size, y + size);

    drawList.AddRectFilled(min, max, fillColor, 2.0);
    drawList.AddRect(min, max, borderColor, 2.0, 0, 1.0);

    const holeW = 2;
    const holeH = 3;
    const margin = 1.5;
    const gap = size * 0.36;

    drawList.AddRectFilled(
      new ImGui.Vec2(x + margin, y + margin + 1),
      new ImGui.Vec2(x + margin + holeW, y + margin + 1 + holeH),
      holeColor,
    );
    drawList.AddRectFilled(
      new ImGui.Vec2(x + margin, y + margin + 1 + gap),
      new ImGui.Vec2(x + margin + holeW, y + margin + 1 + gap + holeH),
      holeColor,
    );
    drawList.AddRectFilled(
      new ImGui.Vec2(x + size - margin - holeW, y + margin + 1),
      new ImGui.Vec2(x + size - margin, y + margin + 1 + holeH),
      holeColor,
    );
    drawList.AddRectFilled(
      new ImGui.Vec2(x + size - margin - holeW, y + margin + 1 + gap),
      new ImGui.Vec2(x + size - margin, y + margin + 1 + gap + holeH),
      holeColor,
    );
  }

  private drawSearchBar (): void {
    const availWidth = ImGui.GetContentRegionAvail().x;
    const iconSize = 16;
    const iconPadding = 4;

    const originalCursorX = ImGui.GetCursorPosX();
    const cursorPos = ImGui.GetCursorScreenPos();
    const frameHeight = ImGui.GetFrameHeight();
    const drawList = ImGui.GetWindowDrawList();
    const iconColor = ImGui.GetColorU32(COLORS.searchIcon);

    const circleCenter = new ImGui.Vec2(cursorPos.x + iconSize * 0.4, cursorPos.y + frameHeight * 0.4);
    const circleRadius = iconSize * 0.28;

    drawList.AddCircle(circleCenter, circleRadius, iconColor, 12, 1.5);

    const handleStart = new ImGui.Vec2(
      circleCenter.x + circleRadius * 0.7,
      circleCenter.y + circleRadius * 0.7,
    );
    const handleEnd = new ImGui.Vec2(
      circleCenter.x + circleRadius * 1.8,
      circleCenter.y + circleRadius * 1.8,
    );

    drawList.AddLine(handleStart, handleEnd, iconColor, 1.5);

    const inputStartX = originalCursorX + iconSize + iconPadding;

    ImGui.SetCursorPosX(inputStartX);
    ImGui.PushItemWidth(availWidth - iconSize - iconPadding);

    const prevFilter = this.searchFilterBuffer[0];

    if (ImGui.InputText('##CompositionSearch', this.searchFilterBuffer, 256)) {
      if (this.searchFilterBuffer[0] !== prevFilter) {
        this.updateFilteredList();
      }
    }

    ImGui.PopItemWidth();
  }

  private updateFilteredList (): void {
    const filter = this.searchFilterBuffer[0];

    if (filter.length === 0) {
      this.filteredIndices = this.compositionNames.map((_, i) => i);

      return;
    }

    const filterLower = filter.toLowerCase();

    this.filteredIndices = [];
    for (let i = 0; i < this.compositionNames.length; i++) {
      if (this.compositionNames[i].toLowerCase().includes(filterLower)) {
        this.filteredIndices.push(i);
      }
    }
  }

  private playURL (url: string, listIndex?: number): void {
    if (!url) {
      return;
    }
    if (listIndex !== undefined) {
      this.playingIndex = listIndex;
    }
    void GalaceanEffects.playURL(url);
  }
}
