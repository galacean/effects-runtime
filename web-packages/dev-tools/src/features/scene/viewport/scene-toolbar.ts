import { editorTooltip } from '../../../ui/widgets/editor-tooltip';
import { selectionSnapConfig } from '@galacean/effects-plugin-editor-gizmo';
import { ImGui } from '../../../platform/imgui/index';
import { EditorColors } from '../../../ui/theme/index';
import { beginEditorMenu, beginEditorPopup, editorMenuItem, editorMenuSection, endEditorMenu, endEditorPopup } from '../../../ui/widgets/editor-menu';
import { toolbarButton, toolbarSeparator } from '../../../ui/widgets/toolbar-button';
import { drawCreateItemMenu } from '../ui/create-item-menu';
import type { SceneGizmo } from './scene-gizmo';

interface SceneToolbarOptions {
  gizmo?: SceneGizmo,
  is2DMode: boolean,
  showGrid: boolean,
  showFPS: boolean,
  set2DMode(value: boolean): void,
  setShowGrid(value: boolean): void,
  setShowFPS(value: boolean): void,
  resetView(): void,
}

interface ToolbarLayout {
  transform: boolean,
  hand: boolean,
  snap: boolean,
  distance: boolean,
  zoom: boolean,
  show: boolean,
  cameraLabel?: string,
}

type Icon = 'transform' | 'hand' | 'snap' | 'camera' | 'show' | 'more' | 'plus';

const ACTIVE_COLOR = new ImGui.Vec4(38 / 255, 187 / 255, 1, 1);

/** 控件与菜单继承编辑器字号；空间不足时只收纳当前隐藏的入口。 */
export class SceneToolbar {
  private buttonHeight = 28;

  draw (options: SceneToolbarOptions): void {
    const origin = ImGui.GetCursorScreenPos();
    const width = ImGui.GetContentRegionAvail().x;
    const gizmo = options.gizmo;
    const editing = !!gizmo && options.is2DMode;
    const distance = gizmo?.handler.getConfigManager().get(selectionSnapConfig).distance ?? 5;
    const distanceLabel = `${distance} px`;
    const zoomLabel = `${Math.round((gizmo?.scale ?? 1) * 100)}%`;

    this.buttonHeight = Math.ceil(ImGui.GetFontSize() + 8);
    const height = this.buttonHeight + 6;
    const distanceWidth = this.textButtonWidth(distanceLabel);
    const zoomWidth = this.textButtonWidth(zoomLabel);
    const menuWidth = this.buttonHeight + 14;
    const layout: ToolbarLayout = {
      transform: true,
      hand: true,
      snap: true,
      distance: true,
      zoom: true,
      show: true,
      cameraLabel: options.is2DMode ? '2D' : 'Perspective',
    };
    const cameraWidth = () => layout.cameraLabel ? this.textButtonWidth(layout.cameraLabel, true) : menuWidth;
    const leftWidth = () => 32 + menuWidth + (layout.transform ? this.buttonHeight + 2 : 0)
      + (layout.hand ? this.buttonHeight + 2 : 0) + (layout.snap ? this.buttonHeight + 12 : 0)
      + (layout.distance ? distanceWidth + 2 : 0);
    const rightWidth = () => cameraWidth() + (layout.zoom ? zoomWidth + 2 : 0) + (layout.show ? menuWidth + 2 : 0);
    const fits = () => leftWidth() + rightWidth() + 16 <= width;

    if (!fits()) { layout.hand = false; }
    if (!fits()) { layout.zoom = false; }
    if (!fits()) { layout.distance = false; }
    if (!fits()) { layout.cameraLabel = options.is2DMode ? '2D' : '3D'; }
    if (!fits()) { layout.show = false; }
    if (!fits()) { layout.cameraLabel = undefined; }
    if (!fits()) { layout.snap = false; }
    if (!fits()) { layout.transform = false; }

    const drawList = ImGui.GetWindowDrawList();

    drawList.AddRectFilled(origin, new ImGui.Vec2(origin.x + width, origin.y + height), ImGui.GetColorU32(EditorColors.titleBarBg));
    drawList.AddLine(new ImGui.Vec2(origin.x, origin.y + height - 1), new ImGui.Vec2(origin.x + width, origin.y + height - 1),
      ImGui.GetColorU32(EditorColors.border));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(6, 4));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(2, 0));
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 3);
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(12, 6));
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 4, origin.y + 3));

    this.menu('Add Item', 'plus', { width: menuWidth, arrow: true, hint: 'Add an item to the scene' }, () => drawCreateItemMenu());
    this.separator();
    ImGui.BeginDisabled(!editing);
    if (layout.transform) {
      if (this.button('Transform', 'transform', { active: gizmo?.tool === 'transform' })) { gizmo?.setTool('transform'); }
      this.tooltip('Transform (V / W)\nMove the selection; drag handles to resize or rotate.');
      ImGui.SameLine();
    }
    if (layout.hand) {
      if (this.button('Pan', 'hand', { active: gizmo?.tool === 'hand' })) { gizmo?.setTool('hand'); }
      this.tooltip('Pan (H)\nMiddle mouse or Space + drag.');
      ImGui.SameLine();
    }
    ImGui.EndDisabled();
    this.menu('More', 'more', { width: 20, hint: 'More tools and keyboard shortcuts' }, () => this.drawMoreMenu(options, layout));
    if (layout.snap) {
      this.separator();
      ImGui.BeginDisabled(!editing);
      if (this.button('Snapping', 'snap', { active: !!gizmo?.snapping })) {
        gizmo!.snapping = !gizmo!.snapping;
      }
      this.tooltip('Snapping\nAlign to edges and centers. Click to enable or disable.');
      if (layout.distance) {
        ImGui.SameLine();
        this.menu('SnapDistance', undefined, { label: distanceLabel, width: distanceWidth, arrow: true, hint: 'Snap distance' },
          () => this.drawSnapDistanceMenu(gizmo));
      }
      ImGui.EndDisabled();
    }

    ImGui.SetCursorScreenPos(new ImGui.Vec2(Math.max(origin.x + 4, origin.x + width - rightWidth() - 4), origin.y + 3));
    this.menu('Camera', 'camera', {
      label: layout.cameraLabel,
      width: cameraWidth(),
      filled: true,
      arrow: true,
      hint: 'Camera views and framing',
    }, () => this.drawCameraMenu(options));
    if (layout.zoom) {
      ImGui.SameLine();
      ImGui.BeginDisabled(!editing);
      this.menu('Zoom', undefined, { label: zoomLabel, width: zoomWidth, arrow: true, hint: 'Viewport zoom' }, () => this.drawZoomMenu(gizmo));
      ImGui.EndDisabled();
    }
    if (layout.show) {
      ImGui.SameLine();
      this.menu('Show', 'show', { width: menuWidth, filled: true, arrow: true, hint: 'Show flags' }, () => this.drawShowMenu(options));
    }
    ImGui.PopStyleVar(4);
    ImGui.SetCursorScreenPos(origin);
    ImGui.Dummy(new ImGui.Vec2(width, height));
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + height));
  }

  private drawMoreMenu (options: SceneToolbarOptions, layout: ToolbarLayout): void {
    const { gizmo, is2DMode } = options;
    const editing = !!gizmo && is2DMode;

    this.menuSection('Editing');
    if (!layout.transform && editorMenuItem('Transform', 'V / W', gizmo?.tool === 'transform', editing)) { gizmo?.setTool('transform'); }
    if (!layout.hand && editorMenuItem('Pan', 'H', gizmo?.tool === 'hand', editing)) { gizmo?.setTool('hand'); }
    if (editorMenuItem('Edit Text', 'Enter', false, editing && gizmo?.canEditText)) { gizmo?.editText(); }
    if (!layout.snap || !layout.distance || !layout.zoom || !layout.show) {
      this.menuSection('Viewport Options', true);
    }
    if (!layout.snap) {
      if (beginEditorMenu('Snapping', editing)) {
        this.menuSection('Behavior');
        if (editorMenuItem('Enabled', '', gizmo?.snapping)) { gizmo!.snapping = !gizmo!.snapping; }
        this.drawSnapDistanceMenu(gizmo, true);
        endEditorMenu();
      }
    } else if (!layout.distance) {
      if (beginEditorMenu('Snap Distance', editing)) {
        this.drawSnapDistanceMenu(gizmo);
        endEditorMenu();
      }
    }
    if (!layout.zoom && beginEditorMenu('Zoom', editing)) {
      this.drawZoomMenu(gizmo);
      endEditorMenu();
    }
    if (!layout.show && beginEditorMenu('Show')) {
      this.drawShowMenu(options);
      endEditorMenu();
    }
    this.menuSection('Help', true);
    if (beginEditorMenu('Keyboard Shortcuts')) {
      if (is2DMode) {
        this.menuSection('Tools');
        ImGui.TextUnformatted('V / W  Transform\nH  Pan');
        this.menuSection('Navigation', true);
        ImGui.TextUnformatted('F  Frame selection\nHome  Frame all\nSpace + drag / Middle mouse  Pan\nWheel  Zoom');
        this.menuSection('Selection and Text', true);
        ImGui.TextUnformatted('Shift + click  Multi-select\nDrag empty space  Box select\nEnter / Double-click text  Edit\nEsc  Exit editing / Clear selection');
      } else {
        this.menuSection('Navigation');
        ImGui.TextUnformatted('Left drag  Orbit\nMiddle drag  Pan\nWheel  Zoom');
      }
      endEditorMenu();
    }
  }

  private drawCameraMenu (options: SceneToolbarOptions): void {
    const { gizmo, is2DMode } = options;

    this.menuSection('View Mode');
    if (editorMenuItem('2D Canvas', '', is2DMode)) { options.set2DMode(true); }
    if (editorMenuItem('Perspective', '', !is2DMode)) { options.set2DMode(false); }
    this.menuSection('Viewport Navigation', true);
    if (editorMenuItem('Frame Selection', 'F', false, is2DMode && !!gizmo?.selectedItems.length)) { gizmo?.frameSelection(); }
    if (editorMenuItem('Frame All', 'Home', false, is2DMode && !!gizmo)) { gizmo?.frameAll(); }
    if (editorMenuItem('Reset View', '', false, !!gizmo)) { options.resetView(); }
  }

  private drawShowMenu (options: SceneToolbarOptions): void {
    const { gizmo, is2DMode, showGrid } = options;

    ImGui.BeginDisabled(!gizmo || !is2DMode);
    this.menuSection('Viewport');
    if (editorMenuItem('Grid', '', showGrid)) { options.setShowGrid(!showGrid); }
    this.menuSection('Selection', true);
    if (editorMenuItem('Selection Info', '', gizmo?.selectionInfo)) { gizmo!.selectionInfo = !gizmo!.selectionInfo; }
    if (editorMenuItem('Hover Highlight', '', gizmo?.hoverHighlight)) { gizmo!.hoverHighlight = !gizmo!.hoverHighlight; }
    ImGui.EndDisabled();
    this.menuSection('Performance', true);
    if (editorMenuItem('Show FPS', '', options.showFPS)) { options.setShowFPS(!options.showFPS); }
  }

  private drawSnapDistanceMenu (gizmo?: SceneGizmo, separated = false): void {
    const configs = gizmo?.handler.getConfigManager();
    const distance = configs?.get(selectionSnapConfig).distance;

    this.menuSection('Snap Distance', separated);
    for (const value of [2, 5, 10, 20]) {
      if (editorMenuItem(`${value} px`, '', distance === value)) { configs?.set(selectionSnapConfig, { distance: value }); }
    }
  }

  private drawZoomMenu (gizmo?: SceneGizmo): void {
    this.menuSection('Viewport Zoom');
    for (const scale of [0.25, 0.5, 1, 2, 4, 8, 16]) {
      if (editorMenuItem(`${scale * 100}%`, '', Math.abs((gizmo?.scale ?? 1) - scale) < 0.001)) { gizmo?.zoomTo(scale); }
    }
  }

  private menuSection (label: string, separated = false): void {
    editorMenuSection(label, separated);
  }

  private textButtonWidth (label: string, icon = false, arrow = true): number {
    return Math.ceil(ImGui.CalcTextSize(label).x + (icon ? 28 : 8) + (arrow ? 18 : 10));
  }

  private menu (id: string, icon: Icon | undefined, options: ButtonOptions, draw: () => void): void {
    const clicked = this.button(id, icon, options);
    const min = ImGui.GetItemRectMin();
    const max = ImGui.GetItemRectMax();

    if (clicked) { ImGui.OpenPopup(id); }
    if (options.hint && !ImGui.IsPopupOpen(id)) { this.tooltip(options.hint); }
    if (ImGui.IsPopupOpen(id)) {
      ImGui.SetNextWindowPos(new ImGui.Vec2(min.x, max.y + 3));
    }
    if (beginEditorPopup(id)) {
      draw();
      endEditorPopup();
    }
  }

  private button (id: string, icon?: Icon, options: ButtonOptions = {}): boolean {
    return toolbarButton('##Scene' + id, { icon: icon === 'show' ? 'view' : icon === 'snap' ? 'magnet' : icon,
      label: options.label, width: options.width ?? this.buttonHeight, height: this.buttonHeight, iconSize: 20,
      iconLeft: options.label || options.arrow ? 4 : undefined, labelLeft: icon ? 28 : 8,
      checked: options.active, checkedTint: ACTIVE_COLOR, dropdown: options.arrow, appearance: options.filled ? 'filled' : 'plain' });
  }

  private separator (): void { toolbarSeparator(this.buttonHeight); }

  private tooltip (text: string): void { editorTooltip(text); }
}

interface ButtonOptions {
  label?: string,
  width?: number,
  active?: boolean,
  arrow?: boolean,
  filled?: boolean,
  hint?: string,
}
