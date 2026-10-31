import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import { Container, VSeparator } from '@galacean/effects-plugin-gui';
import { selectionSnapConfig } from '@galacean/effects-plugin-editor-gizmo';
import type { EditorIconButton } from '../../../ui/icons/control-icons';
import { EditorToolbar, EditorViewportToggleButton } from '../../../ui/controls/toolbar';
import { EditorMenuButton, type MenuAction } from '../../../ui/controls/menu';
import { append, place } from '../../../ui/controls/layout';
import { editorColors } from '../../../ui/theme/control-theme';
import { setTooltip } from '../../../ui/controls/tooltip';
import { createItemActions } from '../ui/create-item-menu';
import type { SceneGizmo } from './scene-gizmo';

export interface SceneToolbarOptions {
  gizmo?: SceneGizmo,
  is2DMode: boolean,
  showGrid: boolean,
  showFPS: boolean,
  set2DMode(value: boolean): void,
  setShowGrid(value: boolean): void,
  setShowFPS(value: boolean): void,
  resetView(): void,
}

export class SceneToolbar extends EditorToolbar {
  private readonly add: EditorMenuButton;
  private readonly transform: EditorIconButton;
  private readonly hand: EditorIconButton;
  private readonly snap: EditorIconButton;
  private readonly distance: EditorMenuButton;
  private readonly camera: EditorMenuButton;
  private readonly zoom: EditorMenuButton;
  private readonly show: EditorMenuButton;
  private readonly more: EditorMenuButton;
  private readonly addSeparator: VSeparator;
  private readonly snapSeparator: VSeparator;

  constructor (engine: Engine, private readonly options: () => SceneToolbarOptions) {
    super(engine);
    this.add = this.menu('', () => createItemActions()); this.add.iconName = 'plus'; this.add.showArrow = true;
    this.addSeparator = append(this, new VSeparator(engine)); this.addSeparator.setCustomMinimumSize(1, 20);
    this.transform = append(this, new EditorViewportToggleButton(engine, 'transform', () => this.options().gizmo?.tool === 'transform', value => { if (value) { this.options().gizmo?.setTool('transform'); } }));
    this.hand = append(this, new EditorViewportToggleButton(engine, 'hand', () => this.options().gizmo?.tool === 'hand', value => { if (value) { this.options().gizmo?.setTool('hand'); } }));
    this.snap = append(this, new EditorViewportToggleButton(engine, 'magnet', () => !!this.options().gizmo?.snapping, value => {
      const gizmo = this.options().gizmo;

      if (gizmo) { gizmo.snapping = value; }
    }));
    this.snapSeparator = append(this, new VSeparator(engine)); this.snapSeparator.setCustomMinimumSize(1, 20);
    this.distance = this.menu('5 px', () => this.snapActions()); this.distance.showArrow = true;
    this.camera = this.menu('2D', () => this.cameraActions()); this.camera.iconName = 'camera'; this.camera.showArrow = true; this.camera.themeTypeVariation = 'EditorViewportMenu';
    this.zoom = this.menu('100%', () => this.zoomActions()); this.zoom.showArrow = true;
    this.show = this.menu('', () => this.showActions()); this.show.iconName = 'view'; this.show.showArrow = true; this.show.themeTypeVariation = 'EditorViewportMenu';
    this.more = this.menu('', () => this.moreActions()); this.more.iconName = 'more';
    setTooltip(this.add, 'Add an item to the scene'); setTooltip(this.transform, 'Transform (V / W)'); setTooltip(this.hand, 'Pan (H)');
    setTooltip(this.snap, 'Snapping'); setTooltip(this.camera, 'Camera views and framing'); setTooltip(this.zoom, 'Viewport zoom'); setTooltip(this.show, 'Show flags');
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(100, 34); }
  override update (dt: number): void {
    const o = this.options(), gizmo = o.gizmo, disabled = !gizmo || !o.is2DMode;

    this.transform.disabled = this.hand.disabled = this.snap.disabled = this.distance.disabled = this.zoom.disabled = disabled;
    this.camera.text = o.is2DMode ? '2D' : this.width > 600 ? 'Perspective' : '3D';
    this.distance.text = (gizmo?.handler.getConfigManager().get(selectionSnapConfig).distance ?? 5) + ' px';
    this.zoom.text = Math.round((gizmo?.scale ?? 1) * 100) + '%';
    super.update(dt);
  }
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, editorColors.toolbar);
    this.drawLine(0, this.height - 1, this.width, this.height - 1, editorColors.recessed);
  }
  protected override sortChildren (): void {
    const optional = [this.transform, this.snap, this.show, this.distance, this.zoom, this.hand];
    const base = this.add.getCombinedMinimumSize().x + this.camera.getCombinedMinimumSize().x + 44;
    let remaining = this.width - base;

    for (const control of optional) {
      const width = control.getCombinedMinimumSize().x + 4;

      control.visible = remaining >= width; if (control.visible) { remaining -= width; }
    }
    this.addSeparator.visible = true; this.snapSeparator.visible = this.snap.visible;
    let x = 4;

    for (const control of [this.add, this.addSeparator, this.transform, this.hand, this.more, this.snapSeparator, this.snap, this.distance]) {
      if (!control.visible) { continue; }
      if (control instanceof VSeparator) { place(control, x + 5, 7, 1, 20); x += 12; continue; }
      const width = Math.max(24, control.getCombinedMinimumSize().x);

      place(control, x, 3, width, 28); x += width + 2;
    }
    x = this.width - 4;
    for (const control of [this.show, this.zoom, this.camera]) {
      if (!control.visible) { continue; }
      const width = control.getCombinedMinimumSize().x;

      x -= width; place(control, x, 3, width, 28); x -= 2;
    }
  }
  private menu (text: string, actions: () => MenuAction[]): EditorMenuButton {
    const button = append(this, new EditorMenuButton(this.engine, text));

    button.actions = actions;
    button.themeTypeVariation = 'EditorViewportMenu';

    return button;
  }
  private snapActions (): MenuAction[] {
    const configs = this.options().gizmo?.handler.getConfigManager();

    return [2, 5, 10, 20].map(distance => ({ label: distance + ' px', checked: configs?.get(selectionSnapConfig).distance === distance,
      action: () => configs?.set(selectionSnapConfig, { distance }) }));
  }
  private zoomActions (): MenuAction[] {
    const gizmo = this.options().gizmo;

    return [.25, .5, 1, 2, 4, 8, 16].map(scale => ({ label: scale * 100 + '%', checked: Math.abs((gizmo?.scale ?? 1) - scale) < .001, action: () => gizmo?.zoomTo(scale) }));
  }
  private cameraActions (): MenuAction[] {
    const o = this.options();

    return [
      { label: '2D Canvas', checked: o.is2DMode, action: () => o.set2DMode(true) },
      { label: 'Perspective', checked: !o.is2DMode, action: () => o.set2DMode(false) },
      { label: '', separator: true },
      { label: 'Frame Selection', shortcut: 'F', enabled: o.is2DMode && !!o.gizmo?.selectedItems.length, action: () => o.gizmo?.frameSelection() },
      { label: 'Frame All', shortcut: 'Home', enabled: o.is2DMode && !!o.gizmo, action: () => o.gizmo?.frameAll() },
      { label: 'Reset View', action: o.resetView },
    ];
  }
  private showActions (): MenuAction[] {
    const o = this.options(), g = o.gizmo;

    return [
      { label: 'Grid', checked: o.showGrid, enabled: !!g && o.is2DMode, action: () => o.setShowGrid(!o.showGrid) },
      { label: 'Selection Info', checked: g?.selectionInfo, enabled: !!g, action: () => { if (g) { g.selectionInfo = !g.selectionInfo; } } },
      { label: 'Hover Highlight', checked: g?.hoverHighlight, enabled: !!g, action: () => { if (g) { g.hoverHighlight = !g.hoverHighlight; } } },
      { label: 'Show FPS', checked: o.showFPS, action: () => o.setShowFPS(!o.showFPS) },
    ];
  }
  private moreActions (): MenuAction[] {
    const o = this.options(), g = o.gizmo, editing = !!g && o.is2DMode;
    const actions: MenuAction[] = [];

    if (!this.transform.visible) { actions.push({ label: 'Transform', shortcut: 'V / W', enabled: editing, action: () => g?.setTool('transform') }); }
    if (!this.hand.visible) { actions.push({ label: 'Pan', shortcut: 'H', enabled: editing, action: () => g?.setTool('hand') }); }
    actions.push({ label: 'Edit Text', shortcut: 'Enter', enabled: editing && g?.canEditText, action: () => g?.editText() });
    if (!this.snap.visible) { actions.push({ label: 'Snapping', checked: g?.snapping, enabled: editing, action: () => { if (g) { g.snapping = !g.snapping; } } }); }
    if (!this.distance.visible) { actions.push({ label: 'Snap Distance', enabled: editing, children: this.snapActions() }); }
    if (!this.zoom.visible) { actions.push({ label: 'Zoom', enabled: editing, children: this.zoomActions() }); }
    if (!this.show.visible) { actions.push({ label: 'Show', children: this.showActions() }); }
    actions.push({ label: 'Keyboard Shortcuts', children: [
      { label: 'Transform', shortcut: 'V / W', enabled: false }, { label: 'Pan', shortcut: 'H / Space + drag', enabled: false },
      { label: 'Frame Selection / All', shortcut: 'F / Home', enabled: false }, { label: 'Multi-select', shortcut: 'Shift + click', enabled: false },
      { label: 'Edit Text', shortcut: 'Enter / Double-click', enabled: false }, { label: 'Exit Editing', shortcut: 'Esc', enabled: false },
    ] });

    return actions;
  }
}
