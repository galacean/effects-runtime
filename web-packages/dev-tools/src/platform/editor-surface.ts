import { EditorTooltips } from '../ui/controls/tooltip';
import { EditorDragFeedback } from '../ui/controls/drag-feedback';
import { Engine, VFXItem, InputEventKey, getPixelRatio } from '@galacean/effects';
import type { InputEvent } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { GUIServer, UICanvas, FocusMode, LineEdit, TextEdit } from '@galacean/effects-plugin-gui';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import { createEditorTheme, EDITOR_FONT, refreshEditorFonts } from '../ui/theme/control-theme';
import { TexturePresentation } from '../features/assets/preview/texture-preview';
import { clearControlIcons, prepareControlIcons } from '../ui/icons/control-icons';
import { EditorTextInput } from './editor-text-input';

export class EditorSurface {
  engine: Engine;
  canvas: HTMLCanvasElement;
  root: Control;
  private observer?: ResizeObserver;
  private textInput?: EditorTextInput;

  async initialize (canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
    const font = new FontFace(EDITOR_FONT, 'url(./Alibaba-PuHuiTi-Regular.ttf)');

    document.fonts.add(await font.load());
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    canvas.addEventListener('wheel', this.preventWheelDefault, { passive: false });
    this.engine = Engine.create(canvas, { name: 'EditorUI', env: 'editor', interactive: true, manualRender: true, ownsCanvas: false, doNotHandleContextLost: false });
    this.engine.renderingServer.graphics.textCache.defaultOptions.padding = 16;
    const item = new VFXItem(this.engine);
    const ui = item.addComponent(UICanvas);

    ui.onEnable(); this.root = ui.rootControl;
    const windowRoot = this.engine.getServer(GUIServer).windowRoot;

    windowRoot.theme = createEditorTheme(this.engine);
    const tooltips = new EditorTooltips(this.engine, this.root);

    tooltips.parent = windowRoot;
    new EditorDragFeedback(this.engine).parent = windowRoot;
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', this.resize);
    this.textInput = new EditorTextInput(() => {
      const focused = windowRoot.guiGetFocusOwner();

      return focused instanceof LineEdit || focused instanceof TextEdit;
    }, event => { this.engine.inputServer.pushInput(event); });
    this.engine.inputServer.on('input', this.onInput);
    this.resize();
  }

  get device (): RenderingDeviceWebGL { return this.engine.displayServer.renderingDevice as RenderingDeviceWebGL; }

  private readonly preventContextMenu = (event: Event): void => { event.preventDefault(); };
  private readonly preventWheelDefault = (event: WheelEvent): void => { event.preventDefault(); };

  private readonly resize = (): void => {
    this.engine.displayServer.pixelRatio = getPixelRatio();
    this.engine.displayServer.resize();
    refreshEditorFonts(this.engine);
    const bounds = this.canvas.getBoundingClientRect();

    this.engine.getServer(GUIServer).windowRoot.resize(bounds.width, bounds.height);
  };

  private readonly onInput = (event: InputEvent): void => {
    if (!(event instanceof InputEventKey) || !event.isPressed()) { return; }
    const root = this.engine.getServer(GUIServer).windowRoot;

    if (event.keycode === 'Escape' && root.guiIsDragging()) {
      root.guiCancelDrag(); root.updateMouseCursorState(); event.accept();
    } else if (!event.isAccepted() && event.keycode === 'Tab' &&
      !event.altPressed && !event.ctrlPressed && !event.metaPressed) {
      const focused = root.guiGetFocusOwner(), candidates: Control[] = [];
      const visit = (control: Control): void => {
        if (!control.visibleInHierarchy || !control.enabledInHierarchy) { return; }
        if (control.getFocusModeWithOverride() === FocusMode.All) { candidates.push(control); }
        control.children.forEach(visit);
      };
      let scope = focused ?? this.root;

      while (scope.parent && scope.parent !== root && scope.parent !== this.root) { scope = scope.parent; }
      visit(scope.parent === root ? scope : this.root);
      const index = candidates.indexOf(focused!);
      const next = index < 0 ? event.shiftPressed ? candidates.length - 1 : 0 :
        (index + (event.shiftPressed ? -1 : 1) + candidates.length) % candidates.length;

      candidates[next]?.grabFocus(); event.accept();
    }
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

    TexturePresentation.renderPending(this.engine);
    prepareControlIcons(this.engine);
    gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0); device.reset(); device.bindSystemFramebuffer();
    device.setViewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
    gl.clearColor(.14, .14, .14, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    this.engine.getServer(GUIServer).windowRoot.render();
  }

  dispose (): void {
    clearControlIcons(this.engine);
    this.observer?.disconnect(); this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
    this.canvas.removeEventListener('wheel', this.preventWheelDefault);
    window.removeEventListener('resize', this.resize); this.textInput?.dispose();
    this.engine.inputServer.off('input', this.onInput); this.engine.dispose();
  }
}

export const editorSurface = new EditorSurface();
