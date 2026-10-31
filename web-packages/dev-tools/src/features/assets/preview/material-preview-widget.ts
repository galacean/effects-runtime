import { math, MouseButton, MouseButtonMask } from '@galacean/effects';
import type { Engine, InputEventKey, InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import { Control, FocusMode, VBoxContainer } from '@galacean/effects-plugin-gui';
import { append, expand, row } from '../../../ui/controls/layout';
import { EditorMenuButton } from '../../../ui/controls/menu';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import type { PropertyGroup } from '../../../ui/property-editor/property-sheet';
import { editorColors as C, EDITOR_FONT } from '../../../ui/theme/control-theme';
import type { MaterialPreviewRequest } from './material-preview';
import type { MaterialPreviewSettings } from './material-preview-settings';
import { defaultMaterialPreview, frameMaterialPreview, materialPreviewCamera, previewFieldOfView } from './material-preview-settings';
import { TexturePresentation, imageTexturePreview } from './texture-preview';
import type { RenderedPreview } from './texture-preview-cache';

export class MaterialPreviewViewport extends VBoxContainer {
  readonly view = defaultMaterialPreview();
  realtime = true;
  showStats = false;
  framed = true;
  source: (request: MaterialPreviewRequest) => RenderedPreview | undefined = () => undefined;
  error = '';
  private readonly camera: EditorMenuButton;
  private readonly shading: EditorMenuButton;
  private readonly models: { primitive: MaterialPreviewSettings['primitive'], button: EditorIconButton }[] = [];

  constructor (engine: Engine) {
    super(engine); this.setThemeConstantOverride('separation', 0);
    const toolbar = append(this, row(engine));
    const options = append(toolbar, new EditorMenuButton(engine, ''));

    options.iconName = 'more';
    options.actions = () => [
      { label: 'Realtime', shortcut: 'Ctrl+R', checked: this.realtime, action: () => this.realtime = !this.realtime },
      { label: 'Frame Preview', shortcut: 'F', action: () => this.frame() },
      { label: 'Grid', checked: this.view.grid, action: () => this.view.grid = !this.view.grid },
      { label: 'Background', checked: this.view.background, action: () => this.view.background = !this.view.background },
      { label: 'Statistics', checked: this.showStats, action: () => this.showStats = !this.showStats },
    ];
    this.camera = append(toolbar, new EditorMenuButton(engine, 'Perspective')); this.camera.showArrow = true; this.camera.themeTypeVariation = 'EditorViewportMenu';
    this.camera.actions = () => [false, true].map(orthographic => ({ label: orthographic ? 'Orthographic' : 'Perspective', checked: this.view.orthographic === orthographic, action: () => this.view.orthographic = orthographic }));
    this.shading = append(toolbar, new EditorMenuButton(engine, 'Lit')); this.shading.showArrow = true; this.shading.themeTypeVariation = 'EditorViewportMenu';
    this.shading.actions = () => [true, false].map(lit => ({ label: lit ? 'Lit' : 'Unlit', checked: this.view.lit === lit, action: () => this.view.lit = lit }));
    append(this, expand(new MaterialCanvas(engine, this)));
    const models = append(this, row(engine));

    append(models, expand(new Control(engine), true, false));
    for (const [primitive, icon] of [['cylinder', 'previewCylinder'], ['sphere', 'previewSphere'], ['plane', 'previewPlane'], ['cube', 'cube']] as const) {
      const button = append(models, new EditorIconButton(engine, icon));

      button.themeTypeVariation = 'EditorToggleButton'; this.models.push({ primitive, button });
      button.on('pressed', () => { this.view.primitive = primitive; this.resetCamera(); });
    }
  }
  resetCamera (): void {
    const { yaw, pitch, distance, targetX, targetY, targetZ } = defaultMaterialPreview();

    Object.assign(this.view, { yaw: this.view.primitive === 'plane' ? 0 : yaw, pitch: this.view.primitive === 'plane' ? 0 : pitch, distance, targetX, targetY, targetZ }); this.frame();
  }
  frame (): void { this.framed = true; frameMaterialPreview(this.view); }
  buildInspector (group: PropertyGroup): void {
    const meshes = ['cylinder', 'sphere', 'plane', 'cube'] as const;

    group.choice('Preview Mesh', { read: () => meshes.indexOf(this.view.primitive), write: index => { this.view.primitive = meshes[index]; this.resetCamera(); } }, ['Cylinder', 'Sphere', 'Plane', 'Cube']);
    group.boolean('Realtime', { read: () => this.realtime, write: value => this.realtime = value });
    group.boolean('Studio Lighting', { read: () => this.view.lit, write: value => this.view.lit = value });
    group.number('Distance', { read: () => this.view.distance, write: value => { this.framed = false; this.view.distance = value; } }, { min: .1, max: 50, step: .02 });
  }
  override update (dt: number): void {
    this.camera.text = this.view.orthographic ? 'Orthographic' : 'Perspective'; this.shading.text = this.view.lit ? 'Lit' : 'Unlit';
    this.models.forEach(({ primitive, button }) => button.setPressedNoSignal(primitive === this.view.primitive)); super.update(dt);
  }
}

class MaterialCanvas extends Control {
  private readonly presentation: TexturePresentation;
  private image?: RenderedPreview;
  private light = false;
  constructor (engine: Engine, private readonly viewport: MaterialPreviewViewport) {
    super(engine); this.focusMode = FocusMode.All; this.presentation = new TexturePresentation(engine);
  }
  override update (dt: number): void {
    if (this.visibleInHierarchy) {
      const v = this.viewport;

      v.view.aspect = this.width / Math.max(1, this.height); if (v.framed) { frameMaterialPreview(v.view); }
      this.image = v.source({ realtime: v.realtime, priority: 1, view: v.view });
      this.presentation.update(this.image ? imageTexturePreview(this.image) : undefined);
    }
    super.update(dt);
  }
  override draw (): void {
    const graphics = this.engine.renderingServer.graphics, v = this.viewport;

    graphics.pushClipRect(0, 0, this.width, this.height);
    this.fillRect(0, 0, this.width, this.height, v.view.background ? new math.Color(.145, .155, .17, 1) : C.background);
    if (v.view.grid) { this.drawGrid(); }
    this.presentation.draw(this, 0, 0, this.width, this.height);
    const message = v.error || this.image?.error || (!this.image ? 'Loading preview...' : v.showStats ? this.image.statistics : '');

    if (message) { this.drawText(12, 12, message.split('\n')[0], 14, C.foreground, EDITOR_FONT); }
    graphics.popClipRect();
  }
  override onMouseDown (event: InputEventMouseButton): void { this.grabFocus(); event.accept(); }
  override onMouseMove (event: InputEventMouseMotion): void {
    const left = !!(event.buttonMask & MouseButtonMask.Left), middle = !!(event.buttonMask & MouseButtonMask.Middle), right = !!(event.buttonMask & MouseButtonMask.Right);
    const v = this.viewport, view = v.view, x = event.relative.x, y = event.relative.y;

    if (left && this.light) { view.lightYaw -= x * Math.PI / 180 * .22; view.lightPitch += y * Math.PI / 180 * .22; } else if (middle && (!event.altPressed || !left && !right)) {
      const e = materialPreviewCamera(view).world.elements, scale = 2 * view.distance * Math.tan(previewFieldOfView / 2) / this.height;

      v.framed = false; view.targetX += (e[0] * x - e[4] * y) * scale; view.targetY += (e[1] * x - e[5] * y) * scale; view.targetZ += (e[2] * x - e[6] * y) * scale;
    } else if (right || left && middle) { v.framed = false; view.distance = Math.max(.1, Math.min(50, view.distance * Math.exp(-(x + y) * .006))); } else if (left) { view.yaw -= x * Math.PI / 180 * .2; view.pitch -= y * Math.PI / 180 * .2; }
    if (left || middle || right) { event.accept(); }
  }
  override onMouseWheel (event: InputEventMouseButton): void {
    this.viewport.framed = false;
    this.viewport.view.distance = Math.max(.1, Math.min(50, this.viewport.view.distance * Math.pow(.88, event.factor * (event.buttonIndex === MouseButton.WheelUp ? 1 : -1)))); event.accept();
  }
  override onKeyDown (event: InputEventKey): void {
    if (event.physicalKeycode === 'KeyL') { this.light = true; }
    if (event.physicalKeycode === 'KeyF') { this.viewport.frame(); event.accept(); }
    if (event.physicalKeycode === 'KeyR' && (event.ctrlPressed || event.metaPressed)) { this.viewport.realtime = !this.viewport.realtime; event.accept(); }
  }
  override onKeyUp (event: InputEventKey): void { if (event.physicalKeycode === 'KeyL') { this.light = false; } }
  override onLostFocus (): void { this.light = false; }
  private drawGrid (): void {
    const matrix = materialPreviewCamera(this.viewport.view).viewProjection;
    const line = (x1: number, z1: number, x2: number, z2: number): void => {
      const a = matrix.transformVector4(new math.Vector4(x1, -1.02, z1, 1)), b = matrix.transformVector4(new math.Vector4(x2, -1.02, z2, 1));
      const nearA = a.z + a.w, nearB = b.z + b.w;

      if (nearA <= 0 && nearB <= 0) { return; }
      if (nearA <= 0 || nearB <= 0) {
        const point = nearA <= 0 ? a : b, other = nearA <= 0 ? b : a, t = (point.z + point.w) / (point.z + point.w - other.z - other.w);

        point.set(point.x + (other.x - point.x) * t, point.y + (other.y - point.y) * t, point.z + (other.z - point.z) * t, point.w + (other.w - point.w) * t);
      }
      this.drawLine((a.x / a.w + 1) * this.width / 2, (1 - a.y / a.w) * this.height / 2, (b.x / b.w + 1) * this.width / 2, (1 - b.y / b.w) * this.height / 2, C.outline);
    };

    for (let index = -12; index <= 12; index++) { line(index / 2, -6, index / 2, 6); line(-6, index / 2, 6, index / 2); }
  }
  override onDestroy (): void { this.presentation.dispose(); super.onDestroy(); }
}
