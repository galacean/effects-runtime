import { EditorSearchField } from '../../ui/controls/search-field';
import { AssetColumns } from '../../ui/asset-view/asset-columns';
import { EffectsObject, generateGUID } from '@galacean/effects';
import type { Engine, InputEventKey, math } from '@galacean/effects';
import type { Control, Label, LineEdit } from '@galacean/effects-plugin-gui';
import { PanelContainer, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem } from '../../framework/registry/editor-registry';
import { EditorWindow } from '../../framework/windows/editor-window';
import { EditorRuntimeSession } from '../../platform/effects-runtime/editor-runtime-session';
import { AssetView } from '../../ui/asset-view/asset-view';
import { append, column, expand, label, margin, row, screenPosition } from '../../ui/controls/layout';
import { EditorMenu, EditorMenuButton, type MenuAction } from '../../ui/controls/menu';
import { EditorPositiveActionButton } from '../../ui/controls/positive-action-button';
import { EditorToolbar } from '../../ui/controls/toolbar';
import { EditorTextField } from '../../ui/controls/text-field';
import { EditorDialog } from '../../ui/controls/dialog';
import { EditorSplitContainer } from '../../ui/controls/split-container';
import { EditorIconButton } from '../../ui/icons/control-icons';
import { ListSelection } from '../../ui/list-view/list-selection';
import { editorColors, editorBox } from '../../ui/theme/control-theme';
import { assetLibrary as library } from '../assets/asset-library';
import { setContentBrowserActions, openContentAsset, openTextureAsset, isContentAssetDirty } from '../assets/editors/asset-editor-registry';
import type { AssetEntry, AssetKind } from '../assets/model/asset-types';
import { ASSET_PRESENTATION } from '../assets/ui/asset-presentation';
import { ASSET_ROOT } from '../assets/model/asset-types';
import { AssetThumbnailCache } from '../assets/preview/asset-thumbnail-cache';
import { CONTENT_ASSET_PAYLOAD } from '../assets/ui/asset-drag';
import { projectWorkspace } from '../projects/project-workspace';
import { sceneWorkspace } from '../scene/scene-workspace';
import { ContentAssetSource } from './content-asset-source';
import { ContentImportController } from './content-import';
import { ContentSourcesView, navigateContentSources, type ContentSourceGroup, type SourceItem } from './content-sources-view';
import { EditorBreadcrumbBar } from '../../ui/controls/breadcrumb-bar';

@editorPanel()
export class ContentBrowserPanel extends EditorWindow {
  private readonly thumbnails = new AssetThumbnailCache();
  private readonly assetSource = new ContentAssetSource(this.thumbnails, id => library.asset(EditorRuntimeSession.player.engine, id));
  private readonly selection = new ListSelection<string>();
  private readonly importer = new ContentImportController((files, folder, replacement) => {
    void library.importImages(files, folder, replacement).then(ids => { this.thumbnails.clear(); if (ids?.length) { this.selected = new Set(ids); this.selection.anchor = ids[0]; } this.refresh(); });
  }, () => library.projectId);
  private projectId = '';
  private revision = -1;
  private folder = ASSET_ROOT;
  private collection?: string;
  private search = '';
  private sourceQueries: Record<ContentSourceGroup, string> = { favorites: '', project: '', collections: '' };
  private assetType: '' | Exclude<AssetKind, 'folder'> = '';
  private extension = '';
  private showTrash = false;
  private history = [ASSET_ROOT];
  private historyIndex = 0;
  private historyBack!: EditorIconButton;
  private historyForward!: EditorIconButton;
  private expanded = new Set([ASSET_ROOT, 'favorites', 'collections', 'project']);
  private clipboard?: { ids: string[], cut: boolean };
  private preferencesTimer?: number;
  private loadingAssets = new Set<string>();
  private sourceList!: ContentSourcesView;
  private assetView!: AssetView;
  private searchEdit!: LineEdit;
  private breadcrumbs!: EditorBreadcrumbBar;
  private footer!: Label;
  private split!: EditorSplitContainer;
  private context!: EditorMenu;
  private dialog!: EditorDialog;
  private errorShown = '';
  private headers!: AssetColumns;
  private sources: SourceItem[] = [];
  private dirtySignature = '';
  private get selected (): Set<string> { return this.selection.selected; }
  private set selected (values: Set<string>) { this.selection.selected = values; }
  private get selectedEntries (): AssetEntry[] { return [...this.selected].map(id => library.entry(id)).filter((entry): entry is AssetEntry => !!entry); }

  constructor () {
    super(); this.title = 'Content Browser'; this.open();
    setContentBrowserActions({ selected: () => [...this.selected],
      reveal: id => {
        const entry = library.entry(id);

        if (!entry || entry.deletedAt) { return; }
        this.open(); this.navigate(entry.parentId); this.selected = new Set([id]); this.selection.anchor = id; this.assetView?.revealAsset(id);
      },
    });
    void library.initialize().then(() => { this.resetProject(); this.refresh(); });
  }
  @menuItem('Window/Content Browser')
  static showWindow (): void { EditorWindow.getWindow(ContentBrowserPanel).open(); }
  protected override createContent (engine: Engine): Control {
    const root = column(engine), nav = new EditorToolbar(engine, 26);

    this.context = new EditorMenu(engine); this.dialog = new EditorDialog(engine);
    const add = append(nav, new EditorPositiveActionButton(engine, 'Add'));

    add.setCustomMinimumSize(0, 26);
    add.actions = () => this.createActions();
    const importButton = append(nav, new EditorIconButton(engine, 'import', 'Import'));
    const save = append(nav, new EditorIconButton(engine, 'save', 'Save All'));

    importButton.on('pressed', () => this.importer.choose(this.folder)); save.on('pressed', () => { void sceneWorkspace.saveAll().catch(error => library.report(error)); });
    const back = this.historyBack = append(nav, new EditorIconButton(engine, 'historyBack'));
    const forward = this.historyForward = append(nav, new EditorIconButton(engine, 'historyForward'));

    back.on('pressed', () => { if (this.historyIndex > 0) { this.navigate(this.history[--this.historyIndex], false); } });
    forward.on('pressed', () => { if (this.historyIndex < this.history.length - 1) { this.navigate(this.history[++this.historyIndex], false); } });
    this.breadcrumbs = append(nav, expand(new EditorBreadcrumbBar(engine), true, false));
    this.breadcrumbs.rootActions = () => [{ label: 'Content', icon: 'folder', action: () => this.navigate(ASSET_ROOT) }, ...this.folderActions(ASSET_ROOT)];
    this.breadcrumbs.readPath = () => library.pathText(this.folder);
    this.breadcrumbs.navigatePath = path => {
      const id = [ASSET_ROOT, ...library.entries.filter(entry => entry.kind === 'folder' && !entry.deletedAt).map(entry => entry.id)].find(id => library.pathText(id).toLocaleLowerCase() === path.replace(/\/$/, '').toLocaleLowerCase());

      if (id) { this.navigate(id); }
    };
    const settings = append(nav, new EditorMenuButton(engine, 'Settings'));

    settings.iconName = 'settings'; settings.showArrow = true; settings.actions = () => this.settingsActions();
    append(root, margin(engine, nav, 6, 3));
    const sources = this.sourceList = new ContentSourcesView(engine, this, (group, query) => { this.sourceQueries[group] = query; this.refreshSources(); }, () => this.newCollection());
    const assets = column(engine), searchBar = row(engine), filters = append(searchBar, new EditorMenuButton(engine, 'Filters'));

    filters.iconName = 'filter'; filters.showArrow = true;
    filters.actions = () => this.filterActions();
    this.searchEdit = append(searchBar, expand(new EditorSearchField(engine), true, false)); this.searchEdit.placeholderText = 'Search assets';
    this.searchEdit.on('textChanged', value => { this.search = value; this.refreshAssets(); });
    const sort = append(searchBar, new EditorMenuButton(engine, ''));

    sort.iconName = 'sort'; sort.showArrow = true;
    sort.actions = () => this.sortActions(); append(assets, margin(engine, searchBar, 6, 4));
    this.assetView = append(assets, expand(new AssetView(engine, {
      selected: id => this.selected.has(id),
      choose: (id, modifiers) => { this.selection.choose(id, this.visibleEntries().map(entry => entry.id), modifiers); },
      open: id => {
        const entry = library.entry(id);

        if (entry) { this.openAsset(entry); }
      },
      rename: (id, name) => { void library.rename(id, name); },
      context: (id, position) => this.showContext(id, position),
      drag: id => this.showTrash || library.busy || sceneWorkspace.busy ? undefined : { type: CONTENT_ASSET_PAYLOAD, data: { ids: this.selected.has(id) ? [...this.selected] : [id] } },
      canDrop: (id, data) => this.validDrop(id && library.entry(id)?.kind === 'folder' ? id : this.folder, data),
      drop: (id, data, position) => this.dropInFolder(id && library.entry(id)?.kind === 'folder' ? id : this.folder, data, position),
      key: event => this.key(event),
      marquee: (ids, additive) => { this.selected = new Set(additive ? [...this.selected, ...ids] : ids); },
    })));
    this.headers = new AssetColumns(engine, this.assetView, [
      { label: 'Name', sort: 'name' }, { label: 'Type', sort: 'type' }, { label: 'Dimensions' }, { label: 'File Size', sort: 'size' }, { label: 'Date Modified', sort: 'modified' },
    ], key => {
      const sort = key as typeof library.preferences.sort;

      library.preferences.descending = library.preferences.sort === sort ? !library.preferences.descending : false; library.preferences.sort = sort; this.saveSettings(); this.refreshAssets();
    });
    this.assetView.parent = null; append(assets, this.headers); append(assets, this.assetView);
    const sourcePanel = new PanelContainer(engine), assetPanel = new PanelContainer(engine);

    sourcePanel.setThemeStyleBoxOverride('panel', editorBox(editorColors.recessed)); assetPanel.setThemeStyleBoxOverride('panel', editorBox(editorColors.panel));
    append(sourcePanel, sources); append(assetPanel, assets);
    this.split = append(root, expand(new EditorSplitContainer(engine, sourcePanel, assetPanel, false, .2)));
    this.split.on('sizeChanged', () => this.layoutSources());
    this.split.changed = ratio => { library.preferences.sourcesWidth = Math.max(140, Math.min(380, ratio * (this.split.width - 2))); this.layoutSources(); this.saveSettings(); };
    const footer = row(engine);

    this.footer = append(footer, expand(label(engine, ''), true, false)); this.footer.verticalAlignment = VerticalAlignment.Center;
    append(assets, margin(engine, footer, 6, 2)); this.refresh();

    return root;
  }
  protected override onEnable (): void { this.importer.enable(); }
  protected override onDisable (): void { this.importer.disable(); }
  override update (): void {
    if (!this.assetView) { return; }
    if (this.projectId !== library.projectId) { this.resetProject(); this.refresh(); }
    if (this.revision !== library.revision) { this.revision = library.revision; this.refresh(); }
    const entries = this.visibleEntries();
    const dirty = entries.filter(entry => isContentAssetDirty(entry.id) || entry.kind === 'scene' && sceneWorkspace.current?.storageId === entry.id && sceneWorkspace.current.dirty).map(entry => entry.id).join();

    if (dirty !== this.dirtySignature) { this.dirtySignature = dirty; this.refreshAssets(); }
    const count = entries.length;

    this.assetView.emptyText = !library.ready ? 'Loading content…' : this.showTrash ? 'Trash is empty' : this.search ? 'No assets match your search' : 'Drop files here or use Add to create content';

    this.footer.text = count + ' items' + (this.selected.size ? ' (' + this.selected.size + ' selected)' : '') + '   ' + (library.busy ? library.progress || 'Saving content...' : library.notice);
    this.split.first.visible = library.preferences.sources;
    if (this.isActive() && !this.showTrash && !library.busy && !sceneWorkspace.changingDocument) {
      const origin = screenPosition(this.assetView);

      this.importer.areas = [{ x: origin.x, y: origin.y, width: this.assetView.width, height: this.assetView.height, folder: this.folder }];
      for (const { id, rect } of this.assetView.visibleItemRects()) {
        if (library.entry(id)?.kind === 'folder') { this.importer.areas.push({ ...rect, folder: id }); }
      }
      if (this.sourceList.visibleInHierarchy) { this.importer.areas.push(...this.sourceList.folderRects(this.sources)); }
    } else { this.importer.areas = []; }
    this.assetView.importHighlight = this.importer.hovered;
    if (library.error && library.error !== this.errorShown) {
      this.errorShown = library.error;
      this.dialog.show(this.content!, 'Content Browser Error', body => this.dialog.message(body, library.error), [
        { label: 'OK', action: () => { library.error = ''; this.errorShown = ''; this.dialog.close(); } },
      ]);
    }
  }
  private resetProject (): void {
    this.projectId = library.projectId; this.folder = library.preferences.folder; this.collection = undefined;
    this.history = [this.folder]; this.historyIndex = 0; this.selected.clear(); this.selection.anchor = undefined;
    this.search = this.assetType = this.extension = ''; this.sourceQueries = { favorites: '', project: '', collections: '' }; this.showTrash = false; this.clipboard = undefined;
    this.expanded = new Set([ASSET_ROOT, 'project', 'favorites', 'collections', ...library.path(this.folder).map(entry => entry.id)]);
    this.thumbnails.clear(); this.loadingAssets.clear();
    if (this.searchEdit) { this.searchEdit.text = ''; }
    this.sourceList?.resetFilters();
  }
  private saveSettings (): void {
    const project = library.projectId;

    window.clearTimeout(this.preferencesTimer);
    this.preferencesTimer = window.setTimeout(() => { if (project === library.projectId) { void library.savePreferences(); } }, 150);
  }
  private navigate (folder: string, history = true): void {
    if (folder !== ASSET_ROOT && (!library.entry(folder) || library.entry(folder)?.deletedAt)) { folder = ASSET_ROOT; }
    this.folder = folder; this.collection = undefined; this.showTrash = false; this.selected.clear(); this.selection.anchor = undefined;
    this.search = ''; if (this.searchEdit) { this.searchEdit.text = ''; }
    for (const parent of library.path(folder)) { this.expanded.add(parent.id); }
    if (history && this.history[this.historyIndex] !== folder) { this.history.splice(this.historyIndex + 1); this.history.push(folder); this.historyIndex = this.history.length - 1; }
    library.preferences.folder = folder; this.saveSettings(); this.refresh();
  }
  private refresh (): void {
    if (!this.assetView) { return; }
    this.historyBack.disabled = this.historyIndex <= 0; this.historyForward.disabled = this.historyIndex >= this.history.length - 1;
    this.breadcrumbs.setPath([{ id: ASSET_ROOT, label: 'Content' }, ...library.path(this.folder).map(entry => ({ id: entry.id, label: entry.name }))].map(entry => ({ ...entry, select: () => this.navigate(entry.id), children: () => this.folderActions(entry.id) })));
    this.layoutSources(); this.refreshSources(); this.refreshAssets();
  }
  private folderActions (id: string): MenuAction[] {
    return library.children(id).filter(entry => entry.kind === 'folder' && !entry.deletedAt).map(entry => ({ label: entry.name, icon: 'folder', action: () => this.navigate(entry.id) }));
  }
  private layoutSources (): void {
    const available = this.split.width - 2;

    if (available <= 0) { return; }
    const maximum = Math.max(80, Math.min(380, available * .45)), minimum = Math.min(140, maximum);

    this.split.ratio = Math.max(minimum, Math.min(maximum, library.preferences.sourcesWidth)) / available;
  }
  sourceKey (source: SourceItem, event: InputEventKey): boolean {
    const rows = this.sourceList.rowsFor(source.id);
    const command = event.ctrlPressed || event.metaPressed, key = event.keycode.toLowerCase();
    const entry = source.folder ? library.entry(source.folder) : undefined;

    if (event.altPressed || event.keycode === 'F4' || command && ['f', 'v', 'l', 'backspace'].includes(key)) {
      this.key(event);

      return event.isAccepted();
    }
    if (command && event.shiftPressed && key === 'n') {
      this.createAsset('folder');

      return true;
    }
    if (entry && command && (key === 'c' || key === 'x')) {
      this.clipboard = { ids: [entry.id], cut: key === 'x' };

      return true;
    }
    if (entry && command && key === 'd') {
      void library.transfer([entry.id], entry.parentId, true);

      return true;
    }
    if (entry && event.keycode === 'F2') {
      this.navigate(entry.parentId); this.selected = new Set([entry.id]); this.assetView.revealAsset(entry.id, true);

      return true;
    }
    if (entry && (event.keycode === 'Delete' || event.keycode === 'Backspace')) {
      this.deleteSelection([entry.id]);

      return true;
    }

    return navigateContentSources(rows, source, event, target => { this.sourceList.reveal(target.id); this.sourceList.row(target.id)?.grabFocus(); });
  }
  private refreshSources (): void {
    if (!this.sourceList) { return; }
    const values: SourceItem[] = []; let query = this.sourceQueries.favorites.toLocaleLowerCase();
    const toggle = (id: string): void => { if (this.expanded.has(id)) { this.expanded.delete(id); } else { this.expanded.add(id); } this.refreshSources(); };
    const heading = (id: string, name: string): boolean => {
      values.push({ id, name, icon: 'sources', depth: 0, selected: false, expanded: this.expanded.has(id), toggle: () => toggle(id), action: () => toggle(id) });

      return this.expanded.has(id) || !!query;
    };
    const folderRow = (entry: { id: string, name: string }, depth: number, prefix = '', tree = false): void => {
      const children = library.children(entry.id).filter(child => child.kind === 'folder' && !child.deletedAt).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const terms = query.split(/\s+/).filter(Boolean), excluded = (name: string): boolean => terms.some(term => term.startsWith('-') && term.length > 1 && name.toLocaleLowerCase().includes(term.slice(1)));
      const matches = (name: string): boolean => !excluded(name) && terms.filter(term => !term.startsWith('-')).every(term => name.toLocaleLowerCase().includes(term));
      const shown = !excluded(entry.name) && (matches(entry.name) || tree && library.descendants(entry.id).some(child => child.kind === 'folder' && matches(child.name)));

      if (!shown) { return; }
      values.push({ id: prefix + entry.id, name: entry.name, icon: 'folder', depth, folder: entry.id, selected: !this.collection && !this.showTrash && this.folder === entry.id,
        expanded: this.expanded.has(entry.id), toggle: tree && children.length ? () => toggle(entry.id) : undefined, action: () => this.navigate(entry.id),
        context: position => { this.navigate(entry.id); if (entry.id !== ASSET_ROOT) { this.selected = new Set([entry.id]); this.showContext(entry.id, position); } else { this.showContext(undefined, position); } },
      });
      if (tree && (this.expanded.has(entry.id) || query)) { children.forEach(child => folderRow(child, depth + 1, prefix, true)); }
    };

    if (heading('favorites', 'Favorites')) { library.entries.filter(entry => entry.kind === 'folder' && entry.favorite && !entry.deletedAt).forEach(entry => folderRow(entry, 0, 'favorite:')); }
    query = this.sourceQueries.project.toLocaleLowerCase();
    if (heading('project', projectWorkspace.current?.name ?? 'Project')) { folderRow({ id: ASSET_ROOT, name: 'Content' }, 0, '', true); }
    query = this.sourceQueries.collections.toLocaleLowerCase();
    if (heading('collections', 'Collections')) {
      for (const collection of library.preferences.collections.filter(collection => collection.name.toLocaleLowerCase().includes(query)).sort((a, b) => a.name.localeCompare(b.name))) {
        values.push({ id: collection.id, name: collection.name, icon: 'collection', depth: 1, selected: this.collection === collection.id,
          action: () => { this.collection = collection.id; this.showTrash = false; this.selected.clear(); this.refresh(); },
          context: position => {
            this.context.setActions([{ label: 'Delete Collection', action: () => {
              library.preferences.collections = library.preferences.collections.filter(item => item !== collection); if (this.collection === collection.id) { this.collection = undefined; } this.saveSettings(); this.refresh();
            } }]); this.context.show(this.sourceList, position);
          },
        });
      }
    }
    this.sources = values; this.sourceList.setRows(values);
  }
  private refreshAssets (): void {
    if (!this.assetView) { return; }
    const entries = this.visibleEntries();

    this.assetView.configure(library.preferences.view, library.preferences.thumbnailSize);
    this.headers.visible = library.preferences.view === 'columns';
    this.assetView.setItems(entries.map(entry => {
      if ((entry.kind === 'sprite' || entry.kind === 'material') && !library.asset(EditorRuntimeSession.player.engine, entry.id) && !this.loadingAssets.has(entry.id)) {
        this.loadingAssets.add(entry.id); void library.loadAsset(EditorRuntimeSession.player.engine, entry.id).catch(error => library.report(error)).then(() => this.loadingAssets.delete(entry.id));
      }

      return this.assetSource.describe(entry, entry.name + ((entry.kind === 'scene' && sceneWorkspace.current?.storageId === entry.id && sceneWorkspace.current.dirty || isContentAssetDirty(entry.id)) ? '*' : ''));
    }));
  }
  private visibleEntries (): AssetEntry[] {
    const query = this.search.trim().toLowerCase(), collection = library.preferences.collections.find(entry => entry.id === this.collection);
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

  private openAsset (entry: AssetEntry): void {
    if (entry.deletedAt) { return; }
    if (entry.kind === 'folder') { this.navigate(entry.id); } else if (entry.kind === 'scene') { if (!sceneWorkspace.busy) { void sceneWorkspace.openSaved(entry); } } else if (entry.kind === 'texture') { openTextureAsset(entry.id); } else { openContentAsset(entry.id); }
  }
  private createActions (folder = this.folder): MenuAction[] {
    return [
      { label: 'Get', heading: true }, { label: 'Import…', icon: 'import', action: () => this.importer.choose(folder) },
      { label: 'Create', heading: true },
      { label: 'New Folder', icon: 'newFolder', action: () => this.createAsset('folder', folder) }, { label: 'New Scene', icon: 'scene', action: () => this.createAsset('scene', folder) },
      { label: '', separator: true },
      ...(['material', 'shader', 'sprite'] as const).map(kind => ({ label: ASSET_PRESENTATION[kind].label, icon: ASSET_PRESENTATION[kind].menuIcon, action: () => this.createAsset(kind, folder) })),
    ];
  }
  private createAsset (kind: Exclude<AssetKind, 'texture'>, folder = this.folder, reference?: string): void {
    this.navigate(folder); this.assetType = this.extension = ''; library.preferences.showFolders = true;
    const project = library.projectId, request = kind === 'folder' ? library.newFolder(folder) : kind === 'scene' ? library.newScene(folder) : library.newObject(kind, folder, reference);

    void request.then(id => {
      if (!id || project !== library.projectId) { return; }
      this.selected = new Set([id]); this.selection.anchor = id; this.refresh(); this.assetView.revealAsset(id, true);
    }).catch(error => library.report(error));
  }
  private showContext (id: string | undefined, position: math.Vector2): void {
    const entry = id ? library.entry(id) : undefined;
    const actions: MenuAction[] = [];

    if (!entry) { actions.push(...this.createActions(), { label: '', separator: true }, { label: 'Paste', enabled: !!this.clipboard, action: () => this.paste() }); } else if (entry.deletedAt) { actions.push({ label: 'Restore', action: () => { void library.trash([...this.selected], true); } }); } else {
      actions.push({ label: entry.kind === 'folder' ? 'Folder Options' : 'Common', heading: true });
      actions.push({ label: entry.kind === 'folder' ? 'Open Folder' : 'Edit', shortcut: 'Enter', action: () => this.openAsset(entry) },
        { label: 'Rename', shortcut: 'F2', enabled: this.selected.size <= 1, action: () => { if (entry.parentId !== this.folder) { this.navigate(entry.parentId); } this.assetView.revealAsset(entry.id, true); } },
        { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => { void library.transfer([...this.selected], entry.parentId, true); } },
        { label: 'Delete', shortcut: 'Delete', action: () => this.deleteSelection() });
      if (entry.kind === 'scene') {
        actions.push({ label: 'Set as Startup Scene', checked: projectWorkspace.current?.startupSceneId === entry.id, action: () => {
          const project = projectWorkspace.current;

          if (project) { void projectWorkspace.settings({ name: project.name, description: project.description, startupSceneId: entry.id }); }
        } });
      }
      if (entry.kind === 'folder') { actions.push({ label: 'Create Asset', children: () => this.createActions(entry.id) }, { label: entry.favorite ? 'Remove From Favorites' : 'Add To Favorites', action: () => { void library.favorite(entry.id); } }); }
      if (entry.kind !== 'folder' && library.preferences.collections.length) {
        actions.push({ label: 'Add To Collection', children: library.preferences.collections.map(collection => ({ label: collection.name, action: () => {
          collection.assets = [...new Set([...collection.assets, ...this.selectedEntries.filter(entry => entry.kind !== 'folder').map(entry => entry.id)])]; this.saveSettings(); this.refresh();
        } })) });
      }
      if (this.collection) {
        actions.push({ label: 'Remove From Collection', action: () => {
          const collection = library.preferences.collections.find(item => item.id === this.collection);

          if (collection) { collection.assets = collection.assets.filter(id => !this.selected.has(id)); this.saveSettings(); this.refreshAssets(); }
        } });
      }
      if (entry.kind === 'texture') { actions.push({ label: 'Create Sprite', action: () => this.createAsset('sprite', entry.parentId, entry.id) }, { label: 'Reimport…', action: () => this.importer.choose(entry.parentId, entry.id) }); }
      if (entry.kind === 'shader') { actions.push({ label: 'Create Material', action: () => this.createAsset('material', entry.parentId, entry.id) }); }
      actions.push({ label: 'Copy', shortcut: 'Ctrl+C', action: () => this.clipboard = { ids: [...this.selected], cut: false } },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => this.clipboard = { ids: [...this.selected], cut: true } },
        entry.kind === 'folder' ? { label: '', separator: true } : { label: 'References', heading: true },
        { label: 'Copy Reference', action: () => { void navigator.clipboard.writeText(library.pathText(entry.parentId) + '/' + entry.name); } });
    }
    this.context.setActions(actions); this.context.show(this.assetView, position);
  }
  private dropIds (data: unknown): string[] {
    const payload = data as { type?: string, data?: { ids?: string[] } | EffectsObject };

    return payload.type === CONTENT_ASSET_PAYLOAD && payload.data && !(payload.data instanceof EffectsObject)
      ? payload.data.ids ?? [] : payload.data instanceof EffectsObject ? [payload.data.getInstanceId()] : [];
  }
  validDrop (folder: string, data: unknown): boolean {
    const ids = this.dropIds(data);

    return !this.showTrash && !!ids.length && ids.every(id => library.entry(id) && id !== folder && !library.path(folder).some(parent => parent.id === id));
  }
  dropInFolder (folder: string, data: unknown, position: math.Vector2): void {
    if (!this.validDrop(folder, data)) { return; }
    const ids = this.dropIds(data);

    this.context.setActions([{ label: 'Move Here', action: () => { void library.transfer(ids, folder); } }, { label: 'Copy Here', action: () => { void library.transfer(ids, folder, true); } }, { label: 'Cancel' }]);
    this.context.show(this.assetView, position);
  }
  private deleteSelection (ids = [...this.selected]): void {
    if (!ids.length) { return; }
    this.dialog.show(this.content!, 'Delete Assets', body => this.dialog.message(body, 'Move ' + ids.length + ' items to Trash?\n' + ids.slice(0, 8).map(id => library.entry(id)?.name ?? '').join('\n')), [
      { label: 'Delete', action: () => { this.dialog.close(); void library.trash(ids).then(() => { this.selected.clear(); if (library.entry(this.folder)?.deletedAt) { this.navigate(ASSET_ROOT); } this.refresh(); }); } },
      { label: 'Cancel', action: () => this.dialog.close() },
    ]);
  }
  private newCollection (): void {
    let name: LineEdit;
    const create = (): void => {
      if (!name.text.trim()) { return; }
      library.preferences.collections.push({ id: generateGUID(), name: name.text.trim(), assets: this.selectedEntries.filter(entry => entry.kind !== 'folder').map(entry => entry.id) });
      this.saveSettings(); this.dialog.close(); this.refreshSources();
    };

    this.dialog.show(this.content!, 'New Collection', body => { name = append(body, new EditorTextField(body.engine)); name.placeholderText = 'Collection Name'; name.on('textSubmitted', create); },
      [{ label: 'Create', primary: true, enabled: () => !!name?.text.trim(), action: create }, { label: 'Cancel', action: () => this.dialog.close() }]);
    name!.grabFocus();
  }
  private paste (): void { if (this.clipboard) { void library.transfer(this.clipboard.ids, this.folder, !this.clipboard.cut); if (this.clipboard.cut) { this.clipboard = undefined; } } }
  private key (event: InputEventKey): void {
    const command = event.ctrlPressed || event.metaPressed, key = event.keycode, lower = key.toLowerCase(), entries = this.visibleEntries(), first = this.selectedEntries[0];

    if (key === 'F4' || command && lower === 'l') { this.breadcrumbs.editPath(); } else if (command && key === 'Backspace') { this.navigate(library.entry(this.folder)?.parentId ?? ASSET_ROOT); } else if (command && lower === 'a') { this.selected = new Set(entries.map(entry => entry.id)); } else if (command && lower === 'f') { this.searchEdit.grabFocus(); } else if (command && event.shiftPressed && lower === 'n') { this.createAsset('folder'); } else if (command && (lower === 'c' || lower === 'x')) { this.clipboard = { ids: [...this.selected], cut: lower === 'x' }; } else if (command && lower === 'v') { this.paste(); } else if (command && lower === 'd') { void library.transfer([...this.selected], this.folder, true); } else if (key === 'F2' && first) { this.assetView.revealAsset(first.id, true); } else if (key === 'Delete' || key === 'Backspace') { this.deleteSelection(); } else if (key === 'Enter' && first) { this.openAsset(first); } else if (event.altPressed && key === 'ArrowLeft' && this.historyIndex > 0) { this.navigate(this.history[--this.historyIndex], false); } else if (event.altPressed && key === 'ArrowRight' && this.historyIndex < this.history.length - 1) { this.navigate(this.history[++this.historyIndex], false); } else if (key.startsWith('Arrow') && entries.length) {
      const current = Math.max(0, entries.findIndex(entry => entry.id === this.selection.focused)), delta = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -this.assetView.columns : this.assetView.columns;
      const entry = entries[Math.max(0, Math.min(entries.length - 1, current + delta))];

      this.selection.choose(entry.id, entries.map(item => item.id), { additive: command, range: event.shiftPressed }); this.assetView.revealAsset(entry.id);
    } else { return; }
    event.accept();
  }
  private filterActions (): MenuAction[] {
    return [{ label: 'Clear All', enabled: !!this.assetType || !!this.extension, action: () => { this.assetType = this.extension = ''; this.refreshAssets(); } },
      { label: 'All Assets', checked: !this.assetType && !this.extension, action: () => { this.assetType = this.extension = ''; this.refreshAssets(); } },
      ...(['scene', 'texture', 'material', 'shader', 'sprite'] as const).map(kind => ({ label: ASSET_PRESENTATION[kind].label, checked: this.assetType === kind,
        action: () => { this.assetType = this.assetType === kind ? '' : kind; this.refreshAssets(); } })),
      { label: 'Texture Formats', children: [...new Set(library.entries.filter(entry => entry.mime).map(entry => entry.mime!.split('/')[1].replace('svg+xml', 'svg').toUpperCase()))].map(extension => ({
        label: extension, checked: this.extension === extension, action: () => { this.extension = this.extension === extension ? '' : extension; this.refreshAssets(); },
      })) }];
  }
  private sortActions (): MenuAction[] {
    return [{ label: 'Sort By', heading: true }, ...(['name', 'type', 'size', 'modified'] as const).map(key => ({ label: key, checked: library.preferences.sort === key,
      action: () => { library.preferences.sort = key; this.saveSettings(); this.refreshAssets(); } })),
    { label: 'Sort Type', heading: true }, ...[false, true].map(descending => ({ label: descending ? 'Descending' : 'Ascending', checked: library.preferences.descending === descending,
      action: () => { library.preferences.descending = descending; this.saveSettings(); this.refreshAssets(); } }))];
  }
  private settingsActions (): MenuAction[] {
    const toggle = (key: 'sources' | 'showFolders' | 'recursive' | 'realtimeThumbnails', label: string): MenuAction => ({ label, checked: library.preferences[key], action: () => {
      library.preferences[key] = !library.preferences[key]; this.saveSettings(); this.refresh();
    } });

    return [{ label: 'View Type', heading: true }, ...(['tiles', 'list', 'columns'] as const).map(view => ({ label: view[0].toUpperCase() + view.slice(1), icon: view, checked: library.preferences.view === view,
      action: () => { library.preferences.view = view; this.saveSettings(); this.refreshAssets(); } })),
    { label: 'Thumbnails', heading: true },
    { label: 'Thumbnail Size', children: ([48, 72, 96, 144, 192] as const).map((size, i) => ({ label: ['Tiny', 'Small', 'Medium', 'Large', 'Huge'][i], checked: library.preferences.thumbnailSize === size,
      action: () => { library.preferences.thumbnailSize = size; this.saveSettings(); this.refreshAssets(); } })) },
    toggle('realtimeThumbnails', 'Real-Time Thumbnails'),
    { label: 'Show', heading: true }, toggle('sources', 'Show Sources Panel'), toggle('showFolders', 'Show Folders'), toggle('recursive', 'Filter Recursively'),
    { label: 'Show Deleted Assets', checked: this.showTrash, action: () => { this.showTrash = !this.showTrash; this.collection = undefined; this.selected.clear(); this.refresh(); } }];
  }
  override dispose (): void {
    window.clearTimeout(this.preferencesTimer); this.importer.disable(); this.thumbnails.clear(); this.context?.dispose(); this.dialog?.dispose(); super.dispose();
  }
}
