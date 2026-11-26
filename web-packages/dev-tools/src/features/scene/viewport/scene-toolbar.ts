import type { Engine } from '@galacean/effects';
import { math } from '@galacean/effects';
import type { ContentInsets, Control } from '@galacean/effects-plugin-gui';
import { ButtonDrawMode, HBoxContainer, VSeparator } from '@galacean/effects-plugin-gui';
import { rulerConfig, selectionSnapConfig } from '@galacean/effects-plugin-editor-gizmo';
import type { ShapePrimitive } from '@galacean/effects-plugin-editor-gizmo';
import type { EditorIcon } from '../../../ui/icons/control-icons';
import { paintIcon } from '../../../ui/icons/control-icons';
import { EditorToolbar, EditorViewportToggleButton } from '../../../ui/controls/toolbar';
import { EditorMenuButton, type MenuAction } from '../../../ui/controls/menu';
import { append, place } from '../../../ui/controls/layout';
import { editorColors } from '../../../ui/theme/control-theme';
import { setTooltip } from '../../../ui/controls/tooltip';
import { createItemActions } from '../ui/create-item-menu';
import type { SceneGizmo } from './scene-gizmo';
import { SCENE_DRAWING_TOOLS, SCENE_SHAPE_TOOLS, SCENE_TOOLS } from './scene-tools';
import type { SceneTool } from './scene-tools';

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

/** The arrow chooses a shape; the adjacent button repeats the last shape tool. */
class ShapeMenuButton extends EditorMenuButton {
  override getMinimumSize (): math.Vector2 { return new math.Vector2(16, 28); }
  protected override getContentInsets (): ContentInsets { return { left: 0, right: 0, top: 0, bottom: 0 }; }
  protected override drawDecoration (mode: ButtonDrawMode): void {
    const tint = mode === ButtonDrawMode.Disabled ? editorColors.disabled : mode === ButtonDrawMode.Normal ? editorColors.muted : editorColors.foregroundHover;

    paintIcon(this, 'chevronDown', (this.width - 10) / 2, (this.height - 10) / 2, 10, tint);
  }
}

class SceneShapeToolButton extends HBoxContainer {
  readonly primary: EditorViewportToggleButton;
  readonly dropdown: EditorMenuButton;
  shape: ShapePrimitive = 'rect';

  constructor (engine: Engine, options: () => SceneToolbarOptions, actions: () => MenuAction[]) {
    super(engine);
    this.primary = append(this, new EditorViewportToggleButton(engine, SCENE_TOOLS.rect.icon,
      () => SCENE_SHAPE_TOOLS.includes(options().gizmo?.tool as ShapePrimitive),
      value => { if (value) { options().gizmo?.setTool(this.shape); } }));
    this.dropdown = append(this, new ShapeMenuButton(engine, '', actions));
    this.dropdown.themeTypeVariation = 'EditorViewportMenu';
    setTooltip(this.primary, () => {
      const tool = SCENE_TOOLS[this.shape];

      return tool.label + (tool.shortcut ? ` (${tool.shortcut})` : '');
    });
    setTooltip(this.dropdown, 'Shape tools');
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(42, 28); }
  protected override sortChildren (): void {
    place(this.primary, 0, 0, 26, 28); place(this.dropdown, 26, 0, 16, 28);
  }
}

type ToolbarGroup = { controls: Control[], separator: VSeparator };

export class SceneToolbar extends EditorToolbar {
  private readonly add: EditorMenuButton;
  private readonly tools = new Map<SceneTool, EditorViewportToggleButton>();
  private readonly shapes: SceneShapeToolButton;
  private readonly snap: EditorViewportToggleButton;
  private readonly distance: EditorMenuButton;
  private readonly camera: EditorMenuButton;
  private readonly zoom: EditorMenuButton;
  private readonly show: EditorMenuButton;
  private readonly more: EditorMenuButton;
  private readonly groups: ToolbarGroup[];
  private layoutState = '';

  constructor (engine: Engine, private readonly options: () => SceneToolbarOptions) {
    super(engine);
    this.add = this.menu('', 'plus', () => createItemActions());
    const move = this.tool('transform'), hand = this.tool('hand'), pen = this.tool('pen'), brush = this.tool('brush');

    this.shapes = append(this, new SceneShapeToolButton(engine, options, () => this.shapeActions()));
    const text = this.tool('text'), frame = this.tool('frame');

    this.snap = append(this, new EditorViewportToggleButton(engine, 'magnet', () => !!this.options().gizmo?.snapping, value => {
      const gizmo = this.options().gizmo;

      if (gizmo) { gizmo.snapping = value; }
    }));
    this.distance = this.menu('5 px', undefined, () => this.snapActions());
    this.camera = this.menu('2D', 'camera', () => this.cameraActions());
    this.zoom = this.menu('100%', undefined, () => this.zoomActions());
    this.show = this.menu('', 'view', () => this.showActions());
    this.more = this.menu('', 'more', () => this.moreActions()); this.more.showArrow = false;
    this.groups = [[this.add], [move, hand], [pen, brush], [this.shapes, text, frame], [this.snap, this.distance]].map(controls => ({
      controls, separator: append(this, new VSeparator(engine)),
    }));
    setTooltip(this.add, 'Add scene item');
    setTooltip(this.snap, 'Snap to items and guides'); setTooltip(this.distance, 'Snap distance');
    setTooltip(this.camera, 'Camera and framing'); setTooltip(this.zoom, 'Canvas zoom');
    setTooltip(this.show, 'View options'); setTooltip(this.more, 'More tools and shortcuts');
  }

  override getMinimumSize (): math.Vector2 { return new math.Vector2(150, 34); }

  override update (dt: number): void {
    const o = this.options(), gizmo = o.gizmo, disabled = !gizmo || !o.is2DMode;

    this.tools.forEach(button => { button.disabled = disabled; });
    this.shapes.primary.disabled = this.shapes.dropdown.disabled = this.snap.disabled = this.distance.disabled = this.zoom.disabled = disabled;
    if (gizmo && SCENE_SHAPE_TOOLS.includes(gizmo.tool as ShapePrimitive)) { this.shapes.shape = gizmo.tool as ShapePrimitive; }
    this.shapes.primary.iconName = SCENE_TOOLS[this.shapes.shape].icon;
    this.camera.text = o.is2DMode ? '2D' : this.width > 600 ? 'Perspective' : '3D';
    this.distance.text = (gizmo?.handler.getConfigManager().get(selectionSnapConfig).distance ?? 5) + ' px';
    this.zoom.text = Math.round((gizmo?.scale ?? 1) * 100) + '%';
    const state = gizmo?.tool ?? '';

    if (state !== this.layoutState) { this.layoutState = state; this.queueSort(); }
    super.update(dt);
  }

  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, editorColors.toolbar);
    this.drawLine(0, this.height - 1, this.width, this.height - 1, editorColors.recessed);
  }

  protected override sortChildren (): void {
    const tool = this.options().gizmo?.tool;
    const active = tool && (SCENE_SHAPE_TOOLS.includes(tool as ShapePrimitive) ? this.shapes : this.tools.get(tool));
    const right = [this.camera, this.zoom, this.show, this.more];
    const controls = [...this.groups.flatMap(group => group.controls), ...right];
    const visible = new Set(controls);

    const groupWidth = (items: Control[]): number => items.filter(control => visible.has(control)).reduce((width, control) => width + this.controlWidth(control) + 2, -2);
    const totalWidth = (): number => {
      const left = this.groups.map(group => groupWidth(group.controls)).filter(width => width >= 0);

      return left.reduce((sum, width) => sum + width, 0) + Math.max(0, left.length - 1) * 12 + Math.max(0, groupWidth(right)) + 16;
    };
    // Collapse secondary actions first. Keep the active tool available at smaller widths.
    const collapse = [this.distance, this.zoom, this.snap, this.tools.get('frame')!, this.tools.get('text')!,
      this.tools.get('brush')!, this.tools.get('pen')!, this.shapes, this.tools.get('hand')!, this.add, this.show];

    for (const control of [...collapse.filter(control => control !== active), ...(active ? [active] : [])]) {
      if (totalWidth() <= this.width) { break; }
      visible.delete(control);
    }
    controls.forEach(control => { control.visible = visible.has(control); });
    this.groups.forEach(group => { group.separator.visible = false; });
    let x = 4, hasPreviousGroup = false;

    for (const group of this.groups) {
      const items = group.controls.filter(control => control.visible);

      if (!items.length) { continue; }
      if (hasPreviousGroup) { group.separator.visible = true; place(group.separator, x + 4, 8, 1, 18); x += 12; }
      for (const control of items) {
        const width = this.controlWidth(control);

        place(control, x, 3, width, 28); x += width + 2;
      }
      x -= 2; hasPreviousGroup = true;
    }
    x = this.width - 4;
    for (const control of right.slice().reverse()) {
      if (!control.visible) { continue; }
      const width = this.controlWidth(control);

      x -= width; place(control, x, 3, width, 28); x -= 2;
    }
  }

  private controlWidth (control: Control): number { return Math.max(26, control.getCombinedMinimumSize().x); }

  private tool (tool: SceneTool): EditorViewportToggleButton {
    const entry = SCENE_TOOLS[tool];
    const button = append(this, new EditorViewportToggleButton(this.engine, entry.icon, () => this.options().gizmo?.tool === tool,
      value => { if (value) { this.options().gizmo?.setTool(tool); } }));

    this.tools.set(tool, button);
    setTooltip(button, entry.label + (entry.shortcut ? ` (${entry.shortcut})` : ''));

    return button;
  }

  private menu (text: string, icon: EditorIcon | undefined, actions: () => MenuAction[]): EditorMenuButton {
    const button = append(this, new EditorMenuButton(this.engine, text, actions));

    button.iconName = icon; button.showArrow = true; button.themeTypeVariation = 'EditorViewportMenu';

    return button;
  }

  private toolAction (tool: SceneTool): MenuAction {
    const o = this.options();

    return { ...SCENE_TOOLS[tool], enabled: !!o.gizmo && o.is2DMode, checked: o.gizmo?.tool === tool, action: () => o.gizmo?.setTool(tool) };
  }

  private shapeActions (): MenuAction[] {
    return [{ label: 'Shapes', heading: true }, ...SCENE_SHAPE_TOOLS.map(tool => this.toolAction(tool))];
  }

  private snapActions (): MenuAction[] {
    const configs = this.options().gizmo?.handler.getConfigManager();

    return [{ label: 'Snap distance', heading: true }, ...[2, 5, 10, 20].map(distance => ({ label: distance + ' px', checked: configs?.get(selectionSnapConfig).distance === distance,
      action: () => configs?.set(selectionSnapConfig, { distance }) }))];
  }

  private zoomActions (): MenuAction[] {
    const gizmo = this.options().gizmo;

    return [.25, .5, 1, 2, 4, 8, 16].map(scale => ({ label: scale * 100 + '%', checked: Math.abs((gizmo?.scale ?? 1) - scale) < .001, action: () => gizmo?.zoomTo(scale) }));
  }

  private cameraActions (): MenuAction[] {
    const o = this.options();

    return [
      { label: 'Camera', heading: true },
      { label: '2D Canvas', icon: 'scene', checked: o.is2DMode, action: () => o.set2DMode(true) },
      { label: 'Perspective', icon: 'cube', checked: !o.is2DMode, action: () => o.set2DMode(false) },
      { label: 'Framing', heading: true },
      { label: 'Frame Selection', icon: 'viewportSelection', shortcut: 'F', enabled: o.is2DMode && !!o.gizmo?.selectedItems.length, action: () => o.gizmo?.frameSelection() },
      { label: 'Frame All', icon: 'viewportBounds', shortcut: 'Home', enabled: o.is2DMode && !!o.gizmo, action: () => o.gizmo?.frameAll() },
      { label: 'Reset View', icon: 'reset', action: o.resetView },
    ];
  }

  private showActions (): MenuAction[] {
    const o = this.options(), g = o.gizmo, canvas = !!g && o.is2DMode;
    const rulerEnabled = g?.handler.getConfigManager().get(rulerConfig).enabled;

    return [
      { label: 'Canvas', heading: true },
      { label: 'Grid', icon: 'viewportGrid', checked: o.showGrid, enabled: canvas, action: () => o.setShowGrid(!o.showGrid) },
      { label: 'Rulers', icon: 'viewportRuler', checked: rulerEnabled, enabled: canvas, action: () => {
        if (g) { g.handler.getConfigManager().set(rulerConfig, { enabled: !rulerEnabled }); }
      } },
      { label: 'Selection', heading: true },
      { label: 'Selection Info', icon: 'viewportSelection', checked: g?.selectionInfo, enabled: !!g, action: () => { if (g) { g.selectionInfo = !g.selectionInfo; } } },
      { label: 'Hover Highlight', icon: 'viewportHover', checked: g?.hoverHighlight, enabled: !!g, action: () => { if (g) { g.hoverHighlight = !g.hoverHighlight; } } },
      { label: 'Performance', heading: true },
      { label: 'Show FPS', icon: 'viewportFPS', checked: o.showFPS, action: () => o.setShowFPS(!o.showFPS) },
    ];
  }

  private moreActions (): MenuAction[] {
    const o = this.options(), g = o.gizmo, enabled = !!g && o.is2DMode;
    const actions: MenuAction[] = [];
    const section = (label: string, entries: MenuAction[]): void => { if (entries.length) { actions.push({ label, heading: true }, ...entries); } };

    if (!this.add.visible) { section('Scene', [{ label: 'Add Item', icon: 'plus', children: () => createItemActions() }]); }
    section('Tools', (['transform', 'hand', 'pen', 'brush'] as SceneTool[]).filter(tool => !this.tools.get(tool)?.visible).map(tool => this.toolAction(tool)));
    const content: MenuAction[] = [];

    if (!this.shapes.visible) { content.push({ label: 'Shapes', icon: SCENE_TOOLS[this.shapes.shape].icon, children: () => this.shapeActions() }); }
    for (const tool of ['text', 'frame'] as SceneTool[]) { if (!this.tools.get(tool)?.visible) { content.push(this.toolAction(tool)); } }
    section('Create', content);
    const view: MenuAction[] = [];

    if (!this.snap.visible) { view.push({ label: 'Snapping', icon: 'magnet', checked: g?.snapping, enabled, action: () => { if (g) { g.snapping = !g.snapping; } } }); }
    if (!this.distance.visible) { view.push({ label: 'Snap Distance', icon: 'viewportRuler', enabled, children: () => this.snapActions() }); }
    if (!this.zoom.visible) { view.push({ label: 'Zoom', icon: 'viewportZoom', enabled, children: () => this.zoomActions() }); }
    if (!this.show.visible) { view.push({ label: 'View Options', icon: 'view', children: () => this.showActions() }); }
    section('View', view);
    if (actions.length) { actions.push({ label: '', separator: true }); }
    actions.push({ label: 'Keyboard Shortcuts', icon: 'viewportShortcuts', children: [
      ...(['transform', 'hand', 'brush'] as SceneTool[]).map(tool => ({ ...SCENE_TOOLS[tool], enabled: false })),
      ...SCENE_DRAWING_TOOLS.filter(entry => entry.shortcut).map(entry => ({ ...entry, enabled: false })),
      { label: 'Frame Selection / All', icon: 'viewportBounds', shortcut: 'F / Home', enabled: false },
      { label: 'Pan', icon: 'toolHand', shortcut: 'Space + drag', enabled: false },
      { label: 'Multi-select', icon: 'viewportSelection', shortcut: 'Shift + click', enabled: false },
      { label: 'Delete Selected Guide', icon: 'viewportRuler', shortcut: 'Delete / Backspace', enabled: false },
      { label: 'Edit Nodes / Text', icon: 'toolEditNodes', shortcut: 'Enter / Double-click', enabled: false },
      { label: 'Exit Editing', icon: 'toolFinish', shortcut: 'Esc', enabled: false },
    ] });

    return actions;
  }
}
