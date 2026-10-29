import { Texture, generateGUID } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { contentLibrary as library } from '../../core/content-library/content-library';
import { CONTENT_ROOT } from '../../core/content-library/content-storage';
import type { ContentEntry } from '../../core/content-library/content-storage';
import { CONTENT_ASSET_PAYLOAD as ITEMS_PAYLOAD } from '../../core/content-library/asset-drag';
import type { ContentAssetDrag as ItemPayload } from '../../core/content-library/asset-drag';
import { setTextureAssetOpener, setContentBrowserActions } from '../../core/content-library/asset-editor';
import { sceneWorkspace } from '../../core/scene-document/scene-workspace';
import { projectWorkspace } from '../../core/project/project-workspace';
import { GalaceanEffects } from '../../ge';
import { ImGui } from '../../imgui';
import { splitter } from '../../widgets/splitter';
import { editorMenuSection, beginEditorPopup, beginEditorContextItem, beginEditorContextWindow, endEditorPopup, beginEditorMenu, endEditorMenu, withEditorMenuStyle, editorMenuItem } from '../../widgets/editor-menu';
import { searchBar } from '../../widgets/search-bar';
import { EditorWindow } from '../editor-window';
import { ContentImport } from './content-import';
import { CONTENT_COLORS as C, checkerboard, contentButton, contentIcon, contentText, contentWindowBackground, contentWrappedText } from './content-style';
import { ContentThumbnails } from './content-thumbnails';
import { ContentTextureEditor } from './content-texture-editor';
import { editorTileColor, editorRowColors } from '../theme/editor-interaction';

interface ItemRect { id: string, min: ImGui.Vec2, max: ImGui.Vec2 }

@editorWindow()
export class ContentBrowser extends EditorWindow {
  private readonly thumbnails = new ContentThumbnails();
  private readonly textureEditor = new ContentTextureEditor(this.thumbnails);
  private readonly importer = new ContentImport((files, folder, replacement) => {
    void library.importImages(files, folder, replacement).then(ids => {
      this.thumbnails.clear();
      if (ids?.length) { this.selected = new Set(ids); this.anchor = ids[0]; }
    });
  }, () => library.projectId);
  private projectId = '';
  private folder = CONTENT_ROOT;
  private collection?: string;
  private search: [string] = [''];
  private pathSearch: [string] = [''];
  private searchPaths = false;
  private assetType: '' | 'texture' | 'scene' = '';
  private extension = '';
  private showTrash = false;
  private selected = new Set<string>();
  private anchor?: string;
  private history = [CONTENT_ROOT];
  private historyIndex = 0;
  private expanded = new Set([CONTENT_ROOT]);
  private openFavorites = true;
  private openCollections = true;
  private openProject = true;
  private pathRows: string[] = [];
  private focusArea: 'sources' | 'assets' = 'assets';
  private browserFocused = false;
  private focusPathSearch = false;
  private pressedAsset?: { id: string, additive: boolean, range: boolean, deferred: boolean, dragged: boolean };
  private renameId?: string;
  private renameBuffer: [string] = [''];
  private focusRename = false;
  private focusSearch = false;
  private dialog: '' | 'delete' | 'collection' = '';
  private displayedDialog = '';
  private collectionName: [string] = [''];
  private pendingDelete: string[] = [];
  private moveRequest?: { ids: string[], folder: string };
  private movePopup = false;
  private clipboard?: { ids: string[], cut: boolean };
  private keys: string[] = [];
  private acceptsKeys = false;
  private dragging?: { start: ImGui.Vec2, selection: Set<string>, moved: boolean };
  private itemRects: ItemRect[] = [];
  private hoveredItem = false;
  private columns = 1;
  private preferencesTimer?: number;
  private loadingTextures = new Set<string>();
  private focusBrowser = false;
  private revealId?: string;

  @menuItem('Window/Content Browser')
  static showWindow (): void { EditorWindow.getWindow(ContentBrowser).open(); }

  constructor () {
    super(); this.title = 'Content Browser'; this.initialSize = new ImGui.Vec2(1080, 430);
    this.setWindowFlags(ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
    setTextureAssetOpener(id => this.textureEditor.open(id));
    setContentBrowserActions({
      selected: () => this.selectedEntries.map(entry => entry.id),
      reveal: id => {
        const entry = library.entry(id);

        if (!entry || entry.deletedAt) { return; }
        if (this.projectId !== library.projectId) { this.resetProject(); }
        this.open(); this.navigate(entry.parentId); this.selected = new Set([id]); this.anchor = id;
        this.focusArea = 'assets'; this.focusBrowser = true; this.revealId = id;
      },
    });
    void library.initialize().then(() => { this.folder = library.preferences.folder; this.history = [this.folder]; });
    this.open();
  }

  protected override onEnable (): void {
    this.importer.enable(); window.addEventListener('keydown', this.onKeyDown, true);
  }

  protected override onDisable (): void {
    this.finishRename();
    this.importer.disable(); window.removeEventListener('keydown', this.onKeyDown, true);
    this.acceptsKeys = false; this.keys = []; this.dragging = undefined; this.pressedAsset = undefined; this.browserFocused = false;
  }

  override draw (): void {
    if (this.focusBrowser) { ImGui.SetNextWindowFocus(); this.focusBrowser = false; }
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(4, 4));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(6, 4));
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 3);
    ImGui.PushStyleColor(ImGui.Col.WindowBg, new ImGui.Vec4(0.102, 0.102, 0.102, 1));
    ImGui.PushStyleColor(ImGui.Col.ChildBg, new ImGui.Vec4(0.102, 0.102, 0.102, 1));
    ImGui.PushStyleColor(ImGui.Col.FrameBg, new ImGui.Vec4(0.063, 0.063, 0.063, 1));
    ImGui.PushStyleColor(ImGui.Col.Border, new ImGui.Vec4(0.055, 0.055, 0.055, 1));
    super.draw();
    this.drawDialogs(); this.textureEditor.draw();
    ImGui.PopStyleColor(4); ImGui.PopStyleVar(4);
  }

  protected override onGUI (): void {
    if (this.projectId !== library.projectId) { this.resetProject(); }
    const origin = ImGui.GetCursorScreenPos(), available = ImGui.GetContentRegionAvail();

    contentWindowBackground();
    this.browserFocused = ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows);
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(8, 6));
    this.importer.areas = [{ x: origin.x, y: origin.y, width: available.x, height: available.y, folder: this.folder }];
    this.acceptsKeys = this.browserFocused && !ImGui.GetIO().WantTextInput && !ImGui.IsAnyItemActive() && !ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup);
    this.drawNavigation(available.x);
    const height = Math.max(40, ImGui.GetContentRegionAvail().y - 32);

    if (library.preferences.sources && available.x > 400) {
      const width = Math.min(library.preferences.sourcesWidth, Math.max(140, available.x * 0.45));

      this.drawSources(width, height);
      ImGui.SameLine(0, 0);
      library.preferences.sourcesWidth = splitter('##ContentSourcesSplitter', width, { thickness: 3, length: height, min: 140, max: Math.min(380, available.x * 0.5) });
      if (ImGui.IsItemDeactivated()) { this.saveSettings(); }
      ImGui.SameLine(0, 0);
    }
    ImGui.BeginChild('##ContentAssetArea', new ImGui.Vec2(0, height), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
    this.drawSearch(); this.drawAssets(); ImGui.EndChild();
    this.drawFooter();
    this.handleKeys();
    if (this.importer.hovered) {
      const area = this.importer.hovered, draw = ImGui.GetForegroundDrawList();

      draw.AddRectFilled(new ImGui.Vec2(area.x, area.y), new ImGui.Vec2(area.x + area.width, area.y + area.height), ImGui.COL32(0, 112, 224, 36));
      draw.AddRect(new ImGui.Vec2(area.x + 1, area.y + 1), new ImGui.Vec2(area.x + area.width - 1, area.y + area.height - 1), C.drop, 2, 0, 2);
    }
    if (sceneWorkspace.changingDocument) { this.importer.areas = []; }
    ImGui.PopStyleVar();
  }

  private get engine (): Engine | undefined { return GalaceanEffects.player?.engine; }
  private get selectedEntries (): ContentEntry[] { return [...this.selected].map(id => library.entry(id)).filter((entry): entry is ContentEntry => !!entry); }

  private saveSettings (): void {
    const projectId = library.projectId;

    window.clearTimeout(this.preferencesTimer);
    this.preferencesTimer = window.setTimeout(() => { if (projectId === library.projectId) { void library.savePreferences(); } }, 150);
  }

  private resetProject (): void {
    this.projectId = library.projectId; window.clearTimeout(this.preferencesTimer);
    this.folder = library.preferences.folder; this.collection = undefined; this.history = [this.folder]; this.historyIndex = 0;
    this.selected.clear(); this.anchor = undefined; this.search[0] = ''; this.pathSearch[0] = ''; this.searchPaths = false;
    this.showTrash = false; this.assetType = ''; this.extension = ''; this.renameId = undefined; this.clipboard = undefined;
    this.moveRequest = undefined; this.dialog = ''; this.pendingDelete = []; this.dragging = undefined; this.pressedAsset = undefined;
    this.expanded = new Set([CONTENT_ROOT, ...library.path(this.folder).map(entry => entry.id)]);
    this.thumbnails.clear(); this.loadingTextures.clear(); this.textureEditor.close();
  }

  private navigate (folder: string, history = true): void {
    this.finishRename();
    if (folder !== CONTENT_ROOT && (!library.entry(folder) || library.entry(folder)?.deletedAt)) { folder = CONTENT_ROOT; }
    this.folder = folder; this.collection = undefined; this.showTrash = false; this.selected.clear(); this.anchor = undefined;
    this.search[0] = ''; this.renameId = undefined; library.notice = '';
    for (const parent of library.path(folder)) { this.expanded.add(parent.id); }
    if (history && this.history[this.historyIndex] !== folder) {
      this.history.splice(this.historyIndex + 1); this.history.push(folder); this.historyIndex = this.history.length - 1;
    }
    library.preferences.folder = folder; this.saveSettings();
  }

  private drawNavigation (width: number): void {
    const origin = ImGui.GetCursorScreenPos();

    ImGui.GetWindowDrawList().AddRectFilled(origin, new ImGui.Vec2(origin.x + width, origin.y + 36), C.toolbar);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 6, origin.y + 5));
    if (width > 400) {
      if (contentButton('##Sources', library.preferences.sources ? 'sourcesOpen' : 'sources', '', { active: library.preferences.sources, hint: 'Show or hide the Sources panel' })) { library.preferences.sources = !library.preferences.sources; this.saveSettings(); }
      ImGui.SameLine(0, 5);
    }
    if (contentButton('##Add', 'add', 'Add', { green: true, dropdown: true, disabled: library.busy })) { ImGui.OpenPopup('##ContentAdd'); }
    if (beginEditorPopup('##ContentAdd')) {
      editorMenuSection('Content');
      if (editorMenuItem('New Scene', '')) { this.newScene(); }
      if (editorMenuItem('New Folder', 'Ctrl+Shift+N')) { this.newFolder(); }
      if (editorMenuItem('Import...', '')) { this.importer.choose(this.folder); }
      this.endMenu();
    }
    if (width > 450) {
      ImGui.SameLine(0, 5);
      if (contentButton('##Import', 'import', 'Import', { disabled: library.busy, hint: 'Import images into ' + library.pathText(this.folder) })) { this.importer.choose(this.folder); }
    }
    if (width > 620) {
      ImGui.SameLine(0, 5);
      if (contentButton('##SaveAll', 'save', 'Save All', { disabled: library.busy || sceneWorkspace.busy, hint: 'Save all modified assets' })) { void this.saveAll(); }
    }
    ImGui.SameLine(0, 10);
    if (contentButton('##Back', 'back', '', { disabled: this.historyIndex === 0, hint: 'Back (Alt+Left)' })) { this.navigate(this.history[--this.historyIndex], false); }
    ImGui.SameLine(0, 1);
    if (contentButton('##Forward', 'forward', '', { disabled: this.historyIndex >= this.history.length - 1, hint: 'Forward (Alt+Right)' })) { this.navigate(this.history[++this.historyIndex], false); }
    ImGui.SameLine(0, 8);
    const crumbs = [{ id: CONTENT_ROOT, name: 'Content' }, ...library.path(this.folder)];

    for (let index = 0; index < crumbs.length; index++) {
      const crumb = crumbs[index], remaining = ImGui.GetContentRegionAvail().x;

      if (remaining < 40) { break; }
      ImGui.PushID(crumb.id);
      const p = ImGui.GetCursorScreenPos(), labelWidth = Math.min(ImGui.CalcTextSize(crumb.name).x + (index ? 12 : 32), remaining - 12);

      if (ImGui.InvisibleButton('##Crumb', new ImGui.Vec2(Math.max(24, labelWidth), 26))) { this.navigate(crumb.id); }
      if (ImGui.IsItemHovered()) { ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + labelWidth, p.y + 26), C.hover, 2); }
      if (!index) { contentIcon('folder', p.x + 5, p.y + 6, 14); }
      contentText(crumb.name, p.x + (index ? 4 : 25), p.y + (26 - ImGui.GetFontSize()) / 2, C.text, labelWidth - (index ? 8 : 29));
      this.acceptDrop(crumb.id);
      ImGui.SameLine(0, 0);
      if (contentButton('##PathMenu', 'right', '', { width: 18, hint: 'Browse subfolders' })) { ImGui.OpenPopup('##CrumbChildren'); }
      if (beginEditorPopup('##CrumbChildren')) {
        const children = library.children(crumb.id).filter(entry => entry.kind === 'folder').sort((a, b) => a.name.localeCompare(b.name));

        if (!children.length) { ImGui.TextDisabled('No subfolders'); }
        for (const child of children) { if (editorMenuItem(child.name, '')) { this.navigate(child.id); } }
        this.endMenu();
      }
      ImGui.PopID();
      if (index + 1 < crumbs.length) { ImGui.SameLine(0, 0); }
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + 36)); ImGui.Dummy(new ImGui.Vec2(width, 0));
  }

  private drawSources (width: number, height: number): void {
    this.pathRows = [];
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(4, 4));
    ImGui.BeginChild('##ContentSources', new ImGui.Vec2(width, height), ImGui.ChildFlags.AlwaysUseWindowPadding);
    this.sourceHeading('Favorites', this.openFavorites, () => this.openFavorites = !this.openFavorites);
    if (this.openFavorites) {
      const favorites = library.entries.filter(entry => entry.kind === 'folder' && entry.favorite && !entry.deletedAt);

      for (const entry of favorites) {
        ImGui.PushID('favorite:' + entry.id);
        const p = ImGui.GetCursorScreenPos(), rowWidth = ImGui.GetContentRegionAvail().x;

        this.sourceRow(entry.id, entry.name, 'folder', 0, () => this.navigate(entry.id));
        this.importer.areas.push({ x: p.x, y: p.y, width: rowWidth, height: 24, folder: entry.id });
        this.contextMenu(entry, true); this.dragSource(entry);
        ImGui.PopID();
      }
      if (!favorites.length) { this.sourceHint('No favorite folders'); }
    }
    ImGui.Spacing(); ImGui.Separator(); ImGui.Spacing();
    const heading = ImGui.GetCursorScreenPos();

    this.sourceHeading('Project', this.openProject, () => this.openProject = !this.openProject, projectWorkspace.current?.name);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(heading.x + width - 34, heading.y));
    if (contentButton('##FindFolders', 'search', '', { width: 24, active: this.searchPaths, hint: 'Search folders' })) {
      this.searchPaths = !this.searchPaths; this.openProject = true; this.focusPathSearch = this.searchPaths;
      if (!this.searchPaths) { this.pathSearch[0] = ''; }
    }
    if (this.openProject) {
      if (this.searchPaths) {
        if (this.focusPathSearch) { ImGui.SetKeyboardFocusHere(); this.focusPathSearch = false; }
        searchBar('##FolderSearch', this.pathSearch, { hint: 'Search Folders' });
      }
      this.drawFolderTree(CONTENT_ROOT, 0);
    }
    ImGui.Spacing(); ImGui.Separator(); ImGui.Spacing();
    const collectionHeading = ImGui.GetCursorScreenPos();

    this.sourceHeading('Collections', this.openCollections, () => this.openCollections = !this.openCollections);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(collectionHeading.x + width - 34, collectionHeading.y));
    if (contentButton('##AddCollection', 'add', '', { width: 24, hint: 'Create a collection' })) { this.collectionName[0] = 'New Collection'; this.dialog = 'collection'; }
    if (this.openCollections) {
      for (const collection of library.preferences.collections) {
        ImGui.PushID(collection.id);
        this.sourceRow(collection.id, collection.name, 'collection', 0, () => { this.collection = collection.id; this.showTrash = false; this.selected.clear(); this.search[0] = ''; });
        if (beginEditorContextItem('##CollectionContext')) {
          if (editorMenuItem('Delete Collection', '')) {
            library.preferences.collections = library.preferences.collections.filter(entry => entry.id !== collection.id);
            if (this.collection === collection.id) { this.collection = undefined; }
            this.saveSettings();
          }
          this.endMenu();
        }
        ImGui.PopID();
      }
      if (!library.preferences.collections.length) { this.sourceHint('No collections'); }
    }
    ImGui.EndChild(); ImGui.PopStyleVar();
  }

  private sourceHeading (name: string, expanded: boolean, toggle: () => void, label = name): void {
    const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    if (ImGui.InvisibleButton('##Heading' + name, new ImGui.Vec2(Math.max(40, width - 28), 26))) { toggle(); this.focusArea = 'sources'; }
    if (ImGui.IsItemHovered()) { ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + width - 28, p.y + 26), C.hover, 2); }
    contentIcon(expanded ? 'down' : 'right', p.x + 1, p.y + 6, 14, C.muted);
    contentText(label, p.x + 21, p.y + (26 - ImGui.GetFontSize()) / 2, C.text, width - 49);
    if (ImGui.IsItemHovered(ImGui.HoveredFlags.DelayNormal) && label !== name) { ImGui.SetTooltip(label); }
  }

  private sourceHint (text: string): void {
    const p = ImGui.GetCursorScreenPos();

    contentText(text, p.x + 22, p.y + 3, C.muted, ImGui.GetContentRegionAvail().x - 24, ImGui.GetFontSize() * 0.9);
    ImGui.Dummy(new ImGui.Vec2(0, 24));
  }

  private sourceRow (id: string, name: string, icon: 'folder' | 'texture' | 'collection', depth: number, action: () => void): void {
    const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    if (ImGui.InvisibleButton('##Source' + id, new ImGui.Vec2(width, 24))) { action(); this.focusArea = 'sources'; }
    const selected = this.collection ? this.collection === id : !this.showTrash && this.folder === id;
    const draw = ImGui.GetWindowDrawList();
    const dropTarget = icon === 'folder' && this.acceptDrop(id);

    const appearance = editorRowColors({ selected, hovered: ImGui.IsItemHovered(), focused: this.browserFocused && this.focusArea === 'sources' });

    if (selected || ImGui.IsItemHovered() || dropTarget) { draw.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + 24), dropTarget ? C.selectionInactive : ImGui.GetColorU32(appearance.background)); }
    if (dropTarget) { draw.AddRect(p, new ImGui.Vec2(p.x + width, p.y + 24), C.drop, 1, 0, 2); }
    contentIcon(icon === 'folder' && this.expanded.has(id) ? 'folderOpen' : icon, p.x + 22 + depth * 14, p.y + 4, 16, selected ? C.white : icon === 'folder' ? C.folder : C.text);
    contentText(name, p.x + 43 + depth * 14, p.y + (24 - ImGui.GetFontSize()) / 2, selected ? C.white : C.text, width - 47 - depth * 14);
  }

  private drawFolderTree (id: string, depth: number): void {
    const entry = library.entry(id), name = entry?.name ?? 'Content';
    const children = library.children(id).filter(entry => entry.kind === 'folder').sort((a, b) => a.name.localeCompare(b.name));
    const filter = this.pathSearch[0].trim().toLowerCase();
    const excluded = filter.startsWith('-');
    const matches = !filter || (excluded ? !name.toLowerCase().includes(filter.slice(1)) : name.toLowerCase().includes(filter));

    if (id !== CONTENT_ROOT && !matches && !library.descendants(id).some(entry => entry.kind === 'folder' && entry.name.toLowerCase().includes(filter))) { return; }
    this.pathRows.push(id);
    ImGui.PushID(id);
    const p = ImGui.GetCursorScreenPos();

    this.sourceRow(id, name, 'folder', depth, () => {
      if (ImGui.GetMousePos().x < p.x + 19 + depth * 14 && children.length) {
        if (this.expanded.has(id)) { this.expanded.delete(id); } else { this.expanded.add(id); }
      } else { this.navigate(id); }
    });
    const width = ImGui.GetItemRectSize().x;

    if (children.length) { contentIcon(this.expanded.has(id) || filter ? 'down' : 'right', p.x + 4 + depth * 14, p.y + 5, 14, C.muted); }
    this.importer.areas.push({ x: p.x, y: p.y, width, height: 24, folder: id });
    if (entry) {
      this.contextMenu(entry, true);
      this.dragSource(entry);
    } else if (beginEditorContextItem('##RootContext')) {
      if (editorMenuItem('New Folder', '')) { this.navigate(CONTENT_ROOT); this.newFolder(); }
      if (editorMenuItem('Import...', '')) { this.importer.choose(CONTENT_ROOT); }
      this.endMenu();
    }
    if (this.expanded.has(id) || filter) { children.forEach(child => this.drawFolderTree(child.id, depth + 1)); }
    ImGui.PopID();
  }

  private drawSearch (): void {
    const origin = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 6, origin.y + 5));
    if (contentButton('##Filters', 'filter', 'Filters', { dropdown: true, active: !!this.assetType || !!this.extension })) { ImGui.OpenPopup('##ContentFilters'); }
    if (beginEditorPopup('##ContentFilters')) {
      editorMenuSection('Asset Type');
      for (const [type, label] of [['scene', 'Scene'], ['texture', 'Texture']] as const) {
        if (editorMenuItem(label, '', this.assetType === type)) { this.assetType = this.assetType === type ? '' : type; if (type === 'scene') { this.extension = ''; } }
      }
      editorMenuSection('Image Format', true);
      for (const format of ['PNG', 'JPEG', 'WEBP', 'GIF', 'AVIF', 'SVG', 'BMP']) {
        if (editorMenuItem(format, '', this.extension === format)) { this.extension = this.extension === format ? '' : format; this.assetType = 'texture'; }
      }
      editorMenuSection('Filters', true);
      if (editorMenuItem('Clear All', '')) { this.assetType = ''; this.extension = ''; }
      this.endMenu();
    }
    ImGui.SameLine(0, 6);
    const p = ImGui.GetCursorScreenPos();

    if (this.focusSearch) { ImGui.SetKeyboardFocusHere(); this.focusSearch = false; }
    searchBar('##ContentSearch', this.search, { width: Math.max(40, width - (p.x - origin.x) - 36), hint: this.collection ? 'Search Collection' : 'Search ' + (library.entry(this.folder)?.name ?? 'Content') });
    ImGui.SameLine(0, 2);
    if (contentButton('##Sort', 'sort', '', { hint: 'Sort assets' })) { ImGui.OpenPopup('##ContentSort'); }
    if (beginEditorPopup('##ContentSort')) {
      editorMenuSection('Sort By');
      for (const [value, label] of [['name', 'Name'], ['type', 'Type'], ['size', 'File Size'], ['modified', 'Date Modified']] as const) {
        if (editorMenuItem(label, '', library.preferences.sort === value)) { library.preferences.sort = value; this.saveSettings(); }
      }
      ImGui.Separator();
      if (editorMenuItem('Descending', '', library.preferences.descending)) { library.preferences.descending = !library.preferences.descending; this.saveSettings(); }
      this.endMenu();
    }
    let height = 36;

    if (this.assetType || this.extension || this.showTrash) {
      ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 9, origin.y + 38));
      const tags = [this.assetType === 'texture' ? 'Texture' : this.assetType === 'scene' ? 'Scene' : '', this.extension, this.showTrash ? 'Trash' : ''].filter(Boolean);

      tags.forEach((tag, index) => {
        if (index) { ImGui.SameLine(0, 4); }
        if (ImGui.SmallButton(tag + '  ×')) {
          if (tag === 'Texture' || tag === 'Scene') { this.assetType = ''; } else if (tag === 'Trash') { this.showTrash = false; } else { this.extension = ''; }
        }
      });
      height = 66;
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + height)); ImGui.Dummy(new ImGui.Vec2(width, 0));
  }

  private visibleEntries (): ContentEntry[] {
    const query = this.search[0].trim().toLowerCase(), collection = library.preferences.collections.find(entry => entry.id === this.collection);
    const descendants = new Set(library.descendants(this.folder).filter(entry => entry.id !== this.folder).map(entry => entry.id));
    const entries = library.entries.filter(entry => {
      if (!!entry.deletedAt !== this.showTrash) { return false; }
      if (this.showTrash) { if (library.entry(entry.parentId)?.deletedAt) { return false; } } else if (collection) {
        if (!collection.assets.includes(entry.id)) { return false; }
      } else if ((!library.preferences.showFolders || (query || this.assetType || this.extension) && library.preferences.recursive) ? !descendants.has(entry.id) : entry.parentId !== this.folder) { return false; }
      if (!library.preferences.showFolders && entry.kind === 'folder' || this.assetType && entry.kind !== this.assetType) { return false; }
      if (this.extension && (entry.mime?.split('/')[1] ?? '').replace('svg+xml', 'svg').toUpperCase() !== this.extension) { return false; }

      return !query || query.split(/\s+/).every(word => (entry.name + ' ' + entry.kind + ' ' + library.pathText(entry.parentId)).toLowerCase().includes(word));
    });
    const direction = library.preferences.descending ? -1 : 1;

    return entries.sort((a, b) => {
      if ((a.kind === 'folder') !== (b.kind === 'folder')) { return a.kind === 'folder' ? -1 : 1; }
      const sort = library.preferences.sort;
      const value = sort === 'modified' ? a.updatedAt - b.updatedAt : sort === 'size' ? (a.size ?? 0) - (b.size ?? 0) : sort === 'type' ? a.kind.localeCompare(b.kind) || (a.mime ?? '').localeCompare(b.mime ?? '') : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

      return direction * (value || a.name.localeCompare(b.name));
    });
  }

  private drawAssets (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(9, 8));
    ImGui.BeginChild('##ContentAssets', new ImGui.Vec2(0, 0), ImGui.ChildFlags.AlwaysUseWindowPadding);
    if (ImGui.IsWindowHovered() && ImGui.IsMouseClicked(ImGui.MouseButton.Left)) { this.focusArea = 'assets'; }
    const origin = ImGui.GetWindowPos(), size = ImGui.GetWindowSize();
    const entries = this.visibleEntries();

    this.itemRects = []; this.hoveredItem = false;
    this.importer.areas.push({ x: origin.x, y: origin.y, width: size.x, height: size.y, folder: this.folder });
    if (!library.ready) { ImGui.TextDisabled('Loading content...'); } else if (!entries.length) { this.drawEmpty(); } else if (library.preferences.view === 'tiles') {
      const width = ImGui.GetContentRegionAvail().x, cardWidth = library.preferences.thumbnailSize + 16;

      this.columns = Math.max(1, Math.floor((width + 10) / (cardWidth + 10)));
      entries.forEach((entry, index) => {
        if (index % this.columns) { ImGui.SameLine(0, 10); }
        this.drawTile(entry, index, entries, cardWidth);
      });
    } else if (library.preferences.view === 'columns') {
      withEditorMenuStyle(() => {
        this.columns = 1;
        if (ImGui.BeginTable('##ContentColumns', 5, ImGui.TableFlags.Resizable | ImGui.TableFlags.RowBg | ImGui.TableFlags.BordersInnerV | ImGui.TableFlags.ScrollY)) {
          ImGui.TableSetupColumn('Name', ImGui.TableColumnFlags.WidthStretch, 3);
          ImGui.TableSetupColumn('Type', ImGui.TableColumnFlags.WidthStretch, 1);
          ImGui.TableSetupColumn('Dimensions', ImGui.TableColumnFlags.WidthStretch | ImGui.TableColumnFlags.NoSort, 1.2);
          ImGui.TableSetupColumn('File Size', ImGui.TableColumnFlags.WidthStretch, 1);
          ImGui.TableSetupColumn('Date Modified', ImGui.TableColumnFlags.WidthStretch, 1.8);
          ImGui.TableNextRow(ImGui.TableRowFlags.Headers);
          const headers = [['Name', 'name'], ['Type', 'type'], ['Dimensions', ''], ['File Size', 'size'], ['Date Modified', 'modified']] as const;

          headers.forEach(([label, sort], column) => {
            ImGui.TableSetColumnIndex(column); ImGui.TableHeader(label);
            if (!sort) { return; }
            if (ImGui.IsItemClicked()) {
              library.preferences.descending = library.preferences.sort === sort && !library.preferences.descending;
              library.preferences.sort = sort; this.saveSettings();
            }
            if (library.preferences.sort === sort) {
              const p = ImGui.GetItemRectMax(), y = ImGui.GetItemRectMin().y + 10;
              const direction = library.preferences.descending ? 1 : -1;

              ImGui.GetWindowDrawList().AddTriangleFilled(new ImGui.Vec2(p.x - 15, y - direction * 2), new ImGui.Vec2(p.x - 7, y - direction * 2), new ImGui.Vec2(p.x - 11, y + direction * 2), C.muted);
            }
          });
          entries.forEach((entry, index) => {
            ImGui.TableNextRow(); ImGui.TableNextColumn(); this.drawListItem(entry, index, entries, 28, true);
            ImGui.TableNextColumn(); ImGui.Text(this.assetLabel(entry));
            ImGui.TableNextColumn(); ImGui.Text(entry.width ? entry.width + ' × ' + entry.height : '—');
            ImGui.TableNextColumn(); ImGui.Text(this.fileSize(entry.size));
            ImGui.TableNextColumn(); ImGui.Text(new Date(entry.updatedAt).toLocaleDateString());
          });
          ImGui.EndTable();
        }
      });
    } else {
      this.columns = 1; entries.forEach((entry, index) => this.drawListItem(entry, index, entries, 50));
    }
    if (beginEditorContextWindow('##ContentBackground', ImGui.PopupFlags.MouseButtonRight | ImGui.PopupFlags.NoOpenOverItems)) {
      editorMenuSection('Content');
      if (editorMenuItem('New Scene', '', false, !this.showTrash)) { this.newScene(); }
      if (editorMenuItem('New Folder', 'Ctrl+Shift+N', false, !this.showTrash)) { this.newFolder(); }
      if (editorMenuItem('Import to ' + (library.entry(this.folder)?.name ?? 'Content') + '...', '', false, !this.showTrash)) { this.importer.choose(this.folder); }
      if (editorMenuItem('Paste', 'Ctrl+V', false, !!this.clipboard && !this.showTrash)) { this.paste(); }
      this.endMenu();
    }
    this.marquee();
    if (!ImGui.IsMouseDown(ImGui.MouseButton.Left)) { this.pressedAsset = undefined; }
    ImGui.EndChild(); ImGui.PopStyleVar();
  }

  private drawEmpty (): void {
    const p = ImGui.GetCursorScreenPos(), size = ImGui.GetContentRegionAvail();
    const searching = !!this.search[0] || !!this.assetType || !!this.extension;
    const title = searching ? 'No assets match your search' : this.showTrash ? 'Trash is empty' : 'Drop files here or use the Import button';
    const textWidth = ImGui.CalcTextSize(title).x;
    const x = p.x + size.x / 2, y = p.y + Math.max(20, size.y * 0.35);

    contentIcon(searching ? 'search' : 'import', x - 16, y, 32, C.faint);
    contentText(title, Math.max(p.x, x - textWidth / 2), y + 45, C.muted, size.x);
  }

  private drawTile (entry: ContentEntry, index: number, entries: ContentEntry[], width: number): void {
    ImGui.PushID(entry.id); ImGui.BeginGroup();
    const p = ImGui.GetCursorScreenPos(), thumbnailHeight = width - 8;
    const nameLines = library.preferences.thumbnailSize < 72 ? 1 : library.preferences.thumbnailSize < 144 ? 2 : library.preferences.thumbnailSize < 192 ? 3 : 4;
    const height = thumbnailHeight + nameLines * ImGui.GetTextLineHeight() + 28;

    ImGui.InvisibleButton('##Asset', new ImGui.Vec2(width, height));
    if (this.renameId === entry.id && this.focusRename) { ImGui.SetScrollHereY(); }
    if (this.revealId === entry.id) { ImGui.SetScrollHereY(0); this.revealId = undefined; }
    if (!ImGui.IsItemVisible()) {
      ImGui.EndGroup(); ImGui.PopID();

      return;
    }
    this.assetInteraction(entry, index, entries);
    const hovered = ImGui.IsItemHovered(), selected = this.selected.has(entry.id), draw = ImGui.GetWindowDrawList();

    this.hoveredItem ||= hovered;
    this.itemRects.push({ id: entry.id, min: p, max: new ImGui.Vec2(p.x + width, p.y + height) });
    const dropTarget = entry.kind === 'folder' && this.acceptDrop(entry.id);
    const background = dropTarget ? C.selectionInactive : selected ? this.selectionColor(hovered, 'assets') : hovered ? C.hover : C.secondary;

    if (entry.kind !== 'folder' || selected || hovered) { draw.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + height), background, 4); }
    if (entry.kind === 'folder') { contentIcon('folder', p.x + width * 0.18, p.y + thumbnailHeight * 0.15, width * 0.64, C.folder); } else {
      draw.AddRectFilled(new ImGui.Vec2(p.x + 2, p.y + 2), new ImGui.Vec2(p.x + width - 2, p.y + thumbnailHeight), C.recessed, 3);
      this.drawImage(entry, p.x + 3, p.y + 3, width - 6, thumbnailHeight - 4);
      draw.AddRectFilled(new ImGui.Vec2(p.x + 2, p.y + thumbnailHeight - 3), new ImGui.Vec2(p.x + width - 2, p.y + thumbnailHeight), entry.kind === 'scene' ? C.scene : C.texture);
      this.prepareTexture(entry);
    }
    if (selected || hovered || dropTarget) { draw.AddRect(p, new ImGui.Vec2(p.x + width, p.y + height), dropTarget ? C.drop : selected ? background : C.hover, 4, 0, 2); }
    contentWrappedText(this.displayName(entry), p.x + 7, p.y + thumbnailHeight + 7, width - 14, nameLines, selected || hovered ? C.white : C.text, entry.kind === 'folder');
    if (entry.kind !== 'folder') { contentText(this.assetLabel(entry), p.x + 7, p.y + height - 19, selected ? ImGui.COL32(225, 235, 248, 255) : C.muted, width - 14, ImGui.GetFontSize() * 0.85); }
    this.assetTooltip(entry); this.dragSource(entry);
    if (entry.kind === 'folder') {
      this.importer.areas.push({ x: p.x, y: p.y, width, height, folder: entry.id });
    }
    this.contextMenu(entry);
    if (this.renameId === entry.id) { this.drawRename(entry, p.x + 4, p.y + thumbnailHeight + 3, width - 8); }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + height)); ImGui.Dummy(new ImGui.Vec2(width, 0));
    ImGui.EndGroup(); ImGui.PopID();
  }

  private drawListItem (entry: ContentEntry, index: number, entries: ContentEntry[], height: number, spanColumns = false): void {
    ImGui.PushID(entry.id);
    const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    if (spanColumns) {
      for (const color of [ImGui.Col.Header, ImGui.Col.HeaderHovered, ImGui.Col.HeaderActive]) { ImGui.PushStyleColor(color, new ImGui.Vec4(0, 0, 0, 0)); }
      ImGui.Selectable('##AssetRow', this.selected.has(entry.id), ImGui.SelectableFlags.SpanAllColumns, new ImGui.Vec2(0, height));
      ImGui.PopStyleColor(3);
    } else { ImGui.InvisibleButton('##AssetRow', new ImGui.Vec2(Math.max(30, width), height)); }
    if (this.renameId === entry.id && this.focusRename) { ImGui.SetScrollHereY(); }
    if (this.revealId === entry.id) { ImGui.SetScrollHereY(0); this.revealId = undefined; }
    if (!ImGui.IsItemVisible()) {
      ImGui.PopID();

      return;
    }
    this.assetInteraction(entry, index, entries);
    const hovered = ImGui.IsItemHovered(), selected = this.selected.has(entry.id);
    const dropTarget = entry.kind === 'folder' && this.acceptDrop(entry.id);
    const background = dropTarget ? C.selectionInactive : selected ? this.selectionColor(hovered, 'assets') : C.hover;

    this.hoveredItem ||= hovered; this.itemRects.push({ id: entry.id, min: p, max: new ImGui.Vec2(p.x + width, p.y + height) });
    if (spanColumns && (selected || hovered || dropTarget)) { ImGui.TableSetBgColor(ImGui.TableBgTarget.RowBg1, background); }
    if (!spanColumns && (selected || hovered || dropTarget)) { ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + height), background, 2); }
    const iconSize = height - 8;

    if (entry.kind === 'folder') { contentIcon('folder', p.x + 4, p.y + 4, iconSize, C.folder); } else { this.drawImage(entry, p.x + 4, p.y + 4, iconSize, iconSize); this.prepareTexture(entry); }
    contentText(this.displayName(entry), p.x + height + 3, p.y + (height === 28 || entry.kind === 'folder' ? (height - ImGui.GetFontSize()) / 2 : 6), selected || hovered ? C.white : C.text, width - height - 8);
    if (height > 28 && entry.kind !== 'folder') { contentText(this.assetLabel(entry), p.x + height + 3, p.y + 28, selected ? C.white : C.muted, width - height - 8, ImGui.GetFontSize() * 0.85); }
    this.assetTooltip(entry); this.dragSource(entry);
    if (entry.kind === 'folder') {
      this.importer.areas.push({ x: p.x, y: p.y, width, height, folder: entry.id });
    }
    this.contextMenu(entry);
    if (this.renameId === entry.id) { this.drawRename(entry, p.x + height + 2, p.y + 2, width - height - 5); }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + height)); ImGui.Dummy(new ImGui.Vec2(width, 0));
    ImGui.PopID();
  }

  private drawImage (entry: ContentEntry, x: number, y: number, width: number, height: number): void {
    if (entry.kind === 'scene') {
      const size = Math.min(width, height);

      contentIcon('scene', x + (width - size) / 2, y + (height - size) / 2, size, C.text);

      return;
    }
    const image = this.thumbnails.get(entry.id);

    if (image) {
      const scale = Math.min(width / image.width, height / image.height), w = image.width * scale, h = image.height * scale;
      const left = x + (width - w) / 2, top = y + (height - h) / 2;

      checkerboard(left, top, w, h, 8);
      ImGui.GetWindowDrawList().AddImage(image.texture, new ImGui.Vec2(left, top), new ImGui.Vec2(left + w, top + h));
    } else { contentIcon('texture', x + width * 0.3, y + height * 0.3, Math.min(width, height) * 0.4, C.faint); }
  }

  private prepareTexture (entry: ContentEntry): void {
    const engine = this.engine;

    if (entry.kind !== 'texture' || !engine || sceneWorkspace.busy || this.showTrash || library.texture(engine, entry.id)?.isRegistered || this.loadingTextures.has(entry.id)) { return; }
    this.loadingTextures.add(entry.id);
    const projectId = library.projectId;

    void library.loadTexture(engine, entry.id).catch(error => { if (projectId === library.projectId) { library.report(error); } }).finally(() => this.loadingTextures.delete(entry.id));
  }

  private select (entry: ContentEntry, index: number, entries: ContentEntry[], modifiers?: { additive: boolean, range: boolean }): void {
    const io = ImGui.GetIO();
    const additive = modifiers?.additive ?? (io.KeyCtrl || io.KeySuper), range = modifiers?.range ?? io.KeyShift;

    if (range && this.anchor) {
      const anchor = Math.max(0, entries.findIndex(entry => entry.id === this.anchor));

      if (!additive) { this.selected.clear(); }
      entries.slice(Math.min(anchor, index), Math.max(anchor, index) + 1).forEach(entry => this.selected.add(entry.id));
    } else if (additive) {
      if (this.selected.has(entry.id)) { this.selected.delete(entry.id); } else { this.selected.add(entry.id); }
      this.anchor = entry.id;
    } else { this.selected = new Set([entry.id]); this.anchor = entry.id; }
  }

  private assetInteraction (entry: ContentEntry, index: number, entries: ContentEntry[]): void {
    if (this.renameId === entry.id) { return; }
    const hovered = ImGui.IsItemHovered(), io = ImGui.GetIO();

    if (ImGui.IsItemClicked(ImGui.MouseButton.Left)) {
      this.focusArea = 'assets';
      this.pressedAsset = { id: entry.id, additive: io.KeyCtrl || io.KeySuper, range: io.KeyShift, deferred: this.selected.has(entry.id) && !io.KeyShift, dragged: false };
      if (!this.pressedAsset.deferred) { this.select(entry, index, entries, this.pressedAsset); }
    }
    const pressed = this.pressedAsset;

    if (pressed?.id === entry.id && ImGui.IsMouseReleased(ImGui.MouseButton.Left)) {
      if (pressed.deferred && !pressed.dragged && hovered) { this.select(entry, index, entries, pressed); }
      this.pressedAsset = undefined;
    }
    if (ImGui.IsItemClicked(ImGui.MouseButton.Right)) {
      this.focusArea = 'assets';
      if (!this.selected.has(entry.id)) { this.selected = new Set([entry.id]); this.anchor = entry.id; }
    }
    if (hovered && ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left)) { this.openAsset(entry); }
  }

  private selectionColor (hovered: boolean, area: 'sources' | 'assets'): number {
    return ImGui.GetColorU32(editorTileColor(true, hovered, this.browserFocused && this.focusArea === area));
  }

  private endMenu (): void {
    if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { ImGui.CloseCurrentPopup(); }
    endEditorPopup();
  }

  private assetLabel (entry: ContentEntry): string { return entry.kind === 'folder' ? 'Folder' : entry.kind === 'scene' ? 'Scene' : 'Texture'; }
  private displayName (entry: ContentEntry): string { return entry.name + (entry.kind === 'scene' && sceneWorkspace.current?.storageId === entry.id && sceneWorkspace.current.dirty ? '*' : ''); }

  private openAsset (entry: ContentEntry): void {
    if (entry.deletedAt) { return; }
    if (entry.kind === 'folder') { this.navigate(entry.id); } else if (entry.kind === 'scene') {
      if (!sceneWorkspace.busy) { void sceneWorkspace.openSaved(entry); }
    } else { this.textureEditor.open(entry.id); }
  }

  private assetTooltip (entry: ContentEntry): void {
    if (!ImGui.IsItemHovered(ImGui.HoveredFlags.DelayNormal) || ImGui.IsMouseDown(ImGui.MouseButton.Left)) { return; }
    ImGui.BeginTooltip(); ImGui.Text(entry.name); ImGui.Separator();
    ImGui.TextDisabled(this.assetLabel(entry));
    ImGui.Text(library.pathText(entry.parentId));
    if (entry.width) { ImGui.Text('Dimensions: ' + entry.width + ' × ' + entry.height); ImGui.Text('Source: ' + entry.sourceName); }
    ImGui.EndTooltip();
  }

  private dragSource (entry: ContentEntry): void {
    if (entry.deletedAt || library.busy || sceneWorkspace.busy || !ImGui.BeginDragDropSource()) { return; }
    if (this.pressedAsset?.id === entry.id) { this.pressedAsset.dragged = true; }
    const ids = this.selected.has(entry.id) ? [...this.selected] : [entry.id];
    const texture = this.engine && entry.kind === 'texture' && ids.length === 1 ? library.texture(this.engine, entry.id) : undefined;

    if (texture?.isRegistered) { ImGui.SetDragDropPayload('Texture', texture); } else { ImGui.SetDragDropPayload(ITEMS_PAYLOAD, { ids }); }
    const p = ImGui.GetCursorScreenPos(), size = 48;

    if (entry.kind === 'folder') { contentIcon('folderOpen', p.x, p.y, size, C.folder); } else { this.drawImage(entry, p.x, p.y, size, size); }
    ImGui.Dummy(new ImGui.Vec2(size, size)); ImGui.SameLine(0, 10); ImGui.BeginGroup();
    ImGui.Text(entry.name);
    ImGui.TextDisabled(ids.length > 1 ? ids.length + ' items' : this.assetLabel(entry));
    ImGui.EndGroup();
    ImGui.EndDragDropSource();
  }

  private acceptDrop (folder: string): boolean {
    if (this.showTrash || !ImGui.BeginDragDropTarget()) { return false; }
    const flags = ImGui.DragDropFlags.AcceptBeforeDelivery | ImGui.DragDropFlags.AcceptNoDrawDefaultRect;
    const previewItems = ImGui.AcceptDragDropPayload<ItemPayload>(ITEMS_PAYLOAD, flags);
    const previewTexture = ImGui.AcceptDragDropPayload<Texture>('Texture', flags);
    const previewIds = previewItems?.Data?.ids ?? (previewTexture?.Data instanceof Texture ? [previewTexture.Data.getInstanceId()] : []);
    const payload = ImGui.AcceptDragDropPayload(ITEMS_PAYLOAD, ImGui.DragDropFlags.AcceptNoDrawDefaultRect);
    const texture = ImGui.AcceptDragDropPayload('Texture', ImGui.DragDropFlags.AcceptNoDrawDefaultRect);
    const ids = payload?.Data ? (payload.Data as ItemPayload).ids : texture?.Data instanceof Texture ? [texture.Data.getInstanceId()] : [];

    const valid = (ids: string[]) => !!ids.length && ids.every(id => library.entry(id) && id !== folder && !library.path(folder).some(parent => parent.id === id));

    if (valid(ids)) { this.moveRequest = { ids, folder }; this.movePopup = false; }
    ImGui.EndDragDropTarget();

    return valid(previewIds);
  }

  private contextMenu (entry: ContentEntry, source = false): void {
    if (!beginEditorContextItem('##AssetContext')) { return; }
    if (source) { this.selected = new Set([entry.id]); }
    editorMenuSection(entry.kind === 'folder' ? 'Folder' : 'Asset');
    if (entry.deletedAt) {
      if (editorMenuItem('Restore', '')) { void library.trash([...this.selected], true); }
    } else {
      if (editorMenuItem(entry.kind === 'folder' ? 'Open Folder' : 'Edit', 'Enter')) { this.openAsset(entry); }
      if (editorMenuItem('Rename', 'F2', false, this.selected.size <= 1)) {
        if (source) { this.navigate(entry.parentId); this.selected = new Set([entry.id]); }
        this.startRename(entry);
      }
      if (editorMenuItem('Duplicate', 'Ctrl+D')) { void library.transfer([...this.selected], source ? entry.parentId : this.folder, true); }
      if (editorMenuItem('Delete', 'Delete')) { this.pendingDelete = [...this.selected]; this.dialog = 'delete'; }
      if (entry.kind === 'scene') {
        if (editorMenuItem('Set as Startup Scene', '', projectWorkspace.current?.startupSceneId === entry.id)) {
          const project = projectWorkspace.current;

          if (project) { void projectWorkspace.settings({ name: project.name, description: project.description, startupSceneId: entry.id }); }
        }
      }
      if (entry.kind === 'folder' || library.preferences.collections.length || this.collection) { editorMenuSection('Organization', true); }
      if (entry.kind === 'folder' && editorMenuItem('New Folder', '')) { this.navigate(entry.id); this.newFolder(); }
      if (entry.kind === 'folder' && editorMenuItem(entry.favorite ? 'Remove From Favorites' : 'Add To Favorites', '')) { void library.favorite(entry.id); }
      if (entry.kind !== 'folder' && library.preferences.collections.length && beginEditorMenu('Add To Collection')) {
        for (const collection of library.preferences.collections) {
          if (editorMenuItem(collection.name, '')) { collection.assets = [...new Set([...collection.assets, ...this.selectedEntries.filter(entry => entry.kind !== 'folder').map(entry => entry.id)])]; this.saveSettings(); }
        }
        endEditorMenu();
      }
      if (entry.kind !== 'folder' && this.collection && editorMenuItem('Remove From Collection', '')) {
        const collection = library.preferences.collections.find(entry => entry.id === this.collection);

        if (collection) { collection.assets = collection.assets.filter(id => !this.selected.has(id)); this.saveSettings(); }
      }
      editorMenuSection('Asset Actions', true);
      if (entry.kind === 'texture' && editorMenuItem('Reimport...', '')) { this.importer.choose(entry.parentId, entry.id); }
      if (editorMenuItem('Copy', 'Ctrl+C')) { this.clipboard = { ids: [...this.selected], cut: false }; }
      if (editorMenuItem('Cut', 'Ctrl+X')) { this.clipboard = { ids: [...this.selected], cut: true }; }
      if (editorMenuItem('Copy Reference', '')) { ImGui.SetClipboardText(library.pathText(entry.parentId) + '/' + entry.name); }
    }
    this.endMenu();
  }

  private startRename (entry: ContentEntry): void { this.renameId = entry.id; this.renameBuffer[0] = entry.name; this.focusRename = true; this.focusArea = 'assets'; }

  private drawRename (entry: ContentEntry, x: number, y: number, width: number): void {
    ImGui.SetCursorScreenPos(new ImGui.Vec2(x, y)); ImGui.SetNextItemWidth(Math.max(30, width));
    const appearing = this.focusRename;

    if (this.focusRename) { ImGui.SetKeyboardFocusHere(); this.focusRename = false; }
    const enter = ImGui.InputText('##Rename', this.renameBuffer, undefined, ImGui.InputTextFlags.EnterReturnsTrue | ImGui.InputTextFlags.AutoSelectAll);
    const cancel = ImGui.IsKeyPressed(ImGui.Key.Escape, false);

    if (enter || ImGui.IsItemDeactivated() || cancel || !appearing && !ImGui.IsItemActive() && (!this.browserFocused || ImGui.IsMouseClicked(ImGui.MouseButton.Left))) { this.finishRename(cancel); }
  }

  private finishRename (cancel = false): void {
    const entry = this.renameId ? library.entry(this.renameId) : undefined;

    if (entry && !cancel && this.renameBuffer[0].trim() && this.renameBuffer[0] !== entry.name) { void library.rename(entry.id, this.renameBuffer[0]); }
    this.renameId = undefined; this.focusRename = false;
  }

  private newFolder (): void {
    this.collection = undefined; this.showTrash = false; this.search[0] = '';
    this.assetType = ''; this.extension = ''; library.preferences.showFolders = true;
    void library.newFolder(this.folder).then(id => {
      const entry = id ? library.entry(id) : undefined;

      if (entry) { this.selected = new Set([entry.id]); this.anchor = entry.id; this.startRename(entry); this.expanded.add(this.folder); }
    });
  }

  private newScene (): void {
    this.collection = undefined; this.showTrash = false; this.search[0] = ''; this.assetType = ''; this.extension = '';
    void library.newScene(this.folder).then(id => {
      const entry = id ? library.entry(id) : undefined;

      if (entry) { this.selected = new Set([entry.id]); this.anchor = entry.id; this.focusArea = 'assets'; this.startRename(entry); }
    });
  }

  private async saveAll (): Promise<void> {
    await sceneWorkspace.saveAll();
  }

  private marquee (): void {
    const io = ImGui.GetIO(), mouse = ImGui.GetMousePos();

    if (ImGui.IsWindowHovered() && !this.hoveredItem && ImGui.IsMouseClicked(ImGui.MouseButton.Left) && !ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup)) {
      const selection = io.KeyCtrl || io.KeySuper ? new Set(this.selected) : new Set<string>();

      this.selected = new Set(selection); this.dragging = { start: new ImGui.Vec2(mouse.x, mouse.y), selection, moved: false };
    }
    if (!this.dragging) { return; }
    if (!ImGui.IsMouseDown(ImGui.MouseButton.Left)) {
      this.dragging = undefined;

      return;
    }
    const start = this.dragging.start;
    const min = new ImGui.Vec2(Math.min(start.x, mouse.x), Math.min(start.y, mouse.y));
    const max = new ImGui.Vec2(Math.max(start.x, mouse.x), Math.max(start.y, mouse.y));

    if (max.x - min.x + max.y - min.y < 5) { return; }
    this.dragging.moved = true; this.selected = new Set(this.dragging.selection);
    this.itemRects.filter(rect => rect.min.x < max.x && rect.max.x > min.x && rect.min.y < max.y && rect.max.y > min.y).forEach(rect => this.selected.add(rect.id));
    const draw = ImGui.GetWindowDrawList();

    draw.AddRectFilled(min, max, ImGui.COL32(0, 112, 224, 42)); draw.AddRect(min, max, C.selection);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.acceptsKeys || event.isComposing || event.target instanceof HTMLInputElement) { return; }
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const handled = command && ['a', 'c', 'x', 'v', 'd', 'f'].includes(key) || command && event.shiftKey && key === 'n' ||
      ['F2', 'Delete', 'Backspace', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);

    if (!handled) { return; }
    event.preventDefault();
    if (!event.repeat || event.key.startsWith('Arrow')) { this.keys.push(command ? event.shiftKey && key === 'n' ? 'newFolder' : key : event.altKey ? 'alt+' + key : event.key); }
  };

  private handleKeys (): void {
    const entries = this.visibleEntries();

    for (const key of this.keys.splice(0)) {
      const source = this.focusArea === 'sources';
      const first = source ? library.entry(this.folder) : this.selectedEntries[0];
      const ids = source ? first ? [first.id] : [] : [...this.selected];

      if (source && key.startsWith('Arrow')) { this.navigateSource(key); continue; }
      if (key === 'a' && !source) { this.selected = new Set(entries.map(entry => entry.id)); } else if (key === 'f') { this.focusSearch = true; this.focusArea = 'assets'; } else if (key === 'newFolder') { this.newFolder(); } else if (key === 'c' || key === 'x') {
        this.clipboard = { ids, cut: key === 'x' };
      } else if (key === 'v') { this.paste(); } else if (key === 'd' && first) { void library.transfer(ids, source ? first.parentId : this.folder, true); } else if (key === 'F2' && first) {
        if (source) { this.navigate(first.parentId); this.selected = new Set([first.id]); this.focusArea = 'assets'; }
        this.startRename(first);
      } else if ((key === 'Delete' || key === 'Backspace') && first) {
        this.pendingDelete = ids; this.dialog = 'delete';
      } else if (key === 'Enter' && first) { this.openAsset(first); } else if (key === 'alt+arrowleft' && this.historyIndex > 0) { this.navigate(this.history[--this.historyIndex], false); } else if (key === 'alt+arrowright' && this.historyIndex < this.history.length - 1) { this.navigate(this.history[++this.historyIndex], false); } else if (key.startsWith('Arrow') && entries.length) {
        const current = Math.max(0, entries.findIndex(entry => entry.id === this.anchor));
        const delta = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -this.columns : this.columns;
        const index = Math.max(0, Math.min(entries.length - 1, current + delta));

        this.select(entries[index], index, entries);
      }
    }
  }

  private navigateSource (key: string): void {
    if (!this.pathRows.length) { return; }
    const index = Math.max(0, this.pathRows.indexOf(this.folder));
    const children = library.children(this.folder).filter(entry => entry.kind === 'folder');

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      this.navigate(this.pathRows[Math.max(0, Math.min(this.pathRows.length - 1, index + (key === 'ArrowUp' ? -1 : 1)))]);
    } else if (key === 'ArrowRight' && children.length) {
      if (this.expanded.has(this.folder) && this.pathRows[index + 1]) { this.navigate(this.pathRows[index + 1]); } else { this.expanded.add(this.folder); }
    } else if (key === 'ArrowLeft') {
      if (children.length && this.expanded.has(this.folder)) { this.expanded.delete(this.folder); } else if (this.folder !== CONTENT_ROOT) { this.navigate(library.entry(this.folder)?.parentId ?? CONTENT_ROOT); }
    }
  }

  private paste (): void {
    if (!this.clipboard) { return; }
    void library.transfer(this.clipboard.ids, this.folder, !this.clipboard.cut);
    if (this.clipboard.cut) { this.clipboard = undefined; }
  }

  private drawFooter (): void {
    const origin = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    ImGui.GetWindowDrawList().AddRectFilled(origin, new ImGui.Vec2(origin.x + width, origin.y + 28), C.toolbar);
    const entries = this.visibleEntries(), count = entries.length, selected = entries.filter(entry => this.selected.has(entry.id)).length;
    const status = library.busy ? library.progress || 'Saving content...' : library.notice;
    const text = count + (count === 1 ? ' item' : ' items') + (selected ? ' (' + selected + ' selected)' : '') + (status ? ' · ' + status : '');

    contentText(text, origin.x + 10, origin.y + (28 - ImGui.GetFontSize()) / 2, C.text, width - 140);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + Math.max(5, width - 120), origin.y + 1));
    if (contentButton('##Settings', 'settings', 'Settings', { dropdown: true, width: 115 })) { ImGui.OpenPopup('##ContentSettings'); }
    if (ImGui.IsPopupOpen('##ContentSettings')) { ImGui.SetNextWindowPos(new ImGui.Vec2(origin.x + width - 6, origin.y - 2), ImGui.Cond.Always, new ImGui.Vec2(1, 1)); }
    if (beginEditorPopup('##ContentSettings')) {
      editorMenuSection('View Type');
      for (const [value, label] of [['tiles', 'Tiles'], ['list', 'List'], ['columns', 'Columns']] as const) {
        if (editorMenuItem(label, '', library.preferences.view === value)) { library.preferences.view = value; this.saveSettings(); }
      }
      editorMenuSection('View', true);
      for (const [key, label] of [['sources', 'Show Sources Panel'], ['showFolders', 'Show Folders'], ['recursive', 'Filter Recursively']] as const) {
        if (editorMenuItem(label, '', library.preferences[key])) { library.preferences[key] = !library.preferences[key]; this.saveSettings(); }
      }
      if (editorMenuItem('Show Deleted Assets', '', this.showTrash)) { this.showTrash = !this.showTrash; this.collection = undefined; this.selected.clear(); }
      editorMenuSection('Thumbnails', true);
      for (const [size, label] of [[48, 'Tiny'], [72, 'Small'], [96, 'Medium'], [144, 'Large'], [192, 'Huge']] as const) {
        if (editorMenuItem(label, '', library.preferences.thumbnailSize === size)) { library.preferences.thumbnailSize = size; this.saveSettings(); }
      }
      this.endMenu();
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + 28)); ImGui.Dummy(new ImGui.Vec2(width, 0));
  }

  private drawDialogs (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(12, 10));
    const kind = library.error ? 'error' : this.dialog;
    const title = kind === 'error' ? 'Content Browser Error' : kind === 'delete' ? 'Delete Assets' : 'New Collection';

    if (kind && this.displayedDialog !== kind) { ImGui.OpenPopup(title); this.displayedDialog = kind; }
    if (!kind) { this.displayedDialog = ''; }
    if (kind) {
      ImGui.SetNextWindowSize(new ImGui.Vec2(440, 0), ImGui.Cond.Always);
      if (ImGui.BeginPopupModal(title, null, ImGui.WindowFlags.AlwaysAutoResize | ImGui.WindowFlags.NoResize | ImGui.WindowFlags.NoSavedSettings)) {
        if (kind === 'error') {
          ImGui.TextWrapped(library.error);
          if (ImGui.Button('OK', new ImGui.Vec2(90, 0))) { library.error = ''; ImGui.CloseCurrentPopup(); this.displayedDialog = ''; }
        } else if (kind === 'delete') {
          ImGui.TextWrapped('Move ' + this.pendingDelete.length + (this.pendingDelete.length === 1 ? ' item' : ' items') + ' to Trash?');
          for (const id of this.pendingDelete.slice(0, 8)) { ImGui.TextDisabled(library.entry(id)?.name ?? ''); }
          ImGui.Spacing();
          if (ImGui.Button('Delete', new ImGui.Vec2(90, 0))) {
            void library.trash(this.pendingDelete).then(() => { this.selected.clear(); if (library.entry(this.folder)?.deletedAt) { this.navigate(CONTENT_ROOT); } });
            this.dialog = ''; ImGui.CloseCurrentPopup(); this.displayedDialog = '';
          }
          ImGui.SameLine();
          if (ImGui.Button('Cancel', new ImGui.Vec2(90, 0))) { this.dialog = ''; ImGui.CloseCurrentPopup(); this.displayedDialog = ''; }
        } else {
          ImGui.Text('Collection Name'); ImGui.SetNextItemWidth(-1);
          if (ImGui.IsWindowAppearing()) { ImGui.SetKeyboardFocusHere(); }
          const enter = ImGui.InputText('##CollectionName', this.collectionName, undefined, ImGui.InputTextFlags.EnterReturnsTrue);

          if ((ImGui.Button('Create', new ImGui.Vec2(90, 0)) || enter) && this.collectionName[0].trim()) {
            library.preferences.collections.push({ id: generateGUID(), name: this.collectionName[0].trim(), assets: this.selectedEntries.filter(entry => entry.kind !== 'folder').map(entry => entry.id) });
            this.saveSettings(); this.dialog = ''; ImGui.CloseCurrentPopup(); this.displayedDialog = '';
          }
          ImGui.SameLine();
          if (ImGui.Button('Cancel', new ImGui.Vec2(90, 0))) { this.dialog = ''; ImGui.CloseCurrentPopup(); this.displayedDialog = ''; }
        }
        if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { library.error = ''; this.dialog = ''; ImGui.CloseCurrentPopup(); this.displayedDialog = ''; }
        ImGui.EndPopup();
      }
    }
    if (this.moveRequest) {
      if (!this.movePopup) { ImGui.OpenPopup('##ContentMove'); this.movePopup = true; }
      if (beginEditorPopup('##ContentMove')) {
        const request = this.moveRequest;

        editorMenuSection('Drop Actions');
        if (editorMenuItem('Move Here', '')) { void library.transfer(request.ids, request.folder); this.moveRequest = undefined; }
        if (editorMenuItem('Copy Here', '')) { void library.transfer(request.ids, request.folder, true); this.moveRequest = undefined; }
        ImGui.Separator();
        if (editorMenuItem('Cancel', '')) { this.moveRequest = undefined; }
        this.endMenu();
      } else if (this.movePopup && !ImGui.IsPopupOpen('##ContentMove')) { this.moveRequest = undefined; }
    }
    ImGui.PopStyleVar();
  }

  private fileSize (size?: number): string { return size === undefined ? '—' : size < 1024 ? size + ' B' : size < 1024 * 1024 ? (size / 1024).toFixed(1) + ' KB' : (size / (1024 * 1024)).toFixed(1) + ' MB'; }
}
