import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { FocusMode, HorizontalAlignment, MouseFilter } from '@galacean/effects-plugin-gui';
import type { Control, VBoxContainer } from '@galacean/effects-plugin-gui';
import { EditorDropTarget } from '../../../ui/controls/drag-feedback';
import { append, column, disposeChildren, place, screenPosition } from '../../../ui/controls/layout';
import { EditorMenuActionButton, EditorMenuButton, MenuHeading } from '../../../ui/controls/menu';
import { EditorPopupPanel } from '../../../ui/controls/popup-panel';
import { setTooltip } from '../../../ui/controls/tooltip';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import { AssetPicker } from './asset-picker';

export abstract class AssetReferenceFieldBase extends EditorDropTarget {
  protected readonly caption: EditorMenuButton;
  protected readonly useSelected: EditorIconButton;
  protected readonly browse: EditorIconButton;
  protected readonly picker: EditorPopupPanel;
  protected readonly browser: AssetPicker;
  private readonly actions: VBoxContainer;
  private readonly browseHeading: MenuHeading;
  private preview?: Control;
  private compact = false;

  constructor (engine: Engine) {
    super(engine);
    this.caption = append(this, new EditorMenuButton(engine, ''));
    this.caption.mouseFilter = MouseFilter.Pass; this.caption.themeTypeVariation = 'EditorComboButton';
    this.caption.textAlignment = HorizontalAlignment.Left; this.caption.clipText = true; this.caption.showArrow = true;
    this.caption.openMenu = () => this.showPicker();
    this.useSelected = append(this, new EditorIconButton(engine, 'useSelected'));
    this.browse = append(this, new EditorIconButton(engine, 'browseContent'));
    this.useSelected.mouseFilter = this.browse.mouseFilter = MouseFilter.Pass;
    this.useSelected.themeTypeVariation = this.browse.themeTypeVariation = 'EditorSimpleButton';
    this.useSelected.focusMode = this.browse.focusMode = FocusMode.None;
    this.useSelected.on('pressed', () => this.useCurrentSelection()); this.browse.on('pressed', () => this.browseCurrent());
    setTooltip(this.useSelected, 'Use selected asset from Content Browser'); setTooltip(this.browse, 'Browse to asset in Content Browser');
    this.picker = new EditorPopupPanel(engine); this.picker.themeTypeVariation = 'EditorMenu'; this.picker.setSize(300, 0);
    const body = append(this.picker, column(engine));

    this.actions = append(body, column(engine)); this.browseHeading = append(body, new MenuHeading(engine, 'Browse'));
    this.browser = append(body, new AssetPicker(engine, id => { this.chooseAsset(id); this.picker.hidePopup(); }));
    this.picker.onPopup('popupOpened', () => this.caption.setPressedNoSignal(true));
    this.picker.onPopup('popupClosed', () => this.caption.setPressedNoSignal(false));
  }
  protected setPreview (preview: Control): void {
    this.preview = preview; preview.mouseFilter = MouseFilter.Pass; append(this, preview); this.queueSort();
  }
  protected useCompactPresentation (): void {
    this.compact = true;
    if (this.preview) { this.preview.visible = false; }
    this.useSelected.visible = this.browse.visible = false;
    this.updateMinimumSize(); this.queueSort();
  }
  protected get canBrowse (): boolean { return true; }
  protected abstract chooseAsset (id: string): void;
  protected abstract refreshCandidates (): void;
  protected abstract useCurrentSelection (): void;
  protected abstract browseCurrent (): void;
  private showPicker (): void {
    disposeChildren(this.actions); append(this.actions, new MenuHeading(this.engine, 'Current Asset'));
    for (const action of this.caption.actions()) {
      append(this.actions, new EditorMenuActionButton(this.engine, { ...action, action: () => { this.picker.hidePopup(); action.action?.(); } }));
    }
    this.browseHeading.visible = this.browser.visible = this.canBrowse;
    this.browser.search.text = ''; this.refreshCandidates();
    const position = screenPosition(this, 0, this.height);

    this.picker.popup(position, this.caption);
    if (this.picker.y < position.y) { this.picker.setPosition(this.picker.x, Math.max(0, screenPosition(this).y - this.picker.height)); }
    if (this.canBrowse) { this.browser.search.grabFocus(); }
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(80, this.compact ? 22 : this.preview?.visible ? 54 : this.useSelected?.visible || this.browse?.visible ? 49 : 24); }
  protected override sortChildren (): void {
    const left = this.preview?.visible ? 60 : 0;

    if (this.preview?.visible) { place(this.preview, 0, 0, 54, 54); }
    place(this.caption, left, 0, Math.max(0, this.width - left), this.compact ? this.height : 24);
    place(this.useSelected, left, 27, 22, 22); place(this.browse, left + 26, 27, 22, 22);
  }
  override onDestroy (): void { this.picker.dispose(); super.onDestroy(); }
}
