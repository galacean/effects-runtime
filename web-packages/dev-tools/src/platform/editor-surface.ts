import { EditorTooltips } from '../ui/controls/tooltip';
import { EditorDragFeedback } from '../ui/controls/drag-feedback';
import { Engine, VFXItem, InputEventKey, getPixelRatio, math } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { GUIServer, UICanvas, FocusMode, LineEdit, TextEdit } from '@galacean/effects-plugin-gui';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import { createEditorTheme, EDITOR_FONT } from '../ui/theme/control-theme';

export class EditorSurface {
  engine: Engine;
  canvas: HTMLCanvasElement;
  root: Control;
  private observer?: ResizeObserver;

  async initialize (canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
    const font = new FontFace(EDITOR_FONT, 'url(./Alibaba-PuHuiTi-Regular.ttf)');

    document.fonts.add(await font.load());
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    canvas.addEventListener('wheel', this.preventWheelDefault, { passive: false });
    canvas.addEventListener('pointerdown', this.pointerDown, true);
    this.engine = Engine.create(canvas, { name: 'EditorUI', env: 'editor', interactive: true, manualRender: true, ownsCanvas: false, doNotHandleContextLost: false });
    const item = new VFXItem(this.engine);
    const ui = item.addComponent(UICanvas);

    ui.onEnable(); this.root = ui.rootControl;
    const windowRoot = this.engine.getServer(GUIServer).windowRoot;

    windowRoot.theme = createEditorTheme();
    const tooltips = new EditorTooltips(this.engine, this.root);

    tooltips.parent = windowRoot;
    new EditorDragFeedback(this.engine).parent = windowRoot;
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown, true);
    this.resize();
  }

  get device (): RenderingDeviceWebGL { return this.engine.displayServer.renderingDevice as RenderingDeviceWebGL; }

  private readonly preventContextMenu = (event: Event): void => { event.preventDefault(); };
  private readonly preventWheelDefault = (event: WheelEvent): void => { event.preventDefault(); };

  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) { return; }
    const focused = this.engine.getServer(GUIServer).windowRoot.guiGetFocusOwner();

    if (!(focused instanceof LineEdit || focused instanceof TextEdit)) { return; }
    const bounds = this.canvas.getBoundingClientRect(), point = new math.Vector2(event.clientX - bounds.left, event.clientY - bounds.top);
    let inside = focused.hasPoint(focused.makePositionLocal(point));

    for (let parent = focused.parent; inside && parent; parent = parent.parent) {
      if (parent.clipContents && !parent.hasPoint(parent.makePositionLocal(point))) { inside = false; }
    }
    if (!inside) { focused.releaseFocus(); }
  };

  private readonly resize = (): void => {
    this.engine.displayServer.pixelRatio = getPixelRatio();
    this.engine.displayServer.resize();
    const bounds = this.canvas.getBoundingClientRect();

    this.engine.getServer(GUIServer).windowRoot.resize(bounds.width, bounds.height);
  };

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.isComposing || event.key !== 'Tab' && event.key !== 'Escape') { return; }
    const root = this.engine.getServer(GUIServer).windowRoot;
    const focused = root.guiGetFocusOwner();

    if (event.target !== this.canvas && !(event.target instanceof HTMLTextAreaElement && (focused instanceof LineEdit || focused instanceof TextEdit))) { return; }
    if (event.key === 'Escape') {
      if (root.guiIsDragging()) {
        root.guiCancelDrag(); root.updateMouseCursorState(); event.preventDefault(); event.stopImmediatePropagation();

        return;
      }
      const key = new InputEventKey();

      key.keycode = event.key; key.physicalKeycode = event.code; key.pressed = true;
      for (let control = focused; control && !key.isAccepted(); control = control.parent) { control.onKeyDown(key); }
      event.preventDefault(); event.stopImmediatePropagation();

      return;
    }
    const candidates: Control[] = [];
    const visit = (control: Control): void => {
      if (!control.visibleInHierarchy || !control.enabledInHierarchy) { return; }
      if (control.getFocusModeWithOverride() === FocusMode.All) { candidates.push(control); }
      control.children.forEach(visit);
    };
    // Root layers enforce modal focus and pointer ownership. Traverse the focused popup when one is open.
    let scope = focused ?? this.root;

    while (scope.parent && scope.parent !== root && scope.parent !== this.root) { scope = scope.parent; }
    visit(scope.parent === root ? scope : this.root);
    const index = candidates.indexOf(focused!);
    const direction = event.shiftKey ? -1 : 1;

    candidates[(index + direction + candidates.length) % candidates.length]?.grabFocus();
    event.preventDefault(); event.stopImmediatePropagation();
  };

  update (delta: number): void {
    const root = this.engine.getServer(GUIServer).windowRoot;

    root.update(delta);
    const focused = root.guiGetFocusOwner();

    if (document.hasFocus() && document.activeElement === document.body && !(focused instanceof LineEdit || focused instanceof TextEdit)) {
      this.canvas.focus({ preventScroll: true });
    }
  }

  render (): void {
    const device = this.device, gl = device.gl;

    gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0); device.reset(); device.bindSystemFramebuffer();
    device.setViewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
    gl.clearColor(.14, .14, .14, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    this.engine.getServer(GUIServer).windowRoot.render();
  }

  dispose (): void {
    this.observer?.disconnect(); this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
    this.canvas.removeEventListener('wheel', this.preventWheelDefault);
    this.canvas.removeEventListener('pointerdown', this.pointerDown, true);
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.keyDown, true); this.engine.dispose();
  }
}

export const editorSurface = new EditorSurface();
