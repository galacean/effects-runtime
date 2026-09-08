import { generateGUID, glContext, spec } from '@galacean/effects';
import '@galacean/effects-plugin-model';
import { GLTFTools, ModelIO } from '@vvfx/resource-detection';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import {
  ContentDatabaseEvent, createJsonAssetFile, isJsonAssetFile, readFileAsDataUrl,
} from '../editor/content';
import { generateAssetScene } from '../editor/content/preview-utils';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';
import {
  CONTENT_ROOT_PATH,
  ContentBrowserModel,
  type ContentBrowserEntry,
  type ContentFileSystemEntry,
  type ContentFolderEntry,
} from './content-model';

type ViewMode = 'tiles' | 'list';

const THEME = {
  panel: [0.102, 0.102, 0.102, 1] as const,
  header: [0.078, 0.078, 0.078, 1] as const,
  input: [0.059, 0.059, 0.059, 1] as const,
  hover: [0.149, 0.149, 0.149, 1] as const,
  selection: [0, 0.376, 0.82, 1] as const,
  selectionDim: [0, 0.376, 0.82, 0.42] as const,
  text: [0.82, 0.82, 0.82, 1] as const,
  muted: [0.48, 0.48, 0.48, 1] as const,
  folder: [0.86, 0.65, 0.13, 1] as const,
  separator: [0.025, 0.025, 0.025, 1] as const,
};

const TYPE_COLORS: Record<string, readonly [number, number, number, number]> = {
  Texture: [0.20, 0.50, 0.85, 1],
  Material: [0.20, 0.70, 0.40, 1],
  Shader: [0.55, 0.30, 0.80, 1],
  ShaderVariant: [0.55, 0.30, 0.80, 1],
  Geometry: [0.20, 0.65, 0.70, 1],
  AnimationClip: [0.90, 0.50, 0.20, 1],
};

function color (value: readonly [number, number, number, number]): ImGui.ImVec4 {
  return new ImGui.ImVec4(value[0], value[1], value[2], value[3]);
}

function colorU32 (value: readonly [number, number, number, number]): number {
  return ImGui.GetColorU32(color(value));
}

@editorWindow()
export class Content extends EditorWindow {
  private readonly model = new ContentBrowserModel();
  private readonly selectedKeys = new Set<string>();
  private readonly folderSearchBuffer: ImGui.ImScalar<string> = [''];
  private readonly itemSearchBuffer: ImGui.ImScalar<string> = [''];
  private readonly newFolderBuffer: ImGui.ImScalar<string> = ['New Folder'];
  private readonly renameBuffer: ImGui.ImScalar<string> = [''];
  private readonly typeFilters = new Set<string>();

  private viewMode: ViewMode = 'tiles';
  private viewScale = 1;
  private showExtensions = false;
  private workspaceDirty = true;
  private observedContentDatabase: object | undefined;
  private selectionAnchor = -1;
  private status = '';
  private busy = false;
  private requestNewFolderPopup = false;
  private requestRenamePopup = false;
  private requestDeletePopup = false;
  private focusItemSearch = false;
  private closeNewFolderPopup = false;
  private closeRenamePopup = false;
  private closeDeletePopup = false;
  private renamingItem: ContentFileSystemEntry | undefined;
  private deletingItems: ContentFileSystemEntry[] = [];

  @menuItem('Window/Content')
  static showWindow () {
    EditorWindow.getWindow(Content).open();
  }

  static allowDrop (event: DragEvent): void {
    event.preventDefault();
    const io = ImGui.GetIO();

    io.MousePos.x = event.offsetX;
    io.MousePos.y = event.offsetY;
  }

  static async drop (event: DragEvent): Promise<void> {
    event.preventDefault();
    if (!event.dataTransfer) {
      return;
    }

    const contentWindow = EditorWindow.getWindow(Content);

    if (contentWindow.isHovered()) {
      await contentWindow.importFiles(event.dataTransfer.files);
    }
  }

  constructor () {
    super();
    this.title = 'Content';
    this.open();
  }

  protected override onGUI (): void {
    const content = GalaceanEffects.editorContent;

    if (!content) {
      ImGui.TextColored(color(THEME.muted), 'Content is not initialized.');

      return;
    }

    const database = content.contentDatabase;

    if (database !== this.observedContentDatabase) {
      this.observedContentDatabase = database;
      database.on(ContentDatabaseEvent.WorkspaceModified, () => this.workspaceDirty = true);
      database.on(ContentDatabaseEvent.ItemAdded, () => this.workspaceDirty = true);
      database.on(ContentDatabaseEvent.ItemRemoved, () => this.workspaceDirty = true);
      database.on(ContentDatabaseEvent.WorkspaceRebuilt, () => this.workspaceDirty = true);
      this.workspaceDirty = true;
    }

    if (this.workspaceDirty) {
      this.workspaceDirty = false;
      this.model.setSnapshot(
        database.getAllDirectories(),
        content.assetsCache.getAllAssets(),
        database.getAllFiles(),
      );
      this.pruneSelection();
    }

    this.drawToolbar();

    if (!database.hasWorkspace) {
      const avail = ImGui.GetContentRegionAvail();

      ImGui.SetCursorPos(new ImGui.Vec2(Math.max(8, avail.x * 0.5 - 130), Math.max(8, avail.y * 0.5 - 12)));
      ImGui.TextColored(color(THEME.muted), 'Open a local project or Content folder.');
      this.drawDialogs();

      return;
    }

    const width = ImGui.GetContentRegionAvail().x;
    const folderPaneWidth = Math.min(260, Math.max(170, width * 0.22));

    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, color(THEME.header));
    ImGui.PushStyleColor(ImGui.ImGuiCol.Border, color(THEME.separator));
    ImGui.BeginChild('##ContentFolders', new ImGui.Vec2(folderPaneWidth, 0), ImGui.ChildFlags.Borders);
    this.drawFolderPane();
    ImGui.EndChild();
    ImGui.PopStyleColor(2);

    ImGui.SameLine(0, 0);

    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, color(THEME.panel));
    ImGui.PushStyleColor(ImGui.ImGuiCol.Border, color(THEME.separator));
    ImGui.BeginChild('##ContentItems', new ImGui.Vec2(0, 0), ImGui.ChildFlags.Borders);
    this.drawItemPane();
    ImGui.EndChild();
    ImGui.PopStyleColor(2);

    this.drawDialogs();
  }

  private drawToolbar (): void {
    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, color(THEME.header));
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(6, 4));
    ImGui.BeginChild('##ContentToolbar', new ImGui.Vec2(0, 34), ImGui.ChildFlags.None);

    const hasWorkspace = GalaceanEffects.editorContent.contentDatabase.hasWorkspace;

    this.drawToolbarButton('Open Folder', false, () => {
      void this.chooseFolder();
    }, 'Open a local project folder or Content folder.');
    ImGui.SameLine();
    this.drawToolbarButton('Import', !hasWorkspace, () => this.chooseImportFiles(), 'Import JsonAsset files into this folder.');
    ImGui.SameLine();
    this.drawToolbarButton('+', !hasWorkspace, () => {
      this.newFolderBuffer[0] = 'New Folder';
      this.requestNewFolderPopup = true;
    }, 'Create a folder.');
    ImGui.SameLine();
    ImGui.TextColored(color(THEME.muted), '|');
    ImGui.SameLine();

    this.drawToolbarButton('<', !this.model.canNavigateBackward, () => {
      if (this.model.navigateBackward()) {
        this.onNavigated(true);
      }
    }, 'Navigate backward (Backspace).');
    ImGui.SameLine();
    this.drawToolbarButton('>', !this.model.canNavigateForward, () => {
      if (this.model.navigateForward()) {
        this.onNavigated(true);
      }
    }, 'Navigate forward.');
    ImGui.SameLine();
    this.drawToolbarButton('^', !this.model.canNavigateUp, () => {
      if (this.model.navigateUp()) {
        this.onNavigated();
      }
    }, 'Navigate up.');
    ImGui.SameLine();
    ImGui.TextColored(color(THEME.muted), '|');
    ImGui.SameLine();

    const breadcrumbs = this.model.getBreadcrumbs();

    for (let i = 0; i < breadcrumbs.length; i++) {
      const breadcrumb = breadcrumbs[i];

      if (i > 0) {
        ImGui.TextColored(color(THEME.muted), '>');
        ImGui.SameLine();
      }
      if (ImGui.SmallButton(`${breadcrumb.name}##breadcrumb-${breadcrumb.path}`)) {
        this.navigate(breadcrumb.path);
      }
      if (i < breadcrumbs.length - 1) {
        ImGui.SameLine();
      }
    }

    const viewButtonWidth = 60;

    if (ImGui.GetContentRegionAvail().x > viewButtonWidth) {
      ImGui.SameLine(ImGui.GetWindowWidth() - viewButtonWidth - 8);
    }
    if (ImGui.Button('View')) {
      ImGui.OpenPopup('##ContentViewOptions');
    }
    this.drawViewOptions();

    ImGui.EndChild();
    ImGui.PopStyleVar();
    ImGui.PopStyleColor();
  }

  private drawToolbarButton (label: string, disabled: boolean, action: () => void, tooltip: string): void {
    ImGui.BeginDisabled(disabled || this.busy);
    if (ImGui.Button(label)) {
      action();
    }
    ImGui.EndDisabled();
    if (ImGui.IsItemHovered()) {
      ImGui.BeginTooltip();
      ImGui.Text(tooltip);
      ImGui.EndTooltip();
    }
  }

  private drawViewOptions (): void {
    if (!ImGui.BeginPopup('##ContentViewOptions')) {
      return;
    }

    ImGui.TextDisabled('View type');
    if (ImGui.MenuItem('Tiles', '', this.viewMode === 'tiles')) {
      this.viewMode = 'tiles';
    }
    if (ImGui.MenuItem('List', '', this.viewMode === 'list')) {
      this.viewMode = 'list';
    }
    ImGui.Separator();
    ImGui.TextDisabled('View scale');
    ImGui.SetNextItemWidth(190);
    ImGui.SliderFloat('##ContentViewScale', (value = this.viewScale) => this.viewScale = value, 0.55, 1.8, '%.2f');
    ImGui.Separator();
    if (ImGui.MenuItem('Show file extensions', '', this.showExtensions)) {
      this.showExtensions = !this.showExtensions;
    }
    if (ImGui.BeginMenu('Asset type filters')) {
      const types = this.model.getAssetTypes();

      if (types.length === 0) {
        ImGui.MenuItem('No asset types', '', false, false);
      }
      for (const typeName of types) {
        const selected = this.typeFilters.has(typeName);

        if (ImGui.MenuItem(typeName, '', selected)) {
          if (selected) {
            this.typeFilters.delete(typeName);
          } else {
            this.typeFilters.add(typeName);
          }
        }
      }
      if (this.typeFilters.size > 0) {
        ImGui.Separator();
        if (ImGui.MenuItem('Clear filters')) {
          this.typeFilters.clear();
        }
      }
      ImGui.EndMenu();
    }
    ImGui.Separator();
    if (ImGui.MenuItem('Sort ascending', '', this.model.sortOrder === 'ascending')) {
      this.model.sortOrder = 'ascending';
    }
    if (ImGui.MenuItem('Sort descending', '', this.model.sortOrder === 'descending')) {
      this.model.sortOrder = 'descending';
    }
    ImGui.EndPopup();
  }

  private drawFolderPane (): void {
    ImGui.PushStyleColor(ImGui.ImGuiCol.FrameBg, color(THEME.input));
    ImGui.SetNextItemWidth(-1);
    ImGui.InputTextWithHint('##FolderSearch', 'Search folders', this.folderSearchBuffer, 256);
    ImGui.PopStyleColor();
    ImGui.Separator();

    const visible = new Set(this.model.getVisibleFolders(this.folderSearchBuffer[0]).map(folder => folder.path));
    const root = this.model.getFolder(CONTENT_ROOT_PATH);

    if (root) {
      this.drawFolderTree(root, visible);
    }
  }

  private drawFolderTree (folder: ContentFolderEntry, visible: ReadonlySet<string>): void {
    if (!visible.has(folder.path)) {
      return;
    }

    const visibleChildren = folder.childPaths
      .map(path => this.model.getFolder(path))
      .filter((child): child is ContentFolderEntry => Boolean(child && visible.has(child.path)));
    let flags = ImGui.TreeNodeFlags.OpenOnArrow |
      ImGui.TreeNodeFlags.OpenOnDoubleClick |
      ImGui.TreeNodeFlags.SpanAvailWidth;

    if (folder.path === this.model.currentPath) {
      flags |= ImGui.TreeNodeFlags.Selected;
    }
    if (visibleChildren.length === 0) {
      flags |= ImGui.TreeNodeFlags.Leaf | ImGui.TreeNodeFlags.NoTreePushOnOpen;
    }
    if (folder.path === CONTENT_ROOT_PATH) {
      flags |= ImGui.TreeNodeFlags.DefaultOpen;
    }
    if (this.folderSearchBuffer[0].trim().length > 0 && visibleChildren.length > 0) {
      ImGui.SetNextItemOpen(true, ImGui.Cond.Always);
    }

    const open = ImGui.TreeNodeEx(`${folder.name}##folder-${folder.path}`, flags);

    if (ImGui.IsItemClicked() && !ImGui.IsItemToggledOpen()) {
      this.navigate(folder.path);
    }

    if (open && visibleChildren.length > 0) {
      for (const child of visibleChildren) {
        this.drawFolderTree(child, visible);
      }
      ImGui.TreePop();
    }
  }

  private drawItemPane (): void {
    ImGui.PushStyleColor(ImGui.ImGuiCol.FrameBg, color(THEME.input));
    ImGui.SetNextItemWidth(-1);
    if (this.focusItemSearch) {
      ImGui.SetKeyboardFocusHere();
      this.focusItemSearch = false;
    }
    ImGui.InputTextWithHint('##ItemSearch', 'Search assets by name or ID', this.itemSearchBuffer, 256);
    ImGui.PopStyleColor();
    ImGui.Separator();

    const footerHeight = 24;
    const contentHeight = Math.max(1, ImGui.GetContentRegionAvail().y - footerHeight - ImGui.GetStyle().ItemSpacing.y);

    ImGui.BeginChild('##ContentView', new ImGui.Vec2(0, contentHeight), ImGui.ChildFlags.None);
    const entries = this.model.getItems(this.itemSearchBuffer[0], this.typeFilters);

    const io = ImGui.GetIO();

    if (ImGui.IsWindowHovered() && (io.KeyCtrl || io.KeySuper) && io.MouseWheel !== 0) {
      this.viewScale = Math.min(1.8, Math.max(0.55, this.viewScale + io.MouseWheel * 0.08));
    }
    this.handleKeyboard(entries);
    if (entries.length === 0) {
      const avail = ImGui.GetContentRegionAvail();

      ImGui.SetCursorPos(new ImGui.Vec2(Math.max(8, avail.x * 0.5 - 30), Math.max(8, avail.y * 0.5 - 10)));
      ImGui.TextColored(color(THEME.muted), this.isSearching ? 'No results' : 'Empty');
    } else if (this.viewMode === 'tiles') {
      this.drawTiles(entries);
    } else {
      this.drawList(entries);
    }

    if (ImGui.BeginPopupContextWindow('##ContentBackgroundMenu', ImGui.PopupFlags.MouseButtonRight | ImGui.PopupFlags.NoOpenOverItems)) {
      if (ImGui.MenuItem('New folder')) {
        this.newFolderBuffer[0] = 'New Folder';
        this.requestNewFolderPopup = true;
      }
      if (ImGui.MenuItem('Refresh')) {
        void this.refresh();
      }
      ImGui.EndPopup();
    }
    ImGui.EndChild();

    this.drawFooter(entries.length);
  }

  private get isSearching (): boolean {
    return this.itemSearchBuffer[0].trim().length > 0 || this.typeFilters.size > 0;
  }

  private drawTiles (entries: ContentBrowserEntry[]): void {
    const tileWidth = Math.round(90 * this.viewScale);
    const tileHeight = tileWidth + 38;
    const gap = Math.max(6, Math.round(8 * this.viewScale));
    const maxX = ImGui.GetCursorScreenPos().x + ImGui.GetContentRegionAvail().x;

    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(gap, gap));
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const key = this.getEntryKey(entry);
      const selected = this.selectedKeys.has(key);
      const origin = ImGui.GetCursorScreenPos();

      ImGui.PushID(key);
      ImGui.InvisibleButton('##ContentTile', new ImGui.Vec2(tileWidth, tileHeight));
      const hovered = ImGui.IsItemHovered();
      const clicked = ImGui.IsItemClicked(ImGui.MouseButton.Left);
      const doubleClicked = hovered && ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left);

      this.drawTileVisual(entry, origin, tileWidth, tileHeight, selected, hovered);
      if (clicked) {
        this.selectEntry(entries, i);
      }
      if (doubleClicked) {
        this.openEntry(entry);
      }
      this.drawItemContextMenu(entry, entries);
      this.drawDragSource(entry);

      const right = origin.x + tileWidth;

      if (i + 1 < entries.length && right + gap + tileWidth < maxX) {
        ImGui.SameLine();
      }
      ImGui.PopID();
    }
    ImGui.PopStyleVar();
  }

  private drawTileVisual (
    entry: ContentBrowserEntry,
    origin: ImGui.Vec2,
    width: number,
    height: number,
    selected: boolean,
    hovered: boolean,
  ): void {
    const drawList = ImGui.GetWindowDrawList();
    const background = selected ? THEME.selectionDim : hovered ? THEME.hover : ([0.14, 0.14, 0.14, 1] as const);
    const iconHeight = height - 38;

    drawList.AddRectFilled(origin, new ImGui.Vec2(origin.x + width, origin.y + height), colorU32(background), 4);
    drawList.AddRectFilled(origin, new ImGui.Vec2(origin.x + width, origin.y + iconHeight), colorU32([0.075, 0.075, 0.075, 1]), 4);
    this.drawEntryIcon(drawList, entry, origin.x + width * 0.5, origin.y + iconHeight * 0.5, Math.max(0.6, width / 100));

    const accent = entry.kind === 'folder' ? THEME.folder : this.getTypeColor(entry.info.typeName);

    drawList.AddRectFilled(
      new ImGui.Vec2(origin.x, origin.y + iconHeight),
      new ImGui.Vec2(origin.x + width, origin.y + iconHeight + 3),
      colorU32(accent),
    );

    const name = this.truncateText(this.getDisplayName(entry), width - 8);
    const details = entry.kind === 'folder' ? 'Folder' : entry.info.typeName;

    drawList.AddText(new ImGui.Vec2(origin.x + 4, origin.y + iconHeight + 6), colorU32(THEME.text), name);
    drawList.AddText(new ImGui.Vec2(origin.x + 4, origin.y + iconHeight + 22), colorU32(THEME.muted), this.truncateText(details, width - 8));

    if (selected) {
      drawList.AddRect(origin, new ImGui.Vec2(origin.x + width, origin.y + height), colorU32(THEME.selection), 4, 0, 2);
    }
    if (hovered) {
      ImGui.BeginTooltip();
      ImGui.Text(this.getDisplayName(entry));
      ImGui.TextColored(color(THEME.muted), entry.path);
      ImGui.EndTooltip();
    }
  }

  private drawList (entries: ContentBrowserEntry[]): void {
    const width = ImGui.GetContentRegionAvail().x;
    const pathX = Math.max(220, width * 0.48);
    const typeX = Math.max(pathX + 120, width * 0.78);

    ImGui.TextDisabled('Name');
    ImGui.SameLine(pathX);
    ImGui.TextDisabled('Path');
    ImGui.SameLine(typeX);
    ImGui.TextDisabled('Type');
    ImGui.Separator();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const key = this.getEntryKey(entry);
      const selected = this.selectedKeys.has(key);

      ImGui.PushID(key);
      ImGui.PushStyleColor(ImGui.ImGuiCol.Header, color(THEME.selectionDim));
      ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, color(THEME.hover));
      if (ImGui.Selectable(`   ${this.getDisplayName(entry)}##row`, selected, ImGui.SelectableFlags.SpanAllColumns, new ImGui.Vec2(0, 24))) {
        this.selectEntry(entries, i);
      }
      const hovered = ImGui.IsItemHovered();

      if (hovered && ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left)) {
        this.openEntry(entry);
      }
      this.drawListIcon(entry);
      this.drawItemContextMenu(entry, entries);
      this.drawDragSource(entry);
      ImGui.SameLine(pathX);
      ImGui.TextColored(color(THEME.muted), entry.parentPath ?? '');
      ImGui.SameLine(typeX);
      ImGui.TextColored(color(entry.kind === 'folder' ? THEME.folder : this.getTypeColor(entry.info.typeName)), entry.kind === 'folder' ? 'Folder' : entry.info.typeName);
      ImGui.PopStyleColor(2);
      ImGui.PopID();
    }
  }

  private drawListIcon (entry: ContentBrowserEntry): void {
    const min = ImGui.GetItemRectMin();
    const drawList = ImGui.GetWindowDrawList();

    this.drawEntryIcon(drawList, entry, min.x + 10, min.y + 12, 0.28);
  }

  private drawEntryIcon (drawList: ImGui.ImDrawList, entry: ContentBrowserEntry, cx: number, cy: number, scale: number): void {
    if (entry.kind === 'folder') {
      const width = 28 * scale;
      const height = 19 * scale;

      drawList.AddRectFilled(
        new ImGui.Vec2(cx - width * 0.46, cy - height * 0.62),
        new ImGui.Vec2(cx - width * 0.05, cy - height * 0.28),
        colorU32(THEME.folder), 2,
      );
      drawList.AddRectFilled(
        new ImGui.Vec2(cx - width * 0.5, cy - height * 0.35),
        new ImGui.Vec2(cx + width * 0.5, cy + height * 0.5),
        colorU32(THEME.folder), 3,
      );

      return;
    }

    const accent = this.getTypeColor(entry.info.typeName);
    const radius = 16 * scale;

    drawList.AddRectFilled(
      new ImGui.Vec2(cx - radius * 0.75, cy - radius),
      new ImGui.Vec2(cx + radius * 0.75, cy + radius),
      colorU32(accent), 3,
    );
    drawList.AddLine(
      new ImGui.Vec2(cx - radius * 0.42, cy),
      new ImGui.Vec2(cx + radius * 0.42, cy),
      colorU32([1, 1, 1, 0.75]), Math.max(1, scale * 1.5),
    );
  }

  private drawItemContextMenu (entry: ContentBrowserEntry, entries: readonly ContentBrowserEntry[]): void {
    if (!ImGui.BeginPopupContextItem('##ContentItemMenu')) {
      return;
    }

    if (!this.selectedKeys.has(this.getEntryKey(entry))) {
      this.selectedKeys.clear();
      this.selectedKeys.add(this.getEntryKey(entry));
      this.syncGlobalSelection([entry]);
    }

    if (ImGui.MenuItem('Open', 'Enter')) {
      this.openEntry(entry);
    }
    if (entry.kind !== 'folder') {
      if (entry.kind === 'asset') {
        if (ImGui.MenuItem('Reload')) {
          const asset = GalaceanEffects.editorContent.loadAsync(entry.info.id);

          if (asset) {
            void GalaceanEffects.editorContent.reloadAsset(asset);
          }
        }
      }
      ImGui.Separator();
      if (ImGui.MenuItem('Rename', 'F2')) {
        this.beginRename(entry);
      }
      if (ImGui.MenuItem('Delete', 'Delete')) {
        const selectedItems = entries.filter((candidate): candidate is ContentFileSystemEntry =>
          candidate.kind !== 'folder' && this.selectedKeys.has(this.getEntryKey(candidate)));

        this.beginDelete(selectedItems);
      }
    }
    if (entry.kind === 'asset') {
      ImGui.Separator();
      if (ImGui.MenuItem('Copy asset ID')) {
        this.copyText(entry.info.id);
      }
    }
    if (ImGui.MenuItem('Copy name')) {
      this.copyText(entry.name);
    }
    if (ImGui.MenuItem('Copy path')) {
      this.copyText(entry.path);
    }
    ImGui.EndPopup();
  }

  private drawDragSource (entry: ContentBrowserEntry): void {
    if (entry.kind !== 'asset' || !ImGui.BeginDragDropSource(ImGui.DragDropFlags.None)) {
      return;
    }

    const asset = GalaceanEffects.editorContent.loadAsync(entry.info.id);

    if (asset) {
      ImGui.SetDragDropPayload(asset.constructor.name, asset);
    }
    ImGui.Text(this.getDisplayName(entry));
    ImGui.TextColored(color(THEME.muted), entry.info.typeName);
    ImGui.EndDragDropSource();
  }

  private drawFooter (count: number): void {
    ImGui.Separator();
    const countLabel = `${count} item${count === 1 ? '' : 's'}`;

    ImGui.TextColored(color(THEME.muted), this.status ? `${countLabel}  |  ${this.status}` : countLabel);
    ImGui.SameLine(Math.max(150, ImGui.GetWindowWidth() - 150));
    ImGui.SetNextItemWidth(110);
    ImGui.SliderFloat('##FooterViewScale', (value = this.viewScale) => this.viewScale = value, 0.55, 1.8, '');
  }

  private handleKeyboard (entries: ContentBrowserEntry[]): void {
    if (!ImGui.IsWindowFocused(ImGui.FocusedFlags.ChildWindows) || ImGui.IsAnyItemActive()) {
      return;
    }

    const io = ImGui.GetIO();
    const command = io.KeyCtrl || io.KeySuper;

    if (command && ImGui.IsKeyPressed(ImGui.Key.F)) {
      this.focusItemSearch = true;

      return;
    }
    if (command && ImGui.IsKeyPressed(ImGui.Key.A)) {
      this.selectedKeys.clear();
      entries.forEach(entry => this.selectedKeys.add(this.getEntryKey(entry)));
      this.syncGlobalSelection(entries);

      return;
    }
    if (ImGui.IsKeyPressed(ImGui.Key.Backspace)) {
      if (this.model.navigateBackward()) {
        this.onNavigated(true);
      }

      return;
    }
    if (ImGui.IsKeyPressed(ImGui.Key.Enter) || ImGui.IsKeyPressed(ImGui.Key.KeypadEnter)) {
      entries.filter(entry => this.selectedKeys.has(this.getEntryKey(entry))).forEach(entry => this.openEntry(entry));

      return;
    }
    if (ImGui.IsKeyPressed(ImGui.Key.Escape)) {
      this.clearSelection();

      return;
    }
    if (ImGui.IsKeyPressed(ImGui.Key.F2)) {
      const selected = entries.filter((entry): entry is ContentFileSystemEntry => entry.kind !== 'folder' && this.selectedKeys.has(this.getEntryKey(entry)));

      if (selected.length === 1) {
        this.beginRename(selected[0]);
      }

      return;
    }
    if (ImGui.IsKeyPressed(ImGui.Key.Delete)) {
      const selected = entries.filter((entry): entry is ContentFileSystemEntry => entry.kind !== 'folder' && this.selectedKeys.has(this.getEntryKey(entry)));

      if (selected.length > 0) {
        this.beginDelete(selected);
      }

      return;
    }

    let offset = 0;
    const columns = this.viewMode === 'tiles'
      ? Math.max(1, Math.floor(ImGui.GetContentRegionAvail().x / Math.round(98 * this.viewScale)))
      : 1;

    if (ImGui.IsKeyPressed(ImGui.Key.LeftArrow)) {
      offset = -1;
    } else if (ImGui.IsKeyPressed(ImGui.Key.RightArrow)) {
      offset = 1;
    } else if (ImGui.IsKeyPressed(ImGui.Key.UpArrow)) {
      offset = -columns;
    } else if (ImGui.IsKeyPressed(ImGui.Key.DownArrow)) {
      offset = columns;
    }

    if (offset !== 0 && entries.length > 0) {
      const selectedIndex = entries.findIndex(entry => this.selectedKeys.has(this.getEntryKey(entry)));
      const nextIndex = Math.max(0, Math.min(entries.length - 1, (selectedIndex === -1 ? 0 : selectedIndex) + offset));

      this.selectEntry(entries, nextIndex);
    }
  }

  private selectEntry (entries: ContentBrowserEntry[], index: number): void {
    const io = ImGui.GetIO();
    const command = io.KeyCtrl || io.KeySuper;
    const key = this.getEntryKey(entries[index]);

    if (io.KeyShift && this.selectionAnchor >= 0) {
      const start = Math.min(this.selectionAnchor, index);
      const end = Math.max(this.selectionAnchor, index);

      if (!command) {
        this.selectedKeys.clear();
      }
      for (let i = start; i <= end; i++) {
        this.selectedKeys.add(this.getEntryKey(entries[i]));
      }
    } else if (command) {
      if (this.selectedKeys.has(key)) {
        this.selectedKeys.delete(key);
      } else {
        this.selectedKeys.add(key);
      }
      this.selectionAnchor = index;
    } else {
      this.selectedKeys.clear();
      this.selectedKeys.add(key);
      this.selectionAnchor = index;
    }

    this.syncGlobalSelection(entries.filter(entry => this.selectedKeys.has(this.getEntryKey(entry))));
  }

  private syncGlobalSelection (entries: readonly ContentBrowserEntry[]): void {
    Selection.clear();
    for (const entry of entries) {
      Selection.addObject(entry.kind === 'asset' ? entry.info : entry);
    }
  }

  private clearSelection (): void {
    this.selectedKeys.clear();
    this.selectionAnchor = -1;
    Selection.clear();
  }

  private onNavigated (selectFirst = false): void {
    this.clearSelection();
    if (selectFirst) {
      const entries = this.model.getItems('', this.typeFilters);

      if (entries.length > 0) {
        this.selectEntry(entries, 0);
      }
    }
  }

  private navigate (path: string): void {
    if (this.model.navigate(path)) {
      this.onNavigated();
    }
  }

  private openEntry (entry: ContentBrowserEntry): void {
    if (entry.kind === 'folder') {
      this.navigate(entry.path);
    } else {
      void this.openFile(entry);
    }
  }

  private async openFile (entry: ContentFileSystemEntry): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;
    this.status = `Opening ${this.getDisplayName(entry)}...`;
    try {
      const path = entry.path;
      const handle = await GalaceanEffects.editorContent.contentDatabase.getFileHandle(path);

      if (!handle) {
        throw new Error(`Cannot open '${path}'.`);
      }
      const json = JSON.parse(await (await handle.getFile()).text()) as unknown;

      if (!isJsonAssetFile(json)) {
        if (!isJSONScene(json)) {
          throw new Error(`'${path}' is not a JsonAsset or JSONScene.`);
        }

        if (GalaceanEffects.isDocumentDirty() && !window.confirm('Discard unsaved scene changes and open another scene?')) {
          this.status = 'Open canceled';

          return;
        }
        await GalaceanEffects.openDocument(json, handle.name, handle);
        this.status = `Opened ${this.getDisplayName(entry)}`;

        return;
      }

      const previewScene = generateAssetScene(json);

      if (previewScene) {
        if (GalaceanEffects.isDocumentDirty() && !window.confirm('Discard unsaved scene changes and open another scene?')) {return;}
        await GalaceanEffects.openDocument(previewScene);
      } else {
        await GalaceanEffects.editorContent.loadGraph(json.ID);
      }
      this.status = `Opened ${this.getDisplayName(entry)}`;
    } catch (error) {
      this.status = `Failed to open ${this.getDisplayName(entry)}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(this.status, error);
    } finally {
      this.busy = false;
    }
  }

  private chooseImportFiles (): void {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = '.json,.png,.jpg,.jpeg,.glb,.fbx,application/json,image/png,image/jpeg';
    input.multiple = true;
    input.onchange = () => {
      if (input.files) {
        void this.importFiles(input.files);
      }
    };
    input.click();
  }

  private async chooseFolder (): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;
    this.status = 'Opening local folder...';
    try {
      const folder = await window.showDirectoryPicker({ mode: 'readwrite' });

      await GalaceanEffects.editorContent.setProjectRoot(folder);
      this.model.currentPath = CONTENT_ROOT_PATH;
      this.clearSelection();
      this.status = `Opened ${folder.name}`;
    } catch (error) {
      if (!isAbortError(error)) {
        this.status = 'Failed to open folder';
        console.error(this.status, error);
      }
    } finally {
      this.busy = false;
    }
  }

  private async importFiles (files: FileList): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;
    try {
      const database = GalaceanEffects.editorContent.contentDatabase;
      const directory = await database.getDirectoryHandle(this.model.currentPath);

      if (!directory) {
        throw new Error(`Cannot open '${this.model.currentPath}'.`);
      }

      let imported = 0;

      for (const file of Array.from(files)) {
        imported += await this.importFile(directory, file);
      }
      await database.refresh();
      this.status = `Imported ${imported} item${imported === 1 ? '' : 's'}`;
    } catch (error) {
      this.status = 'Import failed';
      console.error(this.status, error);
    } finally {
      this.busy = false;
    }
  }

  private async importFile (directory: FileSystemDirectoryHandle, file: File): Promise<number> {
    const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();

    switch (extension) {
      case 'png':
      case 'jpg':
      case 'jpeg': {
        const textureData = {
          id: generateGUID(),
          source: await readFileAsDataUrl(file),
          dataType: spec.DataType.Texture,
          flipY: true,
          wrapS: glContext.REPEAT,
          wrapT: glContext.REPEAT,
        };
        const json = JSON.stringify(createJsonAssetFile(textureData), null, 2);

        await this.writeImportedFile(directory, `${file.name}.json`, json);

        return 1;
      }
      case 'glb':
      case 'fbx': {
        const url = URL.createObjectURL(file);

        try {
          const modelIO = new ModelIO();

          await modelIO.loadModelByURL([url], { modelType: extension === 'fbx' ? 'FBX' : 'glb' });
          await modelIO.writeGLB();

          const result = await GLTFTools.loadGLTF(new Uint8Array(modelIO.glb));
          const editorResult = GLTFTools.processGLTFForEditorECS(result.doc, result.json);

          for (const meshData of editorResult.meshes) {
            const json = JSON.stringify(createJsonAssetFile(meshData.geometryData), null, 2);

            await this.writeImportedFile(directory, `${meshData.geometryData.name}.json`, json);
          }

          return editorResult.meshes.length;
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      default:
        await this.writeImportedFile(directory, file.name, file);

        return 1;
    }
  }

  private async writeImportedFile (
    directory: FileSystemDirectoryHandle,
    name: string,
    data: FileSystemWriteChunkType,
  ): Promise<void> {
    await assertContentEntryDoesNotExist(directory, name);

    const handle = await directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();

    await writable.write(data);
    await writable.close();
  }

  private async refresh (): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.status = 'Refreshing...';
    try {
      await GalaceanEffects.editorContent.contentDatabase.refresh();
      this.status = 'Content refreshed';
    } catch (error) {
      this.status = 'Refresh failed';
      console.error(this.status, error);
    } finally {
      this.busy = false;
    }
  }

  private beginRename (entry: ContentFileSystemEntry): void {
    this.renamingItem = entry;
    const extensionIndex = entry.name.lastIndexOf('.');

    this.renameBuffer[0] = this.showExtensions || extensionIndex === -1
      ? entry.name
      : entry.name.slice(0, extensionIndex);
    this.requestRenamePopup = true;
  }

  private beginDelete (entries: ContentFileSystemEntry[]): void {
    this.deletingItems = entries;
    this.requestDeletePopup = true;
  }

  private drawDialogs (): void {
    if (this.requestNewFolderPopup) {
      ImGui.OpenPopup('New Folder');
      this.requestNewFolderPopup = false;
    }
    if (ImGui.BeginPopupModal('New Folder', null, ImGui.WindowFlags.AlwaysAutoResize)) {
      if (this.closeNewFolderPopup) {
        this.closeNewFolderPopup = false;
        ImGui.CloseCurrentPopup();
        ImGui.EndPopup();

        return;
      }
      ImGui.Text('Create a folder in the current location.');
      ImGui.SetNextItemWidth(280);
      const enter = ImGui.InputText('Name', this.newFolderBuffer, 128, ImGui.InputTextFlags.EnterReturnsTrue | ImGui.InputTextFlags.AutoSelectAll);

      ImGui.BeginDisabled(this.busy || this.newFolderBuffer[0].trim().length === 0);
      if (enter || ImGui.Button('Create')) {
        void this.createFolder();
      }
      ImGui.EndDisabled();
      ImGui.SameLine();
      if (ImGui.Button('Cancel')) {
        ImGui.CloseCurrentPopup();
      }
      ImGui.EndPopup();
    }

    if (this.requestRenamePopup) {
      ImGui.OpenPopup('Rename Content Item');
      this.requestRenamePopup = false;
    }
    if (ImGui.BeginPopupModal('Rename Content Item', null, ImGui.WindowFlags.AlwaysAutoResize)) {
      if (this.closeRenamePopup) {
        this.closeRenamePopup = false;
        ImGui.CloseCurrentPopup();
        ImGui.EndPopup();

        return;
      }
      ImGui.Text(this.renamingItem?.path ?? '');
      ImGui.SetNextItemWidth(300);
      const enter = ImGui.InputText('Name', this.renameBuffer, 256, ImGui.InputTextFlags.EnterReturnsTrue | ImGui.InputTextFlags.AutoSelectAll);

      ImGui.BeginDisabled(this.busy || this.renameBuffer[0].trim().length === 0);
      if (enter || ImGui.Button('Rename')) {
        void this.renameItem();
      }
      ImGui.EndDisabled();
      ImGui.SameLine();
      if (ImGui.Button('Cancel')) {
        this.renamingItem = undefined;
        ImGui.CloseCurrentPopup();
      }
      ImGui.EndPopup();
    }

    if (this.requestDeletePopup) {
      ImGui.OpenPopup('Delete Content Items');
      this.requestDeletePopup = false;
    }
    if (ImGui.BeginPopupModal('Delete Content Items', null, ImGui.WindowFlags.AlwaysAutoResize)) {
      if (this.closeDeletePopup) {
        this.closeDeletePopup = false;
        ImGui.CloseCurrentPopup();
        ImGui.EndPopup();

        return;
      }
      ImGui.Text(`Delete ${this.deletingItems.length} selected item${this.deletingItems.length === 1 ? '' : 's'}?`);
      ImGui.TextColored(color([0.90, 0.55, 0.20, 1]), 'This removes the files from the Content folder.');
      ImGui.BeginDisabled(this.busy);
      if (ImGui.Button('Delete')) {
        void this.deleteItems();
      }
      ImGui.EndDisabled();
      ImGui.SameLine();
      if (ImGui.Button('Cancel')) {
        this.deletingItems = [];
        ImGui.CloseCurrentPopup();
      }
      ImGui.EndPopup();
    }
  }

  private async createFolder (): Promise<void> {
    const name = this.newFolderBuffer[0].trim();

    if (!name || name.includes('/') || name.includes('\\')) {
      this.status = 'Folder name cannot contain path separators';

      return;
    }

    const path = `${this.model.currentPath}/${name}`;

    if (this.model.getFolder(path)) {
      this.status = `'${name}' already exists`;

      return;
    }

    this.busy = true;
    try {
      await GalaceanEffects.editorContent.contentDatabase.createDirectory(path);
      this.status = `Created ${name}`;
      this.closeNewFolderPopup = true;
    } catch (error) {
      this.status = `Failed to create ${name}`;
      console.error(this.status, error);
    } finally {
      this.busy = false;
    }
  }

  private async renameItem (): Promise<void> {
    const entry = this.renamingItem;

    if (!entry) {
      return;
    }

    this.busy = true;
    try {
      const renamed = await GalaceanEffects.editorContent.contentDatabase.renameFile(entry.path, this.renameBuffer[0].trim());

      this.selectedKeys.clear();
      this.selectedKeys.add(renamed.asset ? `asset:${renamed.asset.id}` : `file:${renamed.path}`);
      this.status = `Renamed to ${renamed.path.slice(renamed.path.lastIndexOf('/') + 1)}`;
      this.renamingItem = undefined;
      this.closeRenamePopup = true;
    } catch (error) {
      this.status = 'Rename failed';
      console.error(this.status, error);
    } finally {
      this.busy = false;
    }
  }

  private async deleteItems (): Promise<void> {
    this.busy = true;
    try {
      for (const entry of this.deletingItems) {
        await GalaceanEffects.editorContent.contentDatabase.deleteFile(entry.path);
      }
      const count = this.deletingItems.length;

      this.deletingItems = [];
      this.clearSelection();
      this.status = `Deleted ${count} item${count === 1 ? '' : 's'}`;
      this.closeDeletePopup = true;
    } catch (error) {
      this.status = 'Delete failed';
      console.error(this.status, error);
    } finally {
      this.busy = false;
    }
  }

  private copyText (value: string): void {
    void navigator.clipboard.writeText(value).then(() => {
      this.status = 'Copied to clipboard';
    }).catch(error => {
      this.status = 'Copy failed';
      console.error(this.status, error);
    });
  }

  private getEntryKey (entry: ContentBrowserEntry): string {
    if (entry.kind === 'folder') {
      return `folder:${entry.path}`;
    }

    return entry.kind === 'asset' ? `asset:${entry.info.id}` : `file:${entry.path}`;
  }

  private getDisplayName (entry: ContentBrowserEntry): string {
    if (entry.kind !== 'folder' && !this.showExtensions) {
      const extensionIndex = entry.name.lastIndexOf('.');

      return extensionIndex === -1 ? entry.name : entry.name.slice(0, extensionIndex);
    }

    return entry.name;
  }

  private getTypeColor (typeName: string): readonly [number, number, number, number] {
    return TYPE_COLORS[typeName] ?? [0.42, 0.55, 0.70, 1];
  }

  private truncateText (value: string, maxWidth: number): string {
    if (ImGui.CalcTextSize(value).x <= maxWidth) {
      return value;
    }

    let result = value;

    while (result.length > 1 && ImGui.CalcTextSize(`${result}...`).x > maxWidth) {
      result = result.slice(0, -1);
    }

    return `${result}...`;
  }

  private pruneSelection (): void {
    for (const key of this.selectedKeys) {
      if (key.startsWith('asset:') && !this.model.getAsset(key.slice('asset:'.length))) {
        this.selectedKeys.delete(key);
      } else if (key.startsWith('file:') && !this.model.getFile(key.slice('file:'.length))) {
        this.selectedKeys.delete(key);
      } else if (key.startsWith('folder:') && !this.model.getFolder(key.slice('folder:'.length))) {
        this.selectedKeys.delete(key);
      }
    }

    const entries: ContentBrowserEntry[] = [];

    for (const key of this.selectedKeys) {
      const entry = key.startsWith('asset:')
        ? this.model.getAsset(key.slice('asset:'.length))
        : key.startsWith('file:')
          ? this.model.getFile(key.slice('file:'.length))
          : this.model.getFolder(key.slice('folder:'.length));

      if (entry) {
        entries.push(entry);
      }
    }
    this.syncGlobalSelection(entries);
  }
}

function isAbortError (error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

function isJSONScene (value: unknown): value is spec.JSONScene {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const scene = value as Partial<spec.JSONScene>;

  return typeof scene.compositionId === 'string' &&
    Array.isArray(scene.compositions) &&
    Array.isArray(scene.items) &&
    Array.isArray(scene.components);
}

async function assertContentEntryDoesNotExist (directory: FileSystemDirectoryHandle, name: string): Promise<void> {
  try {
    await directory.getFileHandle(name);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError') {
      return;
    }
    throw error;
  }

  throw new Error(`An item named '${name}' already exists.`);
}
