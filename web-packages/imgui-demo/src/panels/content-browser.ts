import type { Engine, EffectsObject } from '@galacean/effects';
import {
  Texture, Material, Shader, ShaderVariant, Geometry, AnimationClip,
} from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { GalaceanEffects } from '../ge';
import { ImGui, ImGui_Impl } from '../imgui';
import { EditorWindow } from './editor-window';

// ── 分类定义 ──────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Textures', 'Materials', 'Shaders', 'Geometries', 'AnimationClips'] as const;

type Category = typeof CATEGORIES[number];

// ── 调色板（严格对齐 Content Browser 文档色值）───────────────────────

const THEME = {
  // 面板背景层
  panelBg:      [0.102, 0.102, 0.102, 1.0] as const, // #1A1A1A
  headerBg:     [0.078, 0.078, 0.078, 1.0] as const, // #141414
  inputBg:      [0.059, 0.059, 0.059, 1.0] as const, // #0F0F0F
  // 交互态
  hover:        [0.149, 0.149, 0.149, 1.0] as const, // #262626
  highlight:    [0.188, 0.188, 0.188, 1.0] as const, // #303030
  selection:    [0.0, 0.376, 0.820, 1.0] as const, // #0060D1
  selectionDim: [0.0, 0.376, 0.820, 0.35] as const,
  // 文本
  textPrimary:  [0.784, 0.784, 0.784, 1.0] as const, // #C8C8C8
  textHeader:   [0.902, 0.902, 0.902, 1.0] as const, // #E6E6E6
  textMuted:    [0.45, 0.45, 0.45, 1.0] as const,
  textDim:      [0.35, 0.35, 0.35, 1.0] as const,
  // 分割线
  separator:    [0.020, 0.020, 0.020, 1.0] as const, // ~#050505
  separatorSub: [0.08, 0.08, 0.08, 1.0] as const,
  // 文件夹色
  folderDark:   [0.70, 0.50, 0.05, 1.0] as const,
  folderBright: [0.85, 0.65, 0.10, 1.0] as const,
};

// ── 分类配色（缩略图底色 + 强调色）────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: [number, number, number], accent: [number, number, number] }> = {
  Textures:   { bg: [0.08, 0.18, 0.32], accent: [0.20, 0.50, 0.85] },
  Materials:  { bg: [0.07, 0.22, 0.12], accent: [0.20, 0.70, 0.40] },
  Shaders:    { bg: [0.18, 0.10, 0.28], accent: [0.55, 0.30, 0.80] },
  Geometries:     { bg: [0.07, 0.22, 0.24], accent: [0.20, 0.65, 0.70] },
  AnimationClips: { bg: [0.28, 0.17, 0.06], accent: [0.90, 0.50, 0.20] },
};

const LIST_VIEW_THRESHOLD = 32;

// ── 工具函数 ──────────────────────────────────────────────────────────

function col4 (c: readonly [number, number, number, number]): ImGui.ImVec4 {
  return new ImGui.ImVec4(c[0], c[1], c[2], c[3]);
}

function colU32 (c: readonly [number, number, number, number]): number {
  return ImGui.GetColorU32(new ImGui.Vec4(c[0], c[1], c[2], c[3]));
}

// ── 面板主体 ──────────────────────────────────────────────────────────

@editorWindow()
export class ContentBrowser extends EditorWindow {
  private categoryMap: Map<Category, EffectsObject[]> = new Map();
  private totalCount = 0;
  private filteredCount = 0;
  private viewScale = 90;
  private selectedCategory: Category = 'All';
  private searchFilterBuffer: ImGui.ImScalar<string> = [''];
  private cachedObjectCount = -1;

  private get isListMode (): boolean {
    return this.viewScale <= LIST_VIEW_THRESHOLD;
  }

  private get searchFilter (): string {
    return this.searchFilterBuffer[0];
  }

  private set searchFilter (value: string) {
    this.searchFilterBuffer[0] = value;
  }

  @menuItem('Window/Content Browser')
  static showWindow () {
    EditorWindow.getWindow(ContentBrowser).open();
  }

  constructor () {
    super();
    this.title = 'Content Browser';
    this.open();
  }

  // ── 主渲染入口 ────────────────────────────────────────────────────

  override onGUI () {
    const engine = this.getEngine();

    if (!engine) {
      const avail = ImGui.GetContentRegionAvail();

      ImGui.SetCursorPos(new ImGui.Vec2(avail.x / 2 - 50, avail.y / 2));
      ImGui.TextColored(col4(THEME.textDim), 'No engine loaded');

      return;
    }

    this.collectAssets(engine);

    // 搜索栏
    this.drawSearchBar();

    // 主体区域（减去底部栏高度和 ItemSpacing.y，避免布局溢出产生窗口滚动条）
    const bottomBarH = 28;
    const itemSpacingY = ImGui.GetStyle().ItemSpacing.y;
    const availH = ImGui.GetContentRegionAvail().y - bottomBarH - itemSpacingY;
    const totalW = ImGui.GetContentRegionAvail().x;
    const sidebarW = Math.min(Math.max(140, totalW * 0.18), 210);

    // 左侧分类面板
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 4));
    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, col4(THEME.headerBg));
    ImGui.PushStyleColor(ImGui.ImGuiCol.Border, col4(THEME.separator));
    ImGui.BeginChild('##Sidebar', new ImGui.Vec2(sidebarW, availH), true);
    this.drawCategoryTree();
    ImGui.EndChild();
    ImGui.PopStyleColor(2);
    ImGui.PopStyleVar(1);

    ImGui.SameLine(0, 0);

    // 右侧内容区域
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(6, 6));
    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, col4(THEME.panelBg));
    ImGui.PushStyleColor(ImGui.ImGuiCol.Border, col4(THEME.separator));
    ImGui.BeginChild('##Content', new ImGui.Vec2(0, availH), true);
    this.filteredCount = this.drawContentArea();
    ImGui.EndChild();
    ImGui.PopStyleColor(2);
    ImGui.PopStyleVar(1);

    // 底部栏
    this.drawBottomBar();
  }

  // ── 数据收集 ──────────────────────────────────────────────────────

  private getEngine (): Engine | undefined {
    return GalaceanEffects.player?.renderer?.engine;
  }

  private collectAssets (engine: Engine): void {
    const keys = Object.keys(engine.objectInstance);

    if (keys.length === this.cachedObjectCount) {
      return;
    }
    this.cachedObjectCount = keys.length;

    for (const cat of CATEGORIES) {
      if (cat === 'All') { continue; }
      const arr = this.categoryMap.get(cat);

      if (arr) { arr.length = 0; } else { this.categoryMap.set(cat, []); }
    }
    this.totalCount = 0;

    for (const guid of keys) {
      const obj = engine.objectInstance[guid];

      if (!obj) { continue; }
      const cat = this.classifyObject(obj);

      if (cat) {
        this.categoryMap.get(cat)!.push(obj);
        this.totalCount++;
      }
    }
  }

  private classifyObject (obj: EffectsObject): Exclude<Category, 'All'> | null {
    if (obj instanceof Texture) { return 'Textures'; }
    if (obj instanceof Material) { return 'Materials'; }
    if (obj instanceof ShaderVariant || obj instanceof Shader) { return 'Shaders'; }
    if (obj instanceof Geometry) { return 'Geometries'; }
    if (obj instanceof AnimationClip) { return 'AnimationClips'; }

    return null;
  }

  // ── 顶部搜索栏 ───────────────────────────────────────────────────

  private drawSearchBar (): void {
    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, col4(THEME.headerBg));
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(8, 6));
    ImGui.BeginChild('##SearchBar', new ImGui.Vec2(0, 34), false);

    const dl = ImGui.GetWindowDrawList();
    const cur = ImGui.GetCursorScreenPos();
    const fh = ImGui.GetFrameHeight();
    const ic = colU32(THEME.textMuted);

    // 放大镜图标
    const cc = new ImGui.Vec2(cur.x + 12, cur.y + fh * 0.5);

    dl.AddCircle(cc, 5.5, ic, 12, 1.6);
    dl.AddLine(
      new ImGui.Vec2(cc.x + 3.8, cc.y + 3.8),
      new ImGui.Vec2(cc.x + 7.5, cc.y + 7.5), ic, 1.6,
    );

    ImGui.SetCursorPosX(ImGui.GetCursorPosX() + 24);
    ImGui.PushItemWidth(-1);
    ImGui.PushStyleColor(ImGui.ImGuiCol.FrameBg, col4(THEME.inputBg));
    ImGui.PushStyleColor(ImGui.ImGuiCol.FrameBgHovered, col4([0.07, 0.07, 0.07, 1]));
    ImGui.PushStyleColor(ImGui.ImGuiCol.FrameBgActive, col4([0.07, 0.07, 0.07, 1]));
    ImGui.PushStyleColor(ImGui.ImGuiCol.Text, col4(THEME.textPrimary));
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 4);
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(6, 4));
    ImGui.InputText('##Search', this.searchFilterBuffer, 256);
    ImGui.PopStyleVar(2);
    ImGui.PopStyleColor(4);

    // 清除按钮
    if (this.searchFilter.length > 0) {
      ImGui.SetItemAllowOverlap();
      const rMax = ImGui.GetItemRectMax();
      const rMin = ImGui.GetItemRectMin();
      const bs = 14;
      const bx = rMax.x - bs - 6;
      const by = rMin.y + (fh - bs) / 2;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(bx, by));
      if (ImGui.InvisibleButton('##Clr', new ImGui.Vec2(bs, bs))) {
        this.searchFilter = '';
      }
      const hov = ImGui.IsItemHovered();

      if (hov) { ImGui.SetMouseCursor(ImGui.ImGuiMouseCursor.Arrow); }
      const xc = colU32(hov ? THEME.textPrimary : THEME.textMuted);
      const p = 3.5;

      dl.AddLine(new ImGui.Vec2(bx + p, by + p), new ImGui.Vec2(bx + bs - p, by + bs - p), xc, 1.5);
      dl.AddLine(new ImGui.Vec2(bx + bs - p, by + p), new ImGui.Vec2(bx + p, by + bs - p), xc, 1.5);
    }
    ImGui.PopItemWidth();

    ImGui.EndChild();
    ImGui.PopStyleVar(1);
    ImGui.PopStyleColor(1);

    // 底部分割线
    const wdl = ImGui.GetWindowDrawList();
    const sepY = ImGui.GetCursorScreenPos().y;
    const wPos = ImGui.GetWindowPos();

    wdl.AddLine(
      new ImGui.Vec2(wPos.x, sepY),
      new ImGui.Vec2(wPos.x + ImGui.GetWindowSize().x, sepY),
      colU32(THEME.separator), 1,
    );
  }

  // ── 左侧分类树 ───────────────────────────────────────────────────

  private drawCategoryTree (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 1));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(8, 5));

    const dl = ImGui.GetWindowDrawList();

    for (const cat of CATEGORIES) {
      const count = cat === 'All'
        ? this.totalCount
        : (this.categoryMap.get(cat)?.length ?? 0);

      if (count === 0 && cat !== 'All') { continue; }

      const isSel = this.selectedCategory === cat;

      // 行样式
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header,
        isSel ? col4(THEME.selectionDim) : col4([0, 0, 0, 0]));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered,
        isSel ? col4(THEME.selectionDim) : col4(THEME.hover));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive,
        col4(THEME.selection));

      const flags = ImGui.TreeNodeFlags.Leaf |
        ImGui.TreeNodeFlags.NoTreePushOnOpen |
        ImGui.TreeNodeFlags.SpanAvailWidth |
        (isSel ? ImGui.TreeNodeFlags.Selected : 0);

      const rowStart = ImGui.GetCursorScreenPos();
      const rowH = 26;

      // 文件夹图标（深黄色）
      this.drawFolderIcon(dl, rowStart.x + 12, rowStart.y + rowH / 2, cat === 'All');

      // 缩进给图标空间
      ImGui.SetCursorPosX(ImGui.GetCursorPosX() + 28);
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, col4(isSel ? THEME.textHeader : THEME.textPrimary));
      ImGui.TreeNodeEx(`${cat}##cat`, flags);
      ImGui.PopStyleColor(1);

      if (ImGui.IsItemClicked()) {
        this.selectedCategory = cat;
      }

      // 右侧计数标签
      const countStr = `${count}`;
      const countW = ImGui.CalcTextSize(countStr).x;
      const rowEndX = ImGui.GetWindowContentRegionMax().x;

      ImGui.SameLine(0, 0);
      ImGui.SetCursorPosX(rowEndX - countW - 10);
      ImGui.TextColored(col4(THEME.textMuted), countStr);

      ImGui.PopStyleColor(3);

    }

    ImGui.PopStyleVar(2);
  }

  /** 绘制文件夹图标 */
  private drawFolderIcon (dl: ImGui.ImDrawList, cx: number, cy: number, isAll: boolean): void {
    const back = colU32(THEME.folderDark);
    const front = colU32(THEME.folderBright);

    if (isAll) {
      // "All" 用叠层文件夹
      dl.AddRectFilled(
        new ImGui.Vec2(cx - 5, cy - 2.5), new ImGui.Vec2(cx + 5, cy + 4.5), back, 1.5);
      dl.AddRectFilled(
        new ImGui.Vec2(cx - 6, cy - 4), new ImGui.Vec2(cx - 1, cy - 2.5), back, 1);
      dl.AddRectFilled(
        new ImGui.Vec2(cx - 6, cy - 1), new ImGui.Vec2(cx + 6, cy + 4.5), front, 1.5);
    } else {
      // 普通文件夹
      dl.AddRectFilled(
        new ImGui.Vec2(cx - 5, cy - 3.5), new ImGui.Vec2(cx - 0.5, cy - 2), back, 1);
      dl.AddRectFilled(
        new ImGui.Vec2(cx - 5, cy - 2.5), new ImGui.Vec2(cx + 5, cy + 3.5), back, 1);
      dl.AddRectFilled(
        new ImGui.Vec2(cx - 5, cy - 1), new ImGui.Vec2(cx + 5, cy + 3.5), front, 1.5);
    }
  }

  // ── 右侧内容区域 ─────────────────────────────────────────────────

  private drawContentArea (): number {
    const assets = this.getFilteredAssets();

    if (assets.length === 0) {
      const avail = ImGui.GetContentRegionAvail();

      ImGui.SetCursorPos(new ImGui.Vec2(avail.x / 2 - 40, avail.y / 2));
      ImGui.TextColored(col4(THEME.textDim), 'No assets');

      return 0;
    }

    if (this.isListMode) {
      this.drawListView(assets);
    } else {
      this.drawTileView(assets);
    }

    return assets.length;
  }

  private getFilteredAssets (): EffectsObject[] {
    let assets: EffectsObject[];

    if (this.selectedCategory === 'All') {
      assets = [];
      for (const cat of CATEGORIES) {
        if (cat === 'All') { continue; }
        const arr = this.categoryMap.get(cat);

        if (arr) { assets.push(...arr); }
      }
    } else {
      assets = this.categoryMap.get(this.selectedCategory) ?? [];
    }

    const q = this.searchFilter.toLowerCase();

    if (!q) { return assets; }

    return assets.filter(obj => {
      const n = this.getDisplayName(obj).toLowerCase();
      const cat = this.classifyObject(obj);

      return n.includes(q) || (cat && cat.toLowerCase().includes(q));
    });
  }

  // ── 网格视图 ──────────────────────────────────────────────────────

  private drawTileView (assets: EffectsObject[]): void {
    const ts = this.viewScale;
    const pad = Math.max(3, ts * 0.05);
    const fontSize = ImGui.GetFontSize();
    const nameLineH = fontSize + 2;
    const nameAreaH = nameLineH * 2 + 6;
    const gap = Math.max(6, ts * 0.07);
    const cardW = ts + pad * 2;
    const stripH = Math.max(3, ts * 0.035);
    const cardH = ts + pad + stripH + nameAreaH;
    const winX2 = ImGui.GetWindowPos().x + ImGui.GetWindowContentRegionMax().x;

    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(gap, gap));

    for (let i = 0; i < assets.length; i++) {
      const obj = assets[i];
      const isSel = Selection.isSelected(obj);
      const name = this.getDisplayName(obj);
      const cat = this.classifyObject(obj);
      const col = CATEGORY_COLORS[cat ?? 'Textures'];

      ImGui.PushID(obj.getInstanceId());
      ImGui.BeginGroup();

      const origin = ImGui.GetCursorScreenPos();
      const dl = ImGui.GetWindowDrawList();

      // ── 卡片整体背景（深灰色圆角矩形）──
      dl.AddRectFilled(
        new ImGui.Vec2(origin.x, origin.y),
        new ImGui.Vec2(origin.x + cardW, origin.y + cardH),
        colU32(isSel ? [THEME.selection[0], THEME.selection[1], THEME.selection[2], 0.5] : [0.15, 0.15, 0.15, 1]),
        4,
      );

      // ── 缩略图区域（深色背景，顶部圆角）──
      const thumbMin = new ImGui.Vec2(origin.x, origin.y);
      const thumbMax = new ImGui.Vec2(origin.x + cardW, origin.y + ts);

      dl.AddRectFilled(thumbMin, thumbMax,
        colU32([0.08, 0.08, 0.08, 1]), 4);

      // ── 缩略图内容（居中显示）──
      let drewThumb = false;

      if (obj instanceof Texture && obj.definition?.image) {
        const thumb = this.getOrCreateThumbnail(obj);

        if (thumb) {
          const thumbSize = ts - pad * 2;

          ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + pad, origin.y + pad));
          ImGui.Image(thumb, new ImGui.Vec2(thumbSize, thumbSize));
          drewThumb = true;
        }
      }
      if (!drewThumb && cat) {
        const [ar, ag, ab] = col.accent;

        this.drawAssetIcon(dl, cat,
          origin.x + cardW / 2, origin.y + ts / 2,
          Math.max(0.4, ts / 100),
          new ImGui.Vec4(ar, ag, ab, 1),
        );
      }

      // ── 类型色条（横跨卡片宽度，缩略图与名称之间）──
      const [sr, sg, sb] = col.accent;

      dl.AddRectFilled(
        new ImGui.Vec2(origin.x, thumbMax.y),
        new ImGui.Vec2(origin.x + cardW, thumbMax.y + stripH),
        colU32([sr, sg, sb, 1]),
      );

      // ── 名称区（左对齐 + 类型标签）──
      const nameAreaTop = thumbMax.y + stripH + 3;
      const maxTextW = cardW - 8;
      const textX = origin.x + 4;

      // 名称文字（截断处理）
      let text = name;

      if (ImGui.CalcTextSize(text).x > maxTextW) {
        while (text.length > 1 && ImGui.CalcTextSize(text + '..').x > maxTextW) {
          text = text.slice(0, -1);
        }
        text += '..';
      }

      dl.AddText(new ImGui.Vec2(textX, nameAreaTop),
        colU32(isSel ? [1, 1, 1, 1] : THEME.textPrimary), text);

      // 类型标签（单数形式 + 省略号截断）
      if (cat) {
        let typeLabel = this.getCategorySingular(cat);

        if (ImGui.CalcTextSize(typeLabel).x > maxTextW) {
          while (typeLabel.length > 1 && ImGui.CalcTextSize(typeLabel + '..').x > maxTextW) {
            typeLabel = typeLabel.slice(0, -1);
          }
          typeLabel += '..';
        }
        dl.AddText(new ImGui.Vec2(textX, nameAreaTop + nameLineH),
          colU32(THEME.textMuted), typeLabel);
      }

      // ── 交互层 ──
      ImGui.SetCursorScreenPos(origin);
      ImGui.InvisibleButton('##card', new ImGui.Vec2(cardW, cardH));

      if (ImGui.IsItemClicked()) { Selection.select(obj); }

      // 悬停态
      if (ImGui.IsItemHovered()) {
        dl.AddRect(
          new ImGui.Vec2(origin.x - 0.5, origin.y - 0.5),
          new ImGui.Vec2(origin.x + cardW + 0.5, origin.y + cardH + 0.5),
          colU32([0.5, 0.5, 0.5, 0.5]), 4, 0, 1.2,
        );
        ImGui.BeginTooltip();
        ImGui.PushStyleColor(ImGui.ImGuiCol.Text, col4(THEME.textHeader));
        ImGui.Text(name);
        ImGui.PopStyleColor(1);
        ImGui.TextColored(col4(THEME.textMuted), `${cat ?? ''}  ${this.getAssetSummary(obj)}`);
        ImGui.EndTooltip();
      }

      // 选中态
      if (isSel) {
        dl.AddRect(
          new ImGui.Vec2(origin.x - 1, origin.y - 1),
          new ImGui.Vec2(origin.x + cardW + 1, origin.y + cardH + 1),
          colU32(THEME.selection), 4, 0, 2,
        );
      }

      // 拖拽
      if (ImGui.BeginDragDropSource(ImGui.DragDropFlags.None)) {
        ImGui.SetDragDropPayload(obj.constructor.name, obj);
        ImGui.Text(name);
        ImGui.EndDragDropSource();
      }

      ImGui.EndGroup();

      // 自动换行
      const endX = ImGui.GetItemRectMax().x;

      if (i + 1 < assets.length && endX + gap + cardW < winX2) {
        ImGui.SameLine();
      }

      ImGui.PopID();
    }

    ImGui.PopStyleVar(1);
  }

  // ── 列表视图 ──────────────────────────────────────────────────────

  private drawListView (assets: EffectsObject[]): void {
    const dl = ImGui.GetWindowDrawList();
    const contentW = ImGui.GetContentRegionAvail().x;
    const nameColX = 28;
    const detailColX = contentW * 0.50;
    const typeColX = contentW * 0.75;
    const rowH = 24;

    // ── 表头 ──
    ImGui.PushStyleColor(ImGui.ImGuiCol.Text, col4(THEME.textMuted));
    ImGui.SetCursorPosX(nameColX);
    ImGui.Text('Name');
    ImGui.SameLine(detailColX);
    ImGui.Text('Details');
    ImGui.SameLine(typeColX);
    ImGui.Text('Type');
    ImGui.PopStyleColor(1);

    // 表头分割线
    const sepStart = ImGui.GetCursorScreenPos();
    const winX = ImGui.GetWindowPos().x;
    const winW = ImGui.GetWindowSize().x;

    dl.AddLine(
      new ImGui.Vec2(winX, sepStart.y + 1),
      new ImGui.Vec2(winX + winW, sepStart.y + 1),
      colU32(THEME.separator), 1,
    );
    ImGui.Dummy(new ImGui.Vec2(0, 4));

    // ── 数据行 ──
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 2));

    for (let i = 0; i < assets.length; i++) {
      const obj = assets[i];
      const isSel = Selection.isSelected(obj);
      const name = this.getDisplayName(obj);
      const cat = this.classifyObject(obj);
      const summary = this.getAssetSummary(obj);
      const col = CATEGORY_COLORS[cat ?? 'Textures'];
      const [ar, ag, ab] = col.accent;

      ImGui.PushID(obj.getInstanceId());

      // 记录行起始位置（用于后续绘制图标）
      const rowScreenX = ImGui.GetCursorScreenPos().x;
      const rowY = ImGui.GetCursorScreenPos().y;

      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, col4(THEME.selectionDim));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, col4(THEME.hover));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, col4(THEME.selection));

      ImGui.SetCursorPosX(nameColX);
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, col4(THEME.textPrimary));
      if (ImGui.Selectable(`${name}##row`, isSel,
        ImGui.SelectableFlags.SpanAllColumns, new ImGui.Vec2(0, rowH))) {
        Selection.select(obj);
      }
      ImGui.PopStyleColor(1);

      // 图标背景矩形 + 类型图标或缩略图（绘制在 Selectable 之后，确保不被 hover 背景覆盖）
      const iconBgSize = 18;
      const iconBgX = rowScreenX + 3;
      const iconBgY = rowY + (rowH - iconBgSize) / 2;

      dl.AddRectFilled(
        new ImGui.Vec2(iconBgX, iconBgY),
        new ImGui.Vec2(iconBgX + iconBgSize, iconBgY + iconBgSize),
        colU32([0.08, 0.08, 0.08, 1]), 2,
      );

      let drewThumb = false;

      if (obj instanceof Texture && obj.definition?.image) {
        const thumb = this.getOrCreateThumbnail(obj);

        if (thumb) {
          const thumbSize = iconBgSize - 2;
          const thumbX = iconBgX + 1;
          const thumbY = iconBgY + 1;

          ImGui.SetCursorScreenPos(new ImGui.Vec2(thumbX, thumbY));
          ImGui.Image(thumb, new ImGui.Vec2(thumbSize, thumbSize));
          drewThumb = true;
        }
      }
      if (!drewThumb) {
        const iconCx = iconBgX + iconBgSize / 2;
        const iconCy = iconBgY + iconBgSize / 2;

        this.drawListRowIcon(dl, cat, iconCx, iconCy, colU32([ar, ag, ab, 1]));
      }

      // 拖拽
      if (ImGui.BeginDragDropSource(ImGui.DragDropFlags.None)) {
        ImGui.SetDragDropPayload(obj.constructor.name, obj);
        ImGui.Text(name);
        ImGui.EndDragDropSource();
      }

      // 详情列
      ImGui.SameLine(detailColX);
      ImGui.TextColored(col4(THEME.textMuted), summary);

      // 类型列（单数形式）
      ImGui.SameLine(typeColX);
      const typeLabel = cat ? this.getCategorySingular(cat) : '';

      ImGui.TextColored(col4([ar, ag, ab, 0.85]), typeLabel);

      ImGui.PopStyleColor(3);
      ImGui.PopID();
    }

    ImGui.PopStyleVar(1);
  }

  /** 列表行的类型小图标（按分类绘制不同形状，单色） */
  private drawListRowIcon (dl: ImGui.ImDrawList, cat: string | null, cx: number, cy: number, color: number): void {
    const s = 4;

    switch (cat) {
      case 'Textures': {
        // 山峰 + 太阳
        dl.AddTriangleFilled(
          new ImGui.Vec2(cx - s, cy + s * 0.55),
          new ImGui.Vec2(cx - s * 0.15, cy - s * 0.35),
          new ImGui.Vec2(cx + s * 0.4, cy + s * 0.55), color);
        dl.AddTriangleFilled(
          new ImGui.Vec2(cx - s * 0.05, cy + s * 0.55),
          new ImGui.Vec2(cx + s * 0.4, cy - s * 0.05),
          new ImGui.Vec2(cx + s, cy + s * 0.55), color);
        dl.AddCircleFilled(
          new ImGui.Vec2(cx + s * 0.55, cy - s * 0.4), s * 0.2, color, 8);

        break;
      }
      case 'Materials': {
        // 材质球
        dl.AddCircleFilled(new ImGui.Vec2(cx, cy), s * 0.75, color, 16);

        break;
      }
      case 'Shaders': {
        // 代码括号 </>
        const lw = 1.4;

        dl.AddLine(
          new ImGui.Vec2(cx - s * 0.25, cy - s * 0.6),
          new ImGui.Vec2(cx - s * 0.75, cy), color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx - s * 0.75, cy),
          new ImGui.Vec2(cx - s * 0.25, cy + s * 0.6), color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx + s * 0.1, cy - s * 0.7),
          new ImGui.Vec2(cx - s * 0.1, cy + s * 0.7), color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx + s * 0.25, cy - s * 0.6),
          new ImGui.Vec2(cx + s * 0.75, cy), color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx + s * 0.75, cy),
          new ImGui.Vec2(cx + s * 0.25, cy + s * 0.6), color, lw);

        break;
      }
      case 'Geometries': {
        // 等距立方体
        const lw = 1.2;
        const r = s * 0.8;

        dl.AddQuad(
          new ImGui.Vec2(cx, cy - r * 0.75), new ImGui.Vec2(cx + r, cy - r * 0.2),
          new ImGui.Vec2(cx, cy + r * 0.05), new ImGui.Vec2(cx - r, cy - r * 0.2),
          color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx - r, cy - r * 0.2),
          new ImGui.Vec2(cx - r, cy + r * 0.3), color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx, cy + r * 0.05),
          new ImGui.Vec2(cx, cy + r * 0.75), color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx + r, cy - r * 0.2),
          new ImGui.Vec2(cx + r, cy + r * 0.3), color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx - r, cy + r * 0.3),
          new ImGui.Vec2(cx, cy + r * 0.75), color, lw);
        dl.AddLine(
          new ImGui.Vec2(cx, cy + r * 0.75),
          new ImGui.Vec2(cx + r, cy + r * 0.3), color, lw);

        break;
      }
      case 'AnimationClips': {
        // 胶片帧 + 播放三角
        const hw = s * 0.85;
        const hh = s * 0.7;

        dl.AddRect(
          new ImGui.Vec2(cx - hw, cy - hh),
          new ImGui.Vec2(cx + hw, cy + hh), color, 1, 0, 1.2);
        dl.AddTriangleFilled(
          new ImGui.Vec2(cx - s * 0.25, cy - s * 0.4),
          new ImGui.Vec2(cx + s * 0.45, cy),
          new ImGui.Vec2(cx - s * 0.25, cy + s * 0.4), color);

        break;
      }
      default:
        dl.AddCircleFilled(new ImGui.Vec2(cx, cy), 3, color, 8);

        break;
    }
  }

  // ── 底部状态栏 ────────────────────────────────────────────────────

  private drawBottomBar (): void {
    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, col4(THEME.headerBg));
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(10, 0));
    ImGui.BeginChild('##BottomBar', new ImGui.Vec2(0, 28), false);

    const barH = 28;
    const dl = ImGui.GetWindowDrawList();
    const barOrigin = ImGui.GetCursorScreenPos();

    // 顶部分割线
    dl.AddLine(
      new ImGui.Vec2(barOrigin.x, barOrigin.y),
      new ImGui.Vec2(barOrigin.x + ImGui.GetWindowSize().x, barOrigin.y),
      colU32(THEME.separator), 1,
    );

    // 左侧资产计数
    ImGui.SetCursorPosY((barH - ImGui.GetFontSize()) / 2);
    const countText = this.selectedCategory === 'All'
      ? `${this.filteredCount} assets`
      : `${this.filteredCount} ${this.selectedCategory}`;

    ImGui.TextColored(col4(THEME.textMuted), countText);

    // 右侧缩放滑块（自定义 DrawList 渲染）
    this.drawCustomSlider(dl, barOrigin, barH);

    ImGui.EndChild();
    ImGui.PopStyleVar(1);
    ImGui.PopStyleColor(1);
  }

  /** 用 DrawList 绘制自定义样式滑块 */
  private drawCustomSlider (dl: ImGui.ImDrawList, barOrigin: ImGui.Vec2, barH: number): void {
    const sliderW = 120;
    const trackH = 4;
    const thumbR = 6;
    const winW = ImGui.GetWindowSize().x;
    const sliderX = barOrigin.x + winW - sliderW - 16;
    const sliderY = barOrigin.y + barH / 2;

    // 列表图标（左端）
    const listIconX = sliderX - 18;
    const listIconY = sliderY;
    const lic = colU32(THEME.textMuted);

    dl.AddRectFilled(new ImGui.Vec2(listIconX - 4, listIconY - 3),
      new ImGui.Vec2(listIconX + 4, listIconY - 1.5), lic, 0.5);
    dl.AddRectFilled(new ImGui.Vec2(listIconX - 4, listIconY - 0.5),
      new ImGui.Vec2(listIconX + 4, listIconY + 1), lic, 0.5);
    dl.AddRectFilled(new ImGui.Vec2(listIconX - 4, listIconY + 2),
      new ImGui.Vec2(listIconX + 4, listIconY + 3.5), lic, 0.5);

    // 网格图标（右端）
    const gridIconX = sliderX + sliderW + 16;
    const gridIconY = sliderY;
    const gic = colU32(THEME.textMuted);
    const gs = 2.5;
    const gg = 1;

    dl.AddRectFilled(new ImGui.Vec2(gridIconX - gs * 2 - gg, gridIconY - gs * 2 - gg),
      new ImGui.Vec2(gridIconX - gg, gridIconY - gg), gic, 0.5);
    dl.AddRectFilled(new ImGui.Vec2(gridIconX + gg, gridIconY - gs * 2 - gg),
      new ImGui.Vec2(gridIconX + gs * 2 + gg, gridIconY - gg), gic, 0.5);
    dl.AddRectFilled(new ImGui.Vec2(gridIconX - gs * 2 - gg, gridIconY + gg),
      new ImGui.Vec2(gridIconX - gg, gridIconY + gs * 2 + gg), gic, 0.5);
    dl.AddRectFilled(new ImGui.Vec2(gridIconX + gg, gridIconY + gg),
      new ImGui.Vec2(gridIconX + gs * 2 + gg, gridIconY + gs * 2 + gg), gic, 0.5);

    // 轨道背景
    dl.AddRectFilled(
      new ImGui.Vec2(sliderX, sliderY - trackH / 2),
      new ImGui.Vec2(sliderX + sliderW, sliderY + trackH / 2),
      colU32([0.04, 0.04, 0.04, 1]), 2,
    );

    // 当前值对应位置
    const t = (this.viewScale - 16) / (200 - 16);
    const thumbX = sliderX + t * sliderW;

    // 填充轨道（已用部分）
    dl.AddRectFilled(
      new ImGui.Vec2(sliderX, sliderY - trackH / 2),
      new ImGui.Vec2(thumbX, sliderY + trackH / 2),
      colU32([0.25, 0.25, 0.25, 1]), 2,
    );

    // 滑块把手
    dl.AddCircleFilled(new ImGui.Vec2(thumbX, sliderY), thumbR, colU32([0.55, 0.55, 0.55, 1]), 16);
    dl.AddCircleFilled(new ImGui.Vec2(thumbX, sliderY), thumbR - 2, colU32([0.40, 0.40, 0.40, 1]), 16);

    // 交互层 — 覆盖滑块区域的隐形按钮
    const hitPad = 10;

    ImGui.SetCursorScreenPos(new ImGui.Vec2(sliderX - hitPad, barOrigin.y));
    ImGui.InvisibleButton('##ScaleSlider', new ImGui.Vec2(sliderW + hitPad * 2, barH));

    if (ImGui.IsItemActive()) {
      const mouseX = ImGui.GetIO().MousePos.x;
      const newT = Math.max(0, Math.min(1, (mouseX - sliderX) / sliderW));

      this.viewScale = Math.round(16 + newT * (200 - 16));
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetMouseCursor(ImGui.ImGuiMouseCursor.ResizeEW);
    }
  }

  // ── 矢量图标 ──────────────────────────────────────────────────────

  private drawAssetIcon (
    dl: ImGui.ImDrawList, category: string,
    cx: number, cy: number, scale: number, accent: ImGui.Vec4,
  ): void {
    const c = ImGui.GetColorU32(accent);
    const cl = ImGui.GetColorU32(new ImGui.Vec4(
      Math.min(1, accent.x + 0.2),
      Math.min(1, accent.y + 0.2),
      Math.min(1, accent.z + 0.2), 0.7));
    const s = scale;

    switch (category) {
      case 'Textures': {
        // 山峰+太阳
        const r = 14 * s;

        dl.AddTriangleFilled(
          new ImGui.Vec2(cx - r * 0.8, cy + r * 0.65),
          new ImGui.Vec2(cx - r * 0.15, cy - r * 0.4),
          new ImGui.Vec2(cx + r * 0.35, cy + r * 0.65), c);
        dl.AddTriangleFilled(
          new ImGui.Vec2(cx - r * 0.05, cy + r * 0.65),
          new ImGui.Vec2(cx + r * 0.35, cy - r * 0.05),
          new ImGui.Vec2(cx + r * 0.8, cy + r * 0.65), cl);
        dl.AddCircleFilled(new ImGui.Vec2(cx + r * 0.45, cy - r * 0.4), r * 0.22, cl, 10);

        break;
      }
      case 'Materials': {
        // 材质球
        const r = 13 * s;

        dl.AddCircleFilled(new ImGui.Vec2(cx, cy), r, c, 28);
        dl.AddCircleFilled(new ImGui.Vec2(cx - r * 0.28, cy - r * 0.28), r * 0.25, cl, 14);

        break;
      }
      case 'Shaders': {
        // 代码括号 </>
        const r = 12 * s;
        const lw = 2.2 * s;

        dl.AddLine(new ImGui.Vec2(cx - r * 0.3, cy - r * 0.7), new ImGui.Vec2(cx - r * 0.9, cy), c, lw);
        dl.AddLine(new ImGui.Vec2(cx - r * 0.9, cy), new ImGui.Vec2(cx - r * 0.3, cy + r * 0.7), c, lw);
        dl.AddLine(new ImGui.Vec2(cx + r * 0.15, cy - r * 0.8), new ImGui.Vec2(cx - r * 0.15, cy + r * 0.8), cl, lw);
        dl.AddLine(new ImGui.Vec2(cx + r * 0.3, cy - r * 0.7), new ImGui.Vec2(cx + r * 0.9, cy), c, lw);
        dl.AddLine(new ImGui.Vec2(cx + r * 0.9, cy), new ImGui.Vec2(cx + r * 0.3, cy + r * 0.7), c, lw);

        break;
      }
      case 'Geometries': {
        // 等距立方体
        const r = 12 * s;
        const lw = 1.8 * s;

        dl.AddQuad(
          new ImGui.Vec2(cx, cy - r * 0.75), new ImGui.Vec2(cx + r, cy - r * 0.2),
          new ImGui.Vec2(cx, cy + r * 0.05), new ImGui.Vec2(cx - r, cy - r * 0.2), c, lw);
        dl.AddQuad(
          new ImGui.Vec2(cx - r, cy - r * 0.2), new ImGui.Vec2(cx, cy + r * 0.05),
          new ImGui.Vec2(cx, cy + r * 0.75), new ImGui.Vec2(cx - r, cy + r * 0.3), c, lw);
        dl.AddQuad(
          new ImGui.Vec2(cx, cy + r * 0.05), new ImGui.Vec2(cx + r, cy - r * 0.2),
          new ImGui.Vec2(cx + r, cy + r * 0.3), new ImGui.Vec2(cx, cy + r * 0.75), cl, lw);

        break;
      }
      case 'AnimationClips': {
        // 播放键 + 圆圈
        const r = 13 * s;

        dl.AddCircle(new ImGui.Vec2(cx, cy), r, c, 24, 2 * s);
        dl.AddTriangleFilled(
          new ImGui.Vec2(cx - r * 0.3, cy - r * 0.5),
          new ImGui.Vec2(cx - r * 0.3, cy + r * 0.5),
          new ImGui.Vec2(cx + r * 0.55, cy), c);

        break;
      }
      default:
        break;
    }
  }

  // ── 辅助方法 ──────────────────────────────────────────────────────

  private getCategorySingular (cat: string): string {
    const singularMap: Record<string, string> = {
      Textures: 'Texture',
      Materials: 'Material',
      Shaders: 'Shader',
      Geometries: 'Geometry',
      AnimationClips: 'AnimationClip',
    };

    return singularMap[cat] ?? cat;
  }

  private getDisplayName (obj: EffectsObject): string {
    if ('name' in obj) {
      const name = (obj as { name: string }).name;

      if (typeof name === 'string' && name.length > 0) { return name; }
    }
    if (obj instanceof Shader && obj.shaderData?.name) { return obj.shaderData.name; }
    if (obj instanceof ShaderVariant && obj.source?.name) { return obj.source.name; }
    const g = obj.getInstanceId();

    return g.length > 10 ? g.substring(0, 10) + '..' : g;
  }

  private getAssetSummary (obj: EffectsObject): string {
    if (obj instanceof Texture) { return `${obj.width}x${obj.height}`; }
    if (obj instanceof Geometry) { return `${obj.subMeshes.length} submesh`; }
    if (obj instanceof AnimationClip) {
      const n = obj.positionCurves.length + obj.rotationCurves.length +
        obj.eulerCurves.length + obj.scaleCurves.length +
        obj.floatCurves.length + obj.colorCurves.length;

      return `${obj.duration.toFixed(1)}s  ${n} curves`;
    }

    return obj.constructor.name;
  }

  private getOrCreateThumbnail (obj: Texture): WebGLTexture | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = (obj as any).__imguiAssetThumb as WebGLTexture | undefined;

    if (cached) { return cached; }
    if (!obj.definition?.image || !ImGui_Impl.gl) { return null; }

    const gl = ImGui_Impl.gl;
    const tex = gl.createTexture();

    if (!tex) { return null; }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, obj.definition.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).__imguiAssetThumb = tex;

    return tex;
  }
}
