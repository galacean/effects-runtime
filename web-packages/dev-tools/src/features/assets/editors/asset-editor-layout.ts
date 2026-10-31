import { EditorSearchField } from '../../../ui/controls/search-field';
import type { Engine } from '@galacean/effects';
import type { Button, Control, LineEdit } from '@galacean/effects-plugin-gui';
import { Label, VBoxContainer, TextOverflow, VerticalAlignment, Container, MouseFilter, FocusMode, VSeparator } from '@galacean/effects-plugin-gui';
import { append, column, expand, margin, row, place } from '../../../ui/controls/layout';
import { EditorMenuButton } from '../../../ui/controls/menu';
import { EditorToolbar } from '../../../ui/controls/toolbar';
import { EditorPanelTab } from '../../../ui/controls/panel-tab';
import { EditorSplitContainer } from '../../../ui/controls/split-container';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import { PropertySheet, type PropertyEditContext } from '../../../ui/property-editor/property-sheet';
import { editorColors as C, editorBox, EDITOR_FONT, EDITOR_FONT_SIZE } from '../../../ui/theme/control-theme';
import { math } from '@galacean/effects';

class AssetPanelHeader extends Container {
  readonly tab: EditorPanelTab;
  constructor (engine: Engine, title: string, icon: 'camera' | 'details') {
    super(engine); this.mouseFilter = MouseFilter.Ignore;
    this.tab = append(this, new EditorPanelTab(engine, title, icon)); this.tab.focusMode = FocusMode.None; this.tab.mouseFilter = MouseFilter.Ignore;
    const background = editorBox(C.panel, 0, 4);

    background.setCornerRadii(4, 4, 0, 0); this.tab.setThemeStyleBoxOverride('normal', background);
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, 27); }
  override draw (): void { this.fillRect(0, 0, this.width, this.height, C.title); }
  protected override sortChildren (): void { place(this.tab, 0, 0, Math.min(this.width, this.tab.measureText(this.tab.text, EDITOR_FONT_SIZE, EDITOR_FONT).width + 37), 25); }
}

export interface AssetEditorActions {
  save?: () => void, revert?: () => void, browse?: () => void, reimport?: () => void, compile?: () => void,
  close?: () => void, dirty?: boolean, busy?: boolean,
}

export class AssetEditorLayout extends VBoxContainer {
  readonly inspector: PropertySheet;
  readonly viewport: VBoxContainer;
  readonly toolbar: Control;
  readonly search: LineEdit;
  readonly footer: Label;
  private readonly split: EditorSplitContainer;
  private readonly viewportHeader: AssetPanelHeader;
  private inspectorWidth = 340;
  private readonly actionButtons: { control: Button, key: 'save' | 'browse' | 'reimport' | 'compile' | 'revert' }[] = [];

  constructor (engine: Engine, private readonly actions: () => AssetEditorActions, edit: PropertyEditContext = { change: (_, __, action) => action(), finish: () => {} }) {
    super(engine); this.setThemeConstantOverride('separation', 0);
    const menus = append(this, row(engine)), file = append(menus, new EditorMenuButton(engine, 'File')), asset = append(menus, new EditorMenuButton(engine, 'Asset'));
    const windowMenu = append(menus, new EditorMenuButton(engine, 'Window'));

    file.menuBar = asset.menuBar = windowMenu.menuBar = true;
    file.actions = () => {
      const a = this.actions();

      return [{ label: 'Save', heading: true }, { label: 'Save', shortcut: 'Ctrl+S', enabled: !!a.save && !!a.dirty && !a.busy, action: a.save },
        { label: 'Revert', enabled: !!a.revert && !!a.dirty && !a.busy, action: a.revert }, { label: 'Close', enabled: !a.busy, action: a.close }];
    };
    asset.actions = () => {
      const a = this.actions();

      return [{ label: 'Find in Content Browser', enabled: !!a.browse, action: a.browse }, { label: 'Reimport', enabled: !!a.reimport && !a.busy, action: a.reimport },
        { label: 'Compile', enabled: !!a.compile && !a.busy, action: a.compile }];
    };
    windowMenu.actions = () => [{ label: 'Layout', heading: true }, { label: 'Reset Layout', action: () => { this.inspectorWidth = 340; this.resizeInspector(); this.search.text = ''; this.inspector.filter(''); } }];
    this.toolbar = new EditorToolbar(engine, 32); this.toolbar.setThemeConstantOverride('separation', 6);
    append(this, margin(engine, this.toolbar, 8, 5));
    for (const [key, icon, title] of [['save', 'save', 'Save'], ['browse', 'browseContent', 'Browse'], ['reimport', 'import', 'Reimport'], ['compile', 'check', 'Compile'], ['revert', 'reset', 'Revert']] as const) {
      const control = append(this.toolbar, new EditorIconButton(engine, icon, title));

      control.iconSize = 20; control.setCustomMinimumSize(0, 32); control.on('pressed', () => this.actions()[key]?.()); this.actionButtons.push({ control, key });
    }
    const viewportPanel = column(engine);

    this.viewportHeader = append(viewportPanel, new AssetPanelHeader(engine, 'Viewport', 'camera'));
    this.viewport = append(viewportPanel, expand(column(engine)));
    const inspectorPanel = column(engine);

    append(inspectorPanel, new AssetPanelHeader(engine, 'Inspector', 'details'));
    this.search = new EditorSearchField(engine); this.search.placeholderText = 'Search...';
    append(inspectorPanel, margin(engine, this.search, 8, 4));
    this.inspector = append(inspectorPanel, expand(new PropertySheet(engine, edit))); this.inspector.columnRatio = .46;
    this.search.on('textChanged', query => this.inspector.filter(query));
    this.split = append(this, expand(new EditorSplitContainer(engine, viewportPanel, inspectorPanel, false, .7)));
    this.split.on('sizeChanged', () => this.resizeInspector()); this.split.changed = ratio => { this.inspectorWidth = (this.split.width - 2) * (1 - ratio); };
    this.footer = new Label(engine); this.footer.textOverflow = TextOverflow.Ellipsis; this.footer.verticalAlignment = VerticalAlignment.Center; this.footer.setCustomMinimumSize(0, 24);
    append(this, margin(engine, this.footer, 8, 4));
  }
  set viewportTitle (value: string) { this.viewportHeader.tab.text = value; this.viewportHeader.queueSort(); }
  private resizeInspector (): void {
    const width = this.split.width, side = Math.max(Math.min(280, width * .4), Math.min(width - 220, this.inspectorWidth));

    this.split.ratio = 1 - side / Math.max(1, width - 2);
  }
  override update (dt: number): void {
    const actions = this.actions();

    for (const { control, key } of this.actionButtons) {
      control.visible = key === 'save' || key === 'browse' || !!actions[key];
      control.disabled = !actions[key] || !!actions.busy || (key === 'save' || key === 'revert') && !actions.dirty;
    }
    super.update(dt);
  }
}
