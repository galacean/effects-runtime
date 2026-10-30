import { math } from '@galacean/effects';
import { ImGui } from '../../../platform/imgui';
import { assetText } from '../../../ui/asset-view/asset-view';
import type { EditorIcon } from '../../../ui/icons/editor-icons';
import { PropertyFields as Fields } from '../../../ui/property-editor/property-fields';
import { PropertyGrid } from '../../../ui/property-editor/property-grid';
import { InteractionColors as C } from '../../../ui/theme/editor-interaction';
import { beginEditorPopup, editorMenuItem, editorMenuSection, endEditorPopup } from '../../../ui/widgets/editor-menu';
import { editorTooltip } from '../../../ui/widgets/editor-tooltip';
import { toolbarButton } from '../../../ui/widgets/toolbar-button';
import type { MaterialPreviewRequest } from './material-preview';
import { defaultMaterialPreview, frameMaterialPreview, materialPreviewCamera, previewFieldOfView, type MaterialPreviewSettings, type PreviewPrimitive } from './material-preview-settings';
import { drawTexturePreview, imageTexturePreview } from './texture-preview';
import type { RenderedPreview } from './texture-preview-cache';

const models: [PreviewPrimitive, EditorIcon, string][] = [
  ['cylinder', 'previewCylinder', 'Cylinder'], ['sphere', 'previewSphere', 'Sphere'], ['plane', 'previewPlane', 'Plane'], ['cube', 'cube', 'Cube'],
];

type PreviewDragMode = 'orbit' | 'pan' | 'dolly' | 'light';
interface PreviewDrag { mode: PreviewDragMode, mouse: ImGui.Vec2, view: MaterialPreviewSettings }

export class MaterialPreviewViewport {
  readonly view = defaultMaterialPreview();
  realtime = true;
  private showStats = false;
  private drag?: PreviewDrag;
  private framed = true;

  resetCamera (): void {
    const { yaw, pitch, distance, targetX, targetY, targetZ } = defaultMaterialPreview();

    Object.assign(this.view, { yaw: this.view.primitive === 'plane' ? 0 : yaw, pitch: this.view.primitive === 'plane' ? 0 : pitch, distance, targetX, targetY, targetZ });
    this.frame();
  }

  draw (source: (request: MaterialPreviewRequest) => RenderedPreview | undefined, error?: string): void {
    this.toolbar();
    const origin = ImGui.GetCursorScreenPos(), size = ImGui.GetContentRegionAvail();
    const width = Math.max(1, size.x), height = Math.max(1, size.y), max = new ImGui.Vec2(origin.x + width, origin.y + height);

    const canvasHeight = Math.max(1, height - 38);

    this.view.aspect = width / canvasHeight;
    if (this.framed) { frameMaterialPreview(this.view); }
    ImGui.InvisibleButton('##MaterialViewportCanvas', new ImGui.Vec2(width, canvasHeight), ImGui.ButtonFlags.MouseButtonLeft | ImGui.ButtonFlags.MouseButtonMiddle | ImGui.ButtonFlags.MouseButtonRight);
    const hovered = ImGui.IsItemHovered();

    this.input(hovered, canvasHeight);
    const draw = ImGui.GetWindowDrawList();

    draw.PushClipRect(origin, max, true);
    draw.AddRectFilled(origin, max, ImGui.GetColorU32(this.view.background ? new ImGui.Vec4(0.145, 0.155, 0.17, 1) : C.background));
    if (this.view.grid) { this.drawGrid(origin, width, canvasHeight); }
    const image = ImGui.IsRectVisible(origin, max) ? source({ realtime: this.realtime, priority: 1, view: this.view }) : undefined;

    if (image) { drawTexturePreview(imageTexturePreview(image), origin, new ImGui.Vec2(max.x, origin.y + canvasHeight)); }
    const message = error || image?.error;

    if (message) {
      draw.AddRectFilled(new ImGui.Vec2(origin.x, max.y - 30), max, ImGui.GetColorU32(C.panel));
      assetText(message.split('\n')[0], origin.x + 8, max.y - 26, ImGui.COL32(255, 107, 90, 255), width - 16);
      if (hovered) { editorTooltip(message); }
    } else if (!image) { assetText('Loading preview...', origin.x + 12, origin.y + 12); }
    if (this.showStats && image?.statistics) { assetText(image.statistics, origin.x + 12, origin.y + 12, ImGui.GetColorU32(C.foreground)); }
    draw.PopClipRect();
    ImGui.SetCursorScreenPos(new ImGui.Vec2(Math.max(origin.x + 8, max.x - 134), Math.max(origin.y, max.y - 34)));
    for (let index = 0; index < models.length; index++) {
      const [model, icon, label] = models[index];

      if (index) { ImGui.SameLine(0, 2); }
      if (toolbarButton('##Preview' + label, { icon, width: 29, height: 27, checked: this.view.primitive === model, hint: 'Preview on ' + label.toLowerCase() })) {
        this.view.primitive = model; this.resetCamera();
      }
    }
    ImGui.SetCursorScreenPos(max); ImGui.Dummy(new ImGui.Vec2(0, 0));
  }

  drawInspector (): void {
    PropertyGrid.category('Previewing', 'Previewing', ['Preview Mesh', 'Realtime', 'Lighting', 'Distance'], () => {
      Fields.ComboField('Preview Mesh', value => {
        if (value !== undefined) { this.view.primitive = models[value][0]; this.resetCamera(); }

        return models.findIndex(([model]) => model === this.view.primitive);
      }, models.map(([, , label]) => label));
      Fields.Property('Realtime', () => ImGui.Checkbox('##Realtime', value => this.realtime = value ?? this.realtime));
      Fields.Property('Studio Lighting', () => ImGui.Checkbox('##Lighting', value => this.view.lit = value ?? this.view.lit));
      Fields.NumberField('Distance', value => {
        if (value !== undefined) { this.framed = false; this.view.distance = Math.max(0.1, Math.min(50, value)); }

        return this.view.distance;
      }, 0.02, 0.1, 50);
    });
  }

  private toolbar (): void {
    const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + 34), ImGui.GetColorU32(C.panel));
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x + 6, p.y + 3));
    if (toolbarButton('##PreviewOptions', { icon: 'more', dropdown: true, width: 34, height: 28, hint: 'Viewport options' })) { ImGui.OpenPopup('##MaterialViewportOptions'); }
    if (beginEditorPopup('##MaterialViewportOptions')) {
      editorMenuSection('Viewport');
      if (editorMenuItem('Realtime', 'Ctrl+R', this.realtime)) { this.realtime = !this.realtime; }
      if (editorMenuItem('Frame Preview', 'F')) { this.frame(); }
      endEditorPopup();
    }
    ImGui.SameLine(0, 4);
    if (toolbarButton('##PreviewCamera', { icon: 'camera', label: this.view.orthographic ? 'Orthographic' : 'Perspective', dropdown: true, height: 28, appearance: 'filled' })) { ImGui.OpenPopup('##MaterialCamera'); }
    if (beginEditorPopup('##MaterialCamera')) {
      editorMenuSection('Camera');
      if (editorMenuItem('Perspective', '', !this.view.orthographic)) { this.view.orthographic = false; }
      if (editorMenuItem('Orthographic', '', this.view.orthographic)) { this.view.orthographic = true; }
      endEditorPopup();
    }
    ImGui.SameLine(0, 4);
    if (toolbarButton('##PreviewShading', { icon: 'light', label: this.view.lit ? 'Lit' : 'Unlit', dropdown: true, height: 28, appearance: 'filled' })) { ImGui.OpenPopup('##MaterialShading'); }
    if (beginEditorPopup('##MaterialShading')) {
      editorMenuSection('View Mode');
      if (editorMenuItem('Lit', '', this.view.lit)) { this.view.lit = true; }
      if (editorMenuItem('Unlit', '', !this.view.lit)) { this.view.lit = false; }
      endEditorPopup();
    }
    if (width > 380) {
      ImGui.SameLine(0, 4);
      if (toolbarButton('##PreviewShow', { label: 'Show', dropdown: true, height: 28 })) { ImGui.OpenPopup('##MaterialShow'); }
      if (beginEditorPopup('##MaterialShow')) {
        editorMenuSection('Show');
        if (editorMenuItem('Grid', '', this.view.grid)) { this.view.grid = !this.view.grid; }
        if (editorMenuItem('Background', '', this.view.background)) { this.view.background = !this.view.background; }
        if (editorMenuItem('Statistics', '', this.showStats)) { this.showStats = !this.showStats; }
        endEditorPopup();
      }
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + 34)); ImGui.Dummy(new ImGui.Vec2(width, 0));
  }

  private input (hovered: boolean, height: number): void {
    const mouse = ImGui.GetMousePos(), io = ImGui.GetIO();
    const left = ImGui.IsMouseDown(ImGui.MouseButton.Left), middle = ImGui.IsMouseDown(ImGui.MouseButton.Middle), right = ImGui.IsMouseDown(ImGui.MouseButton.Right);
    const mode: PreviewDragMode | undefined = left && ImGui.IsKeyDown(ImGui.Key.L) ? 'light'
      : middle && (!io.KeyAlt || !left && !right) ? 'pan' : right || left && middle ? 'dolly' : left ? 'orbit' : undefined;

    if (hovered && !mode && io.MouseWheel) { this.framed = false; this.view.distance = Math.max(0.1, Math.min(50, this.view.distance * Math.pow(0.88, io.MouseWheel))); }
    if (!mode || !ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows)) { this.drag = undefined; }
    const clicked = [ImGui.MouseButton.Left, ImGui.MouseButton.Middle, ImGui.MouseButton.Right].some(button => ImGui.IsMouseClicked(button));

    if (mode && (hovered && clicked || this.drag && mode !== this.drag.mode)) {
      this.drag = { mode, mouse: new ImGui.Vec2(mouse.x, mouse.y), view: { ...this.view } };
    }
    if (this.drag) {
      const { mode, view } = this.drag, x = mouse.x - this.drag.mouse.x, y = mouse.y - this.drag.mouse.y;

      if (mode === 'light') { this.view.lightYaw = view.lightYaw - x * Math.PI / 180 * 0.22; this.view.lightPitch = view.lightPitch + y * Math.PI / 180 * 0.22; } else if (mode === 'orbit') {
        this.view.yaw = view.yaw - x * Math.PI / 180 * 0.2;
        this.view.pitch = view.pitch - y * Math.PI / 180 * 0.2;
      } else if (mode === 'pan') {
        const e = materialPreviewCamera(view).world.elements;
        const scale = 2 * view.distance * Math.tan(previewFieldOfView / 2) / height;

        this.framed = false;
        this.view.targetX = view.targetX + (e[0] * x - e[4] * y) * scale;
        this.view.targetY = view.targetY + (e[1] * x - e[5] * y) * scale;
        this.view.targetZ = view.targetZ + (e[2] * x - e[6] * y) * scale;
      } else { this.framed = false; this.view.distance = Math.max(0.1, Math.min(50, view.distance * Math.exp(-(x + y) * 0.006))); }
      if (x || y) { ImGui.SetMouseCursor(ImGui.MouseCursor.None); }
    }
    if (hovered && ImGui.IsKeyPressed(ImGui.Key.F, false)) { this.frame(); }
    if (hovered && io.KeyCtrl && ImGui.IsKeyPressed(ImGui.Key.R, false)) { this.realtime = !this.realtime; }
  }

  private frame (): void { this.drag = undefined; this.framed = true; frameMaterialPreview(this.view); }

  private drawGrid (origin: ImGui.Vec2, width: number, height: number): void {
    const matrix = materialPreviewCamera(this.view).viewProjection, draw = ImGui.GetWindowDrawList();
    const line = (x1: number, z1: number, x2: number, z2: number) => {
      const a = matrix.transformVector4(new math.Vector4(x1, -1.02, z1, 1)), b = matrix.transformVector4(new math.Vector4(x2, -1.02, z2, 1));
      const nearA = a.z + a.w, nearB = b.z + b.w;

      if (nearA <= 0 && nearB <= 0) { return; }
      if (nearA <= 0 || nearB <= 0) {
        const point = nearA <= 0 ? a : b, other = nearA <= 0 ? b : a;
        const t = (point.z + point.w) / (point.z + point.w - other.z - other.w);

        point.set(point.x + (other.x - point.x) * t, point.y + (other.y - point.y) * t, point.z + (other.z - point.z) * t, point.w + (other.w - point.w) * t);
      }
      draw.AddLine(new ImGui.Vec2(origin.x + (a.x / a.w + 1) * width / 2, origin.y + (1 - a.y / a.w) * height / 2),
        new ImGui.Vec2(origin.x + (b.x / b.w + 1) * width / 2, origin.y + (1 - b.y / b.w) * height / 2), ImGui.GetColorU32(C.outline));
    };

    draw.PushClipRect(origin, new ImGui.Vec2(origin.x + width, origin.y + height), true);
    for (let index = -12; index <= 12; index++) { line(index / 2, -6, index / 2, 6); line(-6, index / 2, 6, index / 2); }
    draw.PopClipRect();
  }
}
