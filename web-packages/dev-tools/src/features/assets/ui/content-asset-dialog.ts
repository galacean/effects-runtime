import type { Engine, InputEventKey, math } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Label, PanelContainer, SizeFlags, TextOverflow, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { AssetView } from '../../../ui/asset-view/asset-view';
import { EditorBreadcrumbBar } from '../../../ui/controls/breadcrumb-bar';
import { EditorDialog } from '../../../ui/controls/dialog';
import { append, column, expand, label, margin, row } from '../../../ui/controls/layout';
import { EditorMenu } from '../../../ui/controls/menu';
import { EditorSearchField } from '../../../ui/controls/search-field';
import { EditorSplitContainer } from '../../../ui/controls/split-container';
import { EditorTextField } from '../../../ui/controls/text-field';
import { EditorToolbar } from '../../../ui/controls/toolbar';
import { setTooltip } from '../../../ui/controls/tooltip';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import { editorBox, editorColors } from '../../../ui/theme/control-theme';
import { assetLibrary } from '../asset-library';
import { ASSET_ROOT, type AssetEntry, type AssetKind } from '../model/asset-types';
import { ASSET_PRESENTATION } from './asset-presentation';
import { ContentPathPicker } from './content-path-picker';

interface AssetDialogOptions {
  mode: 'open' | 'save', kind: Exclude<AssetKind, 'folder'>, folder: string, name?: string,
  busy: () => boolean,
  changed?: (folder: string, name: string) => void,
  confirm: (id: string | undefined, folder: string, name: string) => void,
  cancel: () => void,
}

export class ContentAssetDialog extends EditorDialog {
  private options!: AssetDialogOptions;
  private folder = ASSET_ROOT;
  private selected?: string;
  private query = '';
  private picker!: ContentPathPicker;
  private view!: AssetView;
  private breadcrumbs!: EditorBreadcrumbBar;
  private name?: EditorTextField;
  private path!: Label;
  private count!: Label;
  private history: string[] = [];
  private historyIndex = 0;
  private revision = -1;
  private entries: AssetEntry[] = [];
  private back!: EditorIconButton;
  private forward!: EditorIconButton;
  private search!: EditorSearchField;
  private readonly context: EditorMenu;

  constructor (engine: Engine) {
    super(engine); this.context = new EditorMenu(engine);
    for (const side of ['Left', 'Top', 'Right', 'Bottom']) { this.bodyMargin.setThemeConstantOverride('margin' + side, 0); }
    this.body.setThemeConstantOverride('separation', 0);
  }

  showAssets (source: Control, title: string, options: AssetDialogOptions): void {
    this.options = options; this.folder = options.folder; this.selected = undefined; this.query = ''; this.name = undefined;
    this.history = [this.folder]; this.historyIndex = 0;
    this.show(source, title, body => {
      const toolbar = new EditorToolbar(this.engine, 28);

      append(body, margin(this.engine, toolbar, 2)); toolbar.setThemeConstantOverride('separation', 2);
      this.back = new EditorIconButton(this.engine, 'historyBack');
      const backMargin = append(toolbar, margin(this.engine, this.back, 0));

      backMargin.setThemeConstantOverride('marginLeft', 10);
      this.back.on('pressed', () => { if (this.historyIndex > 0) { this.navigate(this.history[--this.historyIndex], false); } });
      this.forward = append(toolbar, new EditorIconButton(this.engine, 'historyForward'));
      this.forward.on('pressed', () => { if (this.historyIndex < this.history.length - 1) { this.navigate(this.history[++this.historyIndex], false); } });
      for (const button of [this.back, this.forward]) { button.themeTypeVariation = 'EditorSimpleButton'; button.verticalSizeFlags = SizeFlags.ShrinkCenter; }

      setTooltip(this.back, 'Back'); setTooltip(this.forward, 'Forward');
      this.breadcrumbs = append(toolbar, expand(new EditorBreadcrumbBar(this.engine), true, false));
      this.breadcrumbs.readPath = () => assetLibrary.pathText(this.folder);
      this.breadcrumbs.navigatePath = path => {
        const entry = assetLibrary.entries.find(entry => entry.kind === 'folder' && !entry.deletedAt && assetLibrary.pathText(entry.id).toLocaleLowerCase() === path.toLocaleLowerCase());

        if (entry || /^\/(game|content)\/?$/i.test(path)) { this.navigate(entry?.id ?? ASSET_ROOT); }
      };
      const paths = new PanelContainer(this.engine), assets = new PanelContainer(this.engine);

      paths.setThemeStyleBoxOverride('panel', editorBox(editorColors.panel, 2));
      assets.setThemeStyleBoxOverride('panel', editorBox(editorColors.panel, 2));
      this.picker = append(paths, new ContentPathPicker(this.engine, folder => this.navigate(folder), (folder, position) => this.folderMenu(folder, this.picker, position)));
      const main = append(assets, column(this.engine));
      const search = this.search = new EditorSearchField(this.engine, 'Search ' + ASSET_PRESENTATION[options.kind].label + ' assets');

      append(main, margin(this.engine, search, 8)); search.on('textChanged', text => { this.query = text; this.refresh(); });
      const viewPanel = append(main, expand(new PanelContainer(this.engine)));

      viewPanel.setThemeStyleBoxOverride('panel', editorBox(editorColors.recessed));
      this.view = append(viewPanel, new AssetView(this.engine, {
        selected: id => this.selected === id, choose: id => this.select(id), open: id => {
          const entry = assetLibrary.entry(id);

          if (entry?.kind === 'folder') { this.navigate(id); } else { this.select(id); this.confirm(); }
        },
        context: (id, position) => this.folderMenu(assetLibrary.entry(id ?? '')?.kind === 'folder' ? id! : this.folder, this.view, position),
        rename: (id, name) => { if (assetLibrary.entry(id)?.kind === 'folder') { void assetLibrary.rename(id, name); } },
        drag: () => undefined, canDrop: () => false, drop: () => {}, key: event => this.key(event),
      }));
      this.view.configure('tiles', 80); this.view.emptyText = 'No matching assets';
      this.count = label(this.engine, '', editorColors.foreground); this.count.verticalAlignment = VerticalAlignment.Center;
      append(main, margin(this.engine, this.count, 8, 5));
      const split = new EditorSplitContainer(this.engine, paths, assets, false, .25);
      const splitMargin = append(body, margin(this.engine, split, 0));

      splitMargin.setThemeConstantOverride('marginBottom', 4);
      split.setCustomMinimumSize(0, Math.min(340, Math.max(180, (source.root?.height ?? window.innerHeight) - 230)));
      const fields = append(this.beforeButtons, row(this.engine, [], 8)), labels = append(fields, column(this.engine, [], 8));
      const values = append(fields, expand(column(this.engine, [], 8), true, false));

      for (const caption of options.mode === 'save' ? ['Path:', 'Name:'] : ['Path:']) {
        const text = append(labels, label(this.engine, caption));

        text.verticalAlignment = VerticalAlignment.Center; text.setCustomMinimumSize(0, 22);
      }
      this.path = append(values, new Label(this.engine)); this.path.textOverflow = TextOverflow.Ellipsis;
      this.path.verticalAlignment = VerticalAlignment.Center; this.path.setCustomMinimumSize(0, 22);
      if (options.mode === 'save') {
        this.name = append(values, new EditorTextField(this.engine)); this.name.text = options.name ?? '';
        this.name.on('textChanged', () => options.changed?.(this.folder, this.name!.text)); this.name.on('textSubmitted', () => this.confirm());
      }
      this.refresh(); this.refreshNavigation();
    }, [
      { label: options.mode === 'save' ? 'Save' : 'Open', primary: true, enabled: () => this.canConfirm(), action: () => this.confirm() },
      { label: 'Cancel', enabled: () => !options.busy(), action: options.cancel },
    ], Math.min(920, (source.root?.width ?? window.innerWidth) - 24));
    const name = this.name as EditorTextField | undefined;

    if (name) { name.grabFocus(); name.selectAll(); } else { this.search.grabFocus(); }
  }
  private canConfirm (): boolean { return !this.options.busy() && (this.options.mode === 'save' ? !!this.name?.text.trim() : assetLibrary.entry(this.selected ?? '')?.kind === this.options.kind); }
  private confirm (): void { if (this.canConfirm()) { this.options.confirm(this.selected, this.folder, this.name?.text.trim() ?? ''); } }
  private select (id: string): void {
    this.selected = id;
    const entry = assetLibrary.entry(id);

    if (this.name && entry?.kind === this.options.kind) { this.name.text = entry.name; this.options.changed?.(this.folder, entry.name); }
    this.view.refresh();
  }
  private navigate (folder: string, remember = true): void {
    if (folder !== ASSET_ROOT && (assetLibrary.entry(folder)?.kind !== 'folder' || assetLibrary.entry(folder)?.deletedAt)) { return; }
    this.folder = folder; this.selected = undefined;
    if (remember && this.history[this.historyIndex] !== folder) { this.history.splice(++this.historyIndex); this.history.push(folder); }
    this.options.changed?.(folder, this.name?.text ?? ''); this.refresh();
  }
  private refresh (): void {
    const folders = (id: string) => assetLibrary.children(id).filter(entry => entry.kind === 'folder').map(entry => ({ label: entry.name, icon: 'folder' as const, action: () => this.navigate(entry.id) }));

    this.breadcrumbs.rootActions = () => [{ label: 'Content', icon: 'folder', action: () => this.navigate(ASSET_ROOT) }];
    this.breadcrumbs.setPath([{ id: ASSET_ROOT, label: 'Content', select: () => this.navigate(ASSET_ROOT), children: () => folders(ASSET_ROOT) },
      ...assetLibrary.path(this.folder).map(entry => ({ id: entry.id, label: entry.name, select: () => this.navigate(entry.id), children: () => folders(entry.id) }))]);
    this.picker.select(this.folder); this.path.text = assetLibrary.pathText(this.folder);
    const candidates = this.query ? assetLibrary.descendants(this.folder) : assetLibrary.children(this.folder);

    this.entries = candidates.filter(entry => !entry.deletedAt && (entry.kind === 'folder' || entry.kind === this.options.kind) && entry.name.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()))
      .sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || a.name.localeCompare(b.name, undefined, { numeric: true }));
    this.view.setItems(this.entries.map(entry => ({ id: entry.id, name: entry.name, type: ASSET_PRESENTATION[entry.kind].label,
      icon: ASSET_PRESENTATION[entry.kind].icon, accent: ASSET_PRESENTATION[entry.kind].accent })));
    this.count.text = this.entries.length + (this.entries.length === 1 ? ' item' : ' items'); this.revision = assetLibrary.revision;
  }
  private folderMenu (folder: string, source: Control, position: math.Vector2): void {
    this.context.setActions([{ label: 'New Folder', icon: 'newFolder', enabled: !this.options.busy(), action: () => { void this.newFolder(folder); } }]);
    this.context.show(source, position);
  }
  private async newFolder (folder: string): Promise<void> {
    const id = await assetLibrary.newFolder(folder);

    if (id && this.visible) { this.navigate(folder); this.select(id); this.view.revealAsset(id, true); }
  }
  private refreshNavigation (): void { this.back.disabled = this.historyIndex <= 0; this.forward.disabled = this.historyIndex >= this.history.length - 1; }
  private key (event: InputEventKey): void {
    if (event.keycode === 'Enter') {
      const entry = assetLibrary.entry(this.selected ?? '');

      if (entry?.kind === 'folder') { this.navigate(entry.id); } else { this.confirm(); }
    } else if (event.keycode.startsWith('Arrow')) {
      const current = this.entries.findIndex(entry => entry.id === this.selected), direction = event.keycode === 'ArrowLeft' ? -1 : event.keycode === 'ArrowRight' ? 1 : event.keycode === 'ArrowUp' ? -this.view.columns : this.view.columns;
      const next = this.entries[Math.max(0, Math.min(this.entries.length - 1, Math.max(0, current) + direction))];

      if (next) { this.select(next.id); this.view.revealAsset(next.id); }
    } else { return; }
    event.accept();
  }
  override update (dt: number): void {
    if (this.visible) { this.refreshNavigation(); if (this.revision !== assetLibrary.revision) { this.refresh(); } }
    super.update(dt);
  }
  override close (): void { this.context.closeBranch(); super.close(); }
  override dispose (): void { this.context.dispose(); super.dispose(); }
}
