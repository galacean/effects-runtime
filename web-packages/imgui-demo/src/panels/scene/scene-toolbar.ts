import { selectionSnapConfig } from '@galacean/effects-plugin-editor-gizmo';
import type { SceneGizmo } from './scene-gizmo';
import { ImGui } from '../../imgui';
import { EditorColors } from '../theme';

interface SceneToolbarOptions {
  gizmo?: SceneGizmo,
  is2DMode: boolean,
  showGrid: boolean,
  set2DMode(value: boolean): void,
  setShowGrid(value: boolean): void,
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

type Icon = 'transform' | 'hand' | 'snap' | 'camera' | 'show' | 'more';

const ACTIVE_COLOR = new ImGui.Vec4(0.16, 0.62, 0.94, 1);

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
    const leftWidth = () => 20 + (layout.transform ? this.buttonHeight + 2 : 0)
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
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(8, 6));
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 4, origin.y + 3));

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
    if (!layout.transform && ImGui.MenuItem('Transform', 'V / W', gizmo?.tool === 'transform', editing)) { gizmo?.setTool('transform'); }
    if (!layout.hand && ImGui.MenuItem('Pan', 'H', gizmo?.tool === 'hand', editing)) { gizmo?.setTool('hand'); }
    if (ImGui.MenuItem('Edit Text', 'Enter', false, editing && gizmo?.canEditText)) { gizmo?.editText(); }
    if (!layout.snap || !layout.distance || !layout.zoom || !layout.show) {
      this.menuSection('Viewport Options', true);
    }
    if (!layout.snap) {
      if (ImGui.BeginMenu('Snapping', editing)) {
        this.menuSection('Behavior');
        if (ImGui.MenuItem('Enabled', '', gizmo?.snapping)) { gizmo!.snapping = !gizmo!.snapping; }
        this.drawSnapDistanceMenu(gizmo, true);
        ImGui.EndMenu();
      }
    } else if (!layout.distance) {
      if (ImGui.BeginMenu('Snap Distance', editing)) {
        this.drawSnapDistanceMenu(gizmo);
        ImGui.EndMenu();
      }
    }
    if (!layout.zoom && ImGui.BeginMenu('Zoom', editing)) {
      this.drawZoomMenu(gizmo);
      ImGui.EndMenu();
    }
    if (!layout.show && ImGui.BeginMenu('Show')) {
      this.drawShowMenu(options);
      ImGui.EndMenu();
    }
    this.menuSection('Help', true);
    if (ImGui.BeginMenu('Keyboard Shortcuts')) {
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
      ImGui.EndMenu();
    }
  }

  private drawCameraMenu (options: SceneToolbarOptions): void {
    const { gizmo, is2DMode } = options;

    this.menuSection('View Mode');
    if (ImGui.MenuItem('2D Canvas', '', is2DMode)) { options.set2DMode(true); }
    if (ImGui.MenuItem('Perspective', '', !is2DMode)) { options.set2DMode(false); }
    this.menuSection('Viewport Navigation', true);
    if (ImGui.MenuItem('Frame Selection', 'F', false, is2DMode && !!gizmo?.selectedItems.length)) { gizmo?.frameSelection(); }
    if (ImGui.MenuItem('Frame All', 'Home', false, is2DMode && !!gizmo)) { gizmo?.frameAll(); }
    if (ImGui.MenuItem('Reset View', '', false, !!gizmo)) { options.resetView(); }
  }

  private drawShowMenu (options: SceneToolbarOptions): void {
    const { gizmo, is2DMode, showGrid } = options;

    ImGui.BeginDisabled(!gizmo || !is2DMode);
    this.menuSection('Viewport');
    if (ImGui.MenuItem('Grid', '', showGrid)) { options.setShowGrid(!showGrid); }
    this.menuSection('Selection', true);
    if (ImGui.MenuItem('Selection Info', '', gizmo?.selectionInfo)) { gizmo!.selectionInfo = !gizmo!.selectionInfo; }
    if (ImGui.MenuItem('Hover Highlight', '', gizmo?.hoverHighlight)) { gizmo!.hoverHighlight = !gizmo!.hoverHighlight; }
    ImGui.EndDisabled();
  }

  private drawSnapDistanceMenu (gizmo?: SceneGizmo, separated = false): void {
    const configs = gizmo?.handler.getConfigManager();
    const distance = configs?.get(selectionSnapConfig).distance;

    this.menuSection('Snap Distance', separated);
    for (const value of [2, 5, 10, 20]) {
      if (ImGui.MenuItem(`${value} px`, '', distance === value)) { configs?.set(selectionSnapConfig, { distance: value }); }
    }
  }

  private drawZoomMenu (gizmo?: SceneGizmo): void {
    this.menuSection('Viewport Zoom');
    for (const scale of [0.25, 0.5, 1, 2, 4, 8, 16]) {
      if (ImGui.MenuItem(`${scale * 100}%`, '', Math.abs((gizmo?.scale ?? 1) - scale) < 0.001)) { gizmo?.zoomTo(scale); }
    }
  }

  private menuSection (label: string, separated = false): void {
    if (separated) {
      ImGui.Spacing();
      ImGui.PushStyleColor(ImGui.Col.Separator, EditorColors.borderStrong);
      ImGui.Separator();
      ImGui.PopStyleColor();
      ImGui.Spacing();
    }
    ImGui.TextColored(EditorColors.textSecondary, label);
    ImGui.Spacing();
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
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(8, 4));
    if (ImGui.BeginPopup(id)) {
      draw();
      ImGui.EndPopup();
    }
    ImGui.PopStyleVar();
  }

  private button (id: string, icon?: Icon, options: ButtonOptions = {}): boolean {
    const { label, width = this.buttonHeight, active = false, arrow = false, filled = false } = options;

    const normalBackground = filled ? EditorColors.button : EditorColors.titleBarBg;

    ImGui.PushStyleColor(ImGui.Col.Button, filled ? normalBackground : new ImGui.Vec4(0, 0, 0, 0));
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, EditorColors.buttonHovered);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, EditorColors.accentActive);
    const clicked = ImGui.Button(`##Scene${id}`, new ImGui.Vec2(width, this.buttonHeight));
    const min = ImGui.GetItemRectMin();
    const drawList = ImGui.GetWindowDrawList();
    const color = ImGui.GetColorU32(active ? ACTIVE_COLOR : EditorColors.textPrimary);
    const background = ImGui.IsItemActive() ? EditorColors.accentActive : ImGui.IsItemHovered() ? EditorColors.buttonHovered : normalBackground;

    if (icon) { this.drawIcon(icon, min.x + (label || arrow ? 14 : width / 2), min.y + this.buttonHeight / 2, color, ImGui.GetColorU32(background)); }
    if (label) {
      drawList.AddText(new ImGui.Vec2(min.x + (icon ? 28 : 8), min.y + (this.buttonHeight - ImGui.GetTextLineHeight()) / 2), color, label);
    }
    if (arrow) {
      const x = min.x + width - 9;
      const y = min.y + this.buttonHeight / 2;

      drawList.AddLine(new ImGui.Vec2(x - 3, y - 1), new ImGui.Vec2(x, y + 2), color, 1.2);
      drawList.AddLine(new ImGui.Vec2(x, y + 2), new ImGui.Vec2(x + 3, y - 1), color, 1.2);
    }
    ImGui.PopStyleColor(3);

    return clicked;
  }

  private separator (): void {
    ImGui.SameLine(0, 5);
    const point = ImGui.GetCursorScreenPos();

    ImGui.GetWindowDrawList().AddLine(new ImGui.Vec2(point.x, point.y + 4), new ImGui.Vec2(point.x, point.y + this.buttonHeight - 4),
      ImGui.GetColorU32(EditorColors.borderStrong));
    ImGui.Dummy(new ImGui.Vec2(1, this.buttonHeight));
    ImGui.SameLine(0, 5);
  }

  private drawIcon (icon: Icon, x: number, y: number, color: number, background: number): void {
    const drawList = ImGui.GetWindowDrawList();
    const point = (dx: number, dy: number) => new ImGui.Vec2(x + dx, y + dy);
    const line = (x1: number, y1: number, x2: number, y2: number) => drawList.AddLine(point(x1, y1), point(x2, y2), color, 1.3);

    if (icon === 'transform') {
      line(-6, 0, 6, 0); line(0, -6, 0, 6);
      for (const direction of [-1, 1]) {
        line(direction * 6, 0, direction * 3.5, -2.5); line(direction * 6, 0, direction * 3.5, 2.5);
        line(0, direction * 6, -2.5, direction * 3.5); line(0, direction * 6, 2.5, direction * 3.5);
      }
    } else if (icon === 'hand') {
      line(-4, 0, -6, -2); line(-6, -2, -7, 0); line(-7, 0, -4, 5);
      line(-4, 5, -2, 6); line(-2, 6, 3, 6); line(3, 6, 5, 2); line(5, 2, 5, -2);
      for (let finger = 0; finger < 4; finger++) { line(-4 + finger * 2.5, 0, -4 + finger * 2.5, -5 + Math.abs(finger - 1)); }
    } else if (icon === 'snap') {
      const magnetPoint = (dx: number, dy: number) => point((dx + dy) * Math.SQRT1_2, (dy - dx) * Math.SQRT1_2);
      const stroke = (a: ImGui.Vec2, b: ImGui.Vec2, tint = color) => drawList.AddLine(a, b, tint, 3);

      stroke(magnetPoint(-5, -6), magnetPoint(-5, 0));
      stroke(magnetPoint(5, -6), magnetPoint(5, 0));
      for (let segment = 0; segment < 12; segment++) {
        const start = segment * Math.PI / 12;
        const end = (segment + 1) * Math.PI / 12;

        stroke(magnetPoint(Math.cos(start) * 5, Math.sin(start) * 5), magnetPoint(Math.cos(end) * 5, Math.sin(end) * 5));
      }
      drawList.AddLine(magnetPoint(-6.5, -3.5), magnetPoint(-3.5, -3.5), background, 1);
      drawList.AddLine(magnetPoint(3.5, -3.5), magnetPoint(6.5, -3.5), background, 1);
    } else if (icon === 'camera') {
      drawList.AddRectFilled(point(-7, -4), point(2, 4), color, 1);
      drawList.AddTriangleFilled(point(3, -2), point(7, -5), point(7, 5), color);
      drawList.AddTriangleFilled(point(3, -2), point(7, 5), point(3, 2), color);
    } else if (icon === 'show') {
      line(-7, 0, -3, -4); line(-3, -4, 3, -4); line(3, -4, 7, 0);
      line(7, 0, 3, 4); line(3, 4, -3, 4); line(-3, 4, -7, 0);
      drawList.AddCircle(point(0, 0), 2, color, 12, 1.3);
    } else {
      for (const offset of [-4, 0, 4]) { drawList.AddCircleFilled(point(0, offset), 1.2, color); }
    }
  }

  private tooltip (text: string): void {
    if (ImGui.IsItemHovered()) {
      ImGui.BeginTooltip();
      ImGui.TextUnformatted(text);
      ImGui.EndTooltip();
    }
  }
}

interface ButtonOptions {
  label?: string,
  width?: number,
  active?: boolean,
  arrow?: boolean,
  filled?: boolean,
  hint?: string,
}
