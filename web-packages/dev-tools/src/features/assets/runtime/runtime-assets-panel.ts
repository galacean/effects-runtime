import { EditorSearchField } from '../../../ui/controls/search-field';
import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { HSlider, HorizontalAlignment, Label, LineEdit, VerticalAlignment } from '@galacean/effects-plugin-gui';
import type { ButtonDrawMode, ContentInsets } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem } from '../../../framework/registry/editor-registry';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { EditorWindow } from '../../../framework/windows/editor-window';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { AssetView } from '../../../ui/asset-view/asset-view';
import { append, column, expand, margin, place } from '../../../ui/controls/layout';
import { EditorSelectableRow } from '../../../ui/controls/selectable-row';
import { drawAssetIcon, type AssetIcon } from '../../../ui/icons/asset-icons';
import { editorColors, EDITOR_COMPACT_FONT_SIZE } from '../../../ui/theme/control-theme';
import { EditorSplitContainer } from '../../../ui/controls/split-container';
import { EditorToolbar } from '../../../ui/controls/toolbar';
import { ListSelection } from '../../../ui/list-view/list-selection';
import { openRuntimeAsset } from '../editors/asset-editor-registry';
import { RUNTIME_ASSET_CATEGORIES, RuntimeAssetSource, type RuntimeAssetCategory, type RuntimeAssetItem } from './runtime-asset-source';

class AssetCategoryRow extends EditorSelectableRow {
  readonly count: Label;
  constructor (engine: Engine, private readonly assetIcon: AssetIcon, title: string) {
    super(engine, 'folder', title); this.setCustomMinimumSize(0, 22);
    this.count = append(this, new Label(engine)); this.count.horizontalAlignment = HorizontalAlignment.Right; this.count.verticalAlignment = VerticalAlignment.Center;
    this.count.setThemeFontSizeOverride('fontSize', EDITOR_COMPACT_FONT_SIZE); this.count.setThemeColorOverride('fontColor', editorColors.muted);
    this.on('sizeChanged', () => place(this.count, this.width - 38, 0, 32, this.height));
  }
  protected override getContentInsets (): ContentInsets { return { left: 25, right: 42, top: 0, bottom: 0 }; }
  protected override drawDecoration (_mode: ButtonDrawMode): void { drawAssetIcon(this, this.assetIcon, 4, (this.height - 16) / 2, 16); }
  override update (dt: number): void { this.count.setThemeColorOverride('fontColor', this.selected ? editorColors.foregroundHover : editorColors.muted); super.update(dt); }
}

@editorPanel()
export class RuntimeAssetsPanel extends EditorWindow {
  private readonly source = new RuntimeAssetSource();
  private readonly selection = new ListSelection<string>();
  private category: RuntimeAssetCategory = 'All';
  private query = '';
  private scale = 96;
  private assetView!: AssetView;
  private status!: Label;
  private categories = new Map<RuntimeAssetCategory, AssetCategoryRow>();
  private items: RuntimeAssetItem[] = [];
  private visible: RuntimeAssetItem[] = [];
  private signature = '';

  constructor () { super(); this.title = 'Runtime Assets'; }
  @menuItem('Window/Runtime Assets')
  static showWindow (): void { EditorWindow.getWindow(RuntimeAssetsPanel).open(); }
  protected override createContent (engine: Engine): Control {
    const root = column(engine), search = new EditorSearchField(engine), sources = column(engine);

    search.placeholderText = 'Search assets'; search.on('textChanged', text => { this.query = text.toLowerCase(); this.refresh(); });
    append(root, margin(engine, search, 6));
    const icons: Record<RuntimeAssetCategory, AssetIcon> = { All: 'folder', Textures: 'texture', Materials: 'material', Shaders: 'shader', Geometries: 'geometry', AnimationClips: 'animationClip' };

    for (const category of RUNTIME_ASSET_CATEGORIES) {
      const button = append(sources, new AssetCategoryRow(engine, icons[category], category === 'AnimationClips' ? 'Animation Clips' : category));

      button.on('pressed', () => { this.category = category; this.refresh(); });
      this.categories.set(category, button);
    }
    this.assetView = new AssetView(engine, {
      selected: id => this.selection.selected.has(id),
      choose: (id, modifiers) => {
        this.selection.choose(id, this.visible.map(item => item.id), modifiers);
        EditorSelection.setObjects(this.items.filter(item => this.selection.selected.has(item.id)).map(item => item.object));
      },
      open: id => {
        const item = this.items.find(item => item.id === id);

        if (item) { openRuntimeAsset(item.object); }
      },
      context: () => {}, rename: () => {}, canDrop: () => false, drop: () => {},
      drag: id => {
        const object = this.items.find(item => item.id === id)?.object;

        return object && { type: object.constructor.name, data: object };
      },
      marquee: ids => { this.selection.replace(ids); EditorSelection.setObjects(this.items.filter(item => this.selection.selected.has(item.id)).map(item => item.object)); },
      key: event => {
        if ((event.ctrlPressed || event.metaPressed) && event.keycode.toLowerCase() === 'a') {
          this.selection.replace(this.visible.map(item => item.id)); EditorSelection.setObjects(this.visible.map(item => item.object)); event.accept();
        } else if (event.keycode.startsWith('Arrow') && this.visible.length) {
          const index = Math.max(0, this.visible.findIndex(item => item.id === this.selection.focused));
          const delta = event.keycode === 'ArrowLeft' ? -1 : event.keycode === 'ArrowRight' ? 1 : event.keycode === 'ArrowUp' ? -this.assetView.columns : this.assetView.columns;
          const item = this.visible[Math.max(0, Math.min(this.visible.length - 1, index + delta))];

          this.assetView.actions.choose(item.id, { additive: event.ctrlPressed || event.metaPressed, range: event.shiftPressed }); this.assetView.revealAsset(item.id); event.accept();
        } else if (event.keycode === 'Enter' && this.selection.focused) { this.assetView.actions.open(this.selection.focused); event.accept(); }
      },
    });
    append(root, expand(new EditorSplitContainer(engine, sources, this.assetView, false, .2)));
    const footer = new EditorToolbar(engine, 24);

    this.status = expand(footer.label(''), true, false);
    const slider = append(footer, new HSlider(engine));

    slider.minValue = 28; slider.maxValue = 192; slider.value = this.scale; slider.setCustomMinimumSize(160, 24);
    slider.on('valueChanged', value => { this.scale = value; this.assetView.configure(value <= 40 ? 'list' : 'tiles', value); });
    append(root, margin(engine, footer, 6, 2));

    return root;
  }
  override update (): void {
    if (!this.assetView) { return; }
    const items = this.source.items(EditorRuntimeSession.player.engine);
    const signature = items.map(item => item.id + item.name + item.summary).join('|');

    if (signature !== this.signature) { this.items = items; this.signature = signature; this.refresh(); }
    const objects = new Set(EditorSelection.getSelectedObjects());

    this.selection.replace(this.items.filter(item => objects.has(item.object)).map(item => item.id));
  }
  private refresh (): void {
    if (!this.assetView) { return; }
    this.visible = this.items.filter(item => (this.category === 'All' || this.category === item.category) && (item.name + ' ' + item.type).toLowerCase().includes(this.query));
    this.assetView.setItems(this.visible); this.assetView.configure(this.scale <= 40 ? 'list' : 'tiles', this.scale);
    this.status.text = this.visible.length + ' of ' + this.items.length + ' assets';
    for (const [category, button] of this.categories) {
      button.count.text = String(category === 'All' ? this.items.length : this.items.filter(item => item.category === category).length);
      button.selected = category === this.category;
    }
  }
}
