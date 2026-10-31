import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { Control, Label, LineEdit, TextEdit } from '@galacean/effects-plugin-gui';
import type { ContentInsets } from '@galacean/effects-plugin-gui';
import { Button, ButtonDrawMode, HorizontalAlignment, PanelContainer, TextOverflow } from '@galacean/effects-plugin-gui';
import { EditorDialog } from '../../../ui/controls/dialog';
import { EditorSearchField } from '../../../ui/controls/search-field';
import { EditorTextArea, EditorTextField } from '../../../ui/controls/text-field';
import { append, column, expand, label, row } from '../../../ui/controls/layout';
import { EditorMenu, EditorMenuButton } from '../../../ui/controls/menu';
import { EditorCheckbox } from '../../../ui/controls/checkbox';
import { EditorIconButton, paintIcon } from '../../../ui/icons/control-icons';
import { setTooltip } from '../../../ui/controls/tooltip';
import { PropertySheet } from '../../../ui/property-editor/property-sheet';
import { editorBox, editorColors, EDITOR_FONT } from '../../../ui/theme/control-theme';
import { assetLibrary } from '../../assets/asset-library';
import { projectWorkspace as projects } from '../project-workspace';
import { ProjectTileView } from './project-tile-view';

type BrowserMode = 'open' | 'recent' | 'new';

class ProjectCategory extends Button {
  constructor (engine: Engine, text: string, private readonly active: () => boolean) {
    super(engine, text); this.textAlignment = HorizontalAlignment.Left;
    this.setThemeFontOverride('font', { family: EDITOR_FONT, weight: 'bold', style: 'normal' }); this.setThemeFontSizeOverride('fontSize', 20);
    for (const [state, border] of Object.entries({ normal: editorColors.clear, hover: editorColors.hover, pressed: editorColors.primary, hoverPressed: editorColors.primaryHover })) {
      this.setThemeStyleBoxOverride(state, editorBox(editorColors.recessed, 0, 4, border));
    }
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, 104); }
  protected override getContentInsets (): ContentInsets { return { left: 18, top: 68, right: 18, bottom: 8 }; }
  protected override drawDecoration (_mode: ButtonDrawMode): void { paintIcon(this, 'project', this.width - 80, 12, 64, editorColors.muted); }
  override getDrawMode (): ButtonDrawMode {
    if (this.disabled || !this.enabledInHierarchy) { return ButtonDrawMode.Disabled; }
    const hovered = this.isHovered() || this.isPressing();

    return this.active() ? hovered ? ButtonDrawMode.HoverPressed : ButtonDrawMode.Pressed : hovered ? ButtonDrawMode.Hover : ButtonDrawMode.Normal;
  }
  override update (dt: number): void { this.setPressedNoSignal(this.active()); super.update(dt); }
}

export class ProjectBrowserDialog {
  private engine!: Engine;
  private source!: Control;
  private browser!: EditorDialog;
  private settings!: EditorDialog;
  private confirm!: EditorDialog;
  private context!: EditorMenu;
  private mode: BrowserMode = 'open';
  private selected?: string;
  private query = '';
  private showDeleted = false;
  private cards?: ProjectTileView;
  private name?: LineEdit;
  private description?: TextEdit;
  private error?: Label;
  private revision = -1;
  private settingsError?: Label;
  private selectionText?: Label;
  private sort: 'recent' | 'name' = 'recent';
  private validation = '';
  get displaysErrors (): boolean { return !!this.browser?.visible || !!this.settings?.visible; }

  initialize (engine: Engine, source: Control): void {
    this.engine = engine; this.source = source; this.browser = new EditorDialog(engine); this.settings = new EditorDialog(engine); this.confirm = new EditorDialog(engine); this.context = new EditorMenu(engine);
  }
  show (mode: BrowserMode = 'open'): void {
    this.mode = mode; this.selected = projects.current?.id; this.query = ''; this.showDeleted = false; this.validation = ''; projects.error = '';
    this.buildBrowser(); void projects.refresh();
  }
  private buildBrowser (): void {
    this.cards = undefined; this.name = undefined; this.description = undefined;
    this.browser.show(this.source, 'Project Browser', body => {
      const sources = column(this.engine, [], 8), main = column(this.engine, [], 8);

      for (const [mode, title] of [['open', 'My Projects'], ['recent', 'Recent Projects'], ['new', 'New Project']] as const) {
        const button = append(sources, new ProjectCategory(this.engine, title, () => mode === this.mode));

        button.on('pressed', () => { this.mode = mode; this.showDeleted = false; this.validation = ''; this.buildBrowser(); });
      }
      this.error = append(main, label(this.engine, projects.error, editorColors.error)); this.error.visible = !!projects.error;
      if (this.mode === 'new') {
        const heading = append(main, label(this.engine, 'Blank Project'));

        heading.setThemeFontOverride('font', { family: EDITOR_FONT, weight: 'bold', style: 'normal' }); heading.setThemeFontSizeOverride('fontSize', 20);
        append(main, label(this.engine, 'Start with an empty scene.'));
        append(main, label(this.engine, 'Project Name')); this.name = append(main, new EditorTextField(this.engine)); this.name.on('textSubmitted', () => this.create()); this.name.on('textChanged', () => this.validation = '');
        append(main, label(this.engine, 'Description')); this.description = append(main, new EditorTextArea(this.engine)); this.description.setCustomMinimumSize(0, 100);
      } else {
        const header = append(main, row(this.engine, [], 5));
        const search = append(header, expand(new EditorSearchField(this.engine), true, false));
        const sort = append(header, new EditorMenuButton(this.engine, ''));
        const refresh = append(header, new EditorIconButton(this.engine, 'refresh'));

        sort.iconName = 'sort'; sort.actions = () => [{ label: 'Most Recently Used', checked: this.sort === 'recent', action: () => { this.sort = 'recent'; this.refreshCards(); } },
          { label: 'Alphabetical', checked: this.sort === 'name', action: () => { this.sort = 'name'; this.refreshCards(); } }];
        refresh.on('pressed', () => { void projects.refresh(); }); setTooltip(sort, 'Sort projects'); setTooltip(refresh, 'Refresh project list');
        search.placeholderText = 'Search projects'; search.text = this.query; search.on('textChanged', value => { this.query = value; this.refreshCards(); });
        this.cards = append(main, expand(new ProjectTileView(this.engine, {
          selected: id => id === this.selected, choose: id => this.selected = id, open: id => { this.selected = id; this.openSelected(); },
          context: (id, position) => {
            const project = projects.projects.find(project => project.id === id);

            if (!project) { return; }
            this.context.setActions([{ label: project.deletedAt ? 'Restore' : 'Delete', enabled: project.id !== projects.current?.id,
              action: () => {
                if (project.deletedAt) { void projects.trash(project.id, true); } else {
                  this.confirm.show(this.browser, 'Delete Project', body => this.confirm.message(body, 'Move "' + project.name + '" to Trash?'), [
                    { label: 'Delete', action: () => { this.confirm.close(); void projects.trash(project.id); } }, { label: 'Cancel', action: () => this.confirm.close() },
                  ]);
                }
              } }]); this.context.show(this.cards!, position);
          },
          key: event => {
            if (event.keycode === 'Enter') { this.openSelected(); event.accept(); } else if (event.keycode.startsWith('Arrow')) {
              const entries = this.entries(), index = Math.max(0, entries.findIndex(project => project.id === this.selected));
              const delta = event.keycode === 'ArrowLeft' ? -1 : event.keycode === 'ArrowRight' ? 1 : event.keycode === 'ArrowUp' ? -this.cards!.columns : this.cards!.columns;
              const project = entries[Math.max(0, Math.min(entries.length - 1, index + delta))];

              if (project) { this.selected = project.id; this.cards!.revealProject(project.id); } event.accept();
            }
          },
        })));
        this.refreshCards();
        const deleted = append(main, new EditorCheckbox(this.engine, 'Show deleted projects'));

        deleted.setPressedNoSignal(this.showDeleted); deleted.on('toggled', value => { this.showDeleted = value; this.refreshCards(); });
      }
      const content = append(body, row(this.engine, [], 16));
      const sidebar = append(content, new PanelContainer(this.engine));

      sidebar.setThemeStyleBoxOverride('panel', editorBox(editorColors.panel)); sidebar.setCustomMinimumSize(304, 0); append(sidebar, sources);
      append(content, expand(main)); content.setCustomMinimumSize(0, Math.min(400, Math.max(240, (this.source.root?.height ?? window.innerHeight) - 240)));
      this.selectionText = append(this.browser.beforeButtons, label(this.engine, '')); this.selectionText.textOverflow = TextOverflow.Ellipsis;
    }, [
      { label: 'Import…', action: () => { this.browser.close(); projects.chooseImport(); } },
      { label: this.mode === 'new' ? 'Create Project' : 'Open', primary: true, enabled: () => !projects.busy && (this.mode === 'new' ? !!this.name?.text.trim() : !!this.selected && !this.showDeleted), action: () => this.mode === 'new' ? this.create() : this.openSelected() },
      { label: 'Cancel', action: () => this.browser.close() },
    ], Math.min(1120, (this.source.root?.width ?? window.innerWidth) - 24));
    (this.name as LineEdit | undefined)?.grabFocus();
  }
  private entries () {
    return (this.mode === 'recent' && !this.showDeleted ? projects.recent : projects.projects)
      .filter(project => !!project.deletedAt === this.showDeleted && (project.name + ' ' + project.description).toLowerCase().includes(this.query.toLowerCase()))
      .sort((a, b) => this.sort === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true }) : b.lastOpenedAt - a.lastOpenedAt);
  }
  private refreshCards (): void {
    const entries = this.entries();

    if (this.selected && !entries.some(entry => entry.id === this.selected)) { this.selected = undefined; }
    this.cards?.setItems(entries);
    this.revision = projects.revision;
  }
  private openSelected (): void {
    if (!this.selected || this.showDeleted || projects.busy) { return; }
    const id = this.selected;

    this.browser.close(); void projects.open(id);
  }
  private create (): void {
    const name = this.name?.text.trim() ?? '';

    if (!name || projects.projects.some(project => !project.deletedAt && project.name.toLowerCase() === name.toLowerCase())) {
      this.validation = 'Enter a unique project name.';

      return;
    }
    this.browser.close(); void projects.create(name, this.description?.text ?? '');
  }
  showSettings (): void {
    const current = projects.current;

    if (!current) { return; }
    const draft = { name: current.name, description: current.description, startupSceneId: current.startupSceneId };

    this.settings.show(this.source, 'Project Settings', body => {
      const sheet = append(body, new PropertySheet(this.engine, { change: (_, __, action) => action(), finish: () => {} }));

      sheet.setCustomMinimumSize(580, 300);
      const general = sheet.section('general', 'General');

      general.text('Project Name', { read: () => draft.name, write: value => draft.name = value });
      general.text('Description', { read: () => draft.description, write: value => draft.description = value }, true);
      const scenes = assetLibrary.entries.filter(entry => entry.kind === 'scene' && !entry.deletedAt);

      general.choice('Startup Scene', { read: () => scenes.findIndex(scene => scene.id === draft.startupSceneId) + 1,
        write: value => draft.startupSceneId = scenes[value - 1]?.id }, ['Last Opened Scene', ...scenes.map(scene => scene.name)]);
      const storage = sheet.section('storage', 'Storage');

      storage.readOnly('Project ID', () => current.id); storage.readOnly('Location', () => 'Browser local storage');
      this.settingsError = append(body, label(this.engine, '', editorColors.error));
    }, [
      { label: 'Save', primary: true, enabled: () => !projects.busy && !!draft.name.trim(), action: () => { void projects.settings(draft).then(() => { if (!projects.error) { this.settings.close(); } }); } },
      { label: 'Cancel', action: () => this.settings.close() },
    ], 620);
  }
  update (): void {
    if (this.cards && this.revision !== projects.revision) { this.refreshCards(); }
    if (this.error) { this.error.text = this.validation || projects.error; this.error.visible = !!this.error.text; }
    if (this.settingsError) { this.settingsError.text = projects.error; this.settingsError.visible = !!projects.error; }
    if (this.selectionText) {
      const project = projects.projects.find(project => project.id === this.selected);

      this.selectionText.text = this.mode === 'new' ? 'Blank Project' : project?.name ?? 'Select a project';
    }
  }
  dispose (): void { this.browser?.dispose(); this.settings?.dispose(); this.confirm?.dispose(); this.context?.dispose(); }
}
export const projectBrowser = new ProjectBrowserDialog();
