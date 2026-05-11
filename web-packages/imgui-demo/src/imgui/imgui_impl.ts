/* eslint-disable no-inner-declarations */
/* eslint-disable promise/catch-or-return */
/* eslint-disable no-console */
//@ts-nocheck
import * as ImGui from 'maoan-imgui-js';

let clipboard_text: string = '';

let canvas: HTMLCanvasElement | null = null;

export function getCanvas (): HTMLCanvasElement | null {
  return canvas;
}

export let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
let g_ShaderHandle: WebGLProgram | null = null;
let g_VertHandle: WebGLShader | null = null;
let g_FragHandle: WebGLShader | null = null;
let g_AttribLocationTex: WebGLUniformLocation | null = null;
let g_AttribLocationProjMtx: WebGLUniformLocation | null = null;
let g_AttribLocationPosition: GLint = -1;
let g_AttribLocationUV: GLint = -1;
let g_AttribLocationColor: GLint = -1;
let g_VboHandle: WebGLBuffer | null = null;
let g_ElementsHandle: WebGLBuffer | null = null;
let g_FontTexture: WebGLTexture | null = null;

export let ctx: CanvasRenderingContext2D | null = null;

let prev_time: number = 0;

function document_on_copy (event: ClipboardEvent): void {
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', clipboard_text);
  }
  // console.log(`${event.type}: "${clipboard_text}"`);
  event.preventDefault();
}

function document_on_cut (event: ClipboardEvent): void {
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', clipboard_text);
  }
  // console.log(`${event.type}: "${clipboard_text}"`);
  event.preventDefault();
}

function document_on_paste (event: ClipboardEvent): void {
  if (event.clipboardData) {
    clipboard_text = event.clipboardData.getData('text/plain');
  }
  // console.log(`${event.type}: "${clipboard_text}"`);
  event.preventDefault();
}

function window_on_resize (): void {
  if (canvas !== null) {
    const devicePixelRatio: number = window.devicePixelRatio || 1;

    canvas.width = canvas.scrollWidth;
    canvas.width = Math.floor(canvas.scrollWidth * devicePixelRatio);
    canvas.height = canvas.scrollHeight;
    canvas.height = Math.floor(canvas.scrollHeight * devicePixelRatio);
  }
}

function window_on_gamepadconnected (event: any /* GamepadEvent */): void {
  console.log('Gamepad connected at index %d: %s. %d buttons, %d axes.',
    event.gamepad.index, event.gamepad.id,
    event.gamepad.buttons.length, event.gamepad.axes.length);
}

function window_on_gamepaddisconnected (event: any /* GamepadEvent */): void {
  console.log('Gamepad disconnected at index %d: %s.',
    event.gamepad.index, event.gamepad.id);
}

// Map browser event.code to ImGuiKey values
const code_to_imgui_key: Record<string, number> = {
  'Tab': ImGui.Key.Tab,
  'ArrowLeft': ImGui.Key.LeftArrow, 'ArrowRight': ImGui.Key.RightArrow,
  'ArrowUp': ImGui.Key.UpArrow, 'ArrowDown': ImGui.Key.DownArrow,
  'PageUp': ImGui.Key.PageUp, 'PageDown': ImGui.Key.PageDown,
  'Home': ImGui.Key.Home, 'End': ImGui.Key.End,
  'Insert': ImGui.Key.Insert, 'Delete': ImGui.Key.Delete,
  'Backspace': ImGui.Key.Backspace,
  'Space': ImGui.Key.Space,
  'Enter': ImGui.Key.Enter, 'NumpadEnter': ImGui.Key.KeypadEnter,
  'Escape': ImGui.Key.Escape,
  'ControlLeft': ImGui.Key.LeftCtrl, 'ControlRight': ImGui.Key.RightCtrl,
  'ShiftLeft': ImGui.Key.LeftShift, 'ShiftRight': ImGui.Key.RightShift,
  'AltLeft': ImGui.Key.LeftAlt, 'AltRight': ImGui.Key.RightAlt,
  'MetaLeft': ImGui.Key.LeftSuper, 'MetaRight': ImGui.Key.RightSuper,
  'ContextMenu': ImGui.Key.Menu,
  'Digit0': ImGui.Key._0, 'Digit1': ImGui.Key._1, 'Digit2': ImGui.Key._2,
  'Digit3': ImGui.Key._3, 'Digit4': ImGui.Key._4, 'Digit5': ImGui.Key._5,
  'Digit6': ImGui.Key._6, 'Digit7': ImGui.Key._7, 'Digit8': ImGui.Key._8,
  'Digit9': ImGui.Key._9,
  'KeyA': ImGui.Key.A, 'KeyB': ImGui.Key.B, 'KeyC': ImGui.Key.C,
  'KeyD': ImGui.Key.D, 'KeyE': ImGui.Key.E, 'KeyF': ImGui.Key.F,
  'KeyG': ImGui.Key.G, 'KeyH': ImGui.Key.H, 'KeyI': ImGui.Key.I,
  'KeyJ': ImGui.Key.J, 'KeyK': ImGui.Key.K, 'KeyL': ImGui.Key.L,
  'KeyM': ImGui.Key.M, 'KeyN': ImGui.Key.N, 'KeyO': ImGui.Key.O,
  'KeyP': ImGui.Key.P, 'KeyQ': ImGui.Key.Q, 'KeyR': ImGui.Key.R,
  'KeyS': ImGui.Key.S, 'KeyT': ImGui.Key.T, 'KeyU': ImGui.Key.U,
  'KeyV': ImGui.Key.V, 'KeyW': ImGui.Key.W, 'KeyX': ImGui.Key.X,
  'KeyY': ImGui.Key.Y, 'KeyZ': ImGui.Key.Z,
  'F1': ImGui.Key.F1, 'F2': ImGui.Key.F2, 'F3': ImGui.Key.F3,
  'F4': ImGui.Key.F4, 'F5': ImGui.Key.F5, 'F6': ImGui.Key.F6,
  'F7': ImGui.Key.F7, 'F8': ImGui.Key.F8, 'F9': ImGui.Key.F9,
  'F10': ImGui.Key.F10, 'F11': ImGui.Key.F11, 'F12': ImGui.Key.F12,
  'Quote': ImGui.Key.Apostrophe, 'Comma': ImGui.Key.Comma,
  'Minus': ImGui.Key.Minus, 'Period': ImGui.Key.Period,
  'Slash': ImGui.Key.Slash, 'Semicolon': ImGui.Key.Semicolon,
  'Equal': ImGui.Key.Equal, 'BracketLeft': ImGui.Key.LeftBracket,
  'Backslash': ImGui.Key.Backslash, 'BracketRight': ImGui.Key.RightBracket,
  'Backquote': ImGui.Key.GraveAccent,
  'CapsLock': ImGui.Key.CapsLock, 'ScrollLock': ImGui.Key.ScrollLock,
  'NumLock': ImGui.Key.NumLock, 'PrintScreen': ImGui.Key.PrintScreen,
  'Pause': ImGui.Key.Pause,
  'Numpad0': ImGui.Key.Keypad0, 'Numpad1': ImGui.Key.Keypad1,
  'Numpad2': ImGui.Key.Keypad2, 'Numpad3': ImGui.Key.Keypad3,
  'Numpad4': ImGui.Key.Keypad4, 'Numpad5': ImGui.Key.Keypad5,
  'Numpad6': ImGui.Key.Keypad6, 'Numpad7': ImGui.Key.Keypad7,
  'Numpad8': ImGui.Key.Keypad8, 'Numpad9': ImGui.Key.Keypad9,
  'NumpadDecimal': ImGui.Key.KeypadDecimal,
  'NumpadDivide': ImGui.Key.KeypadDivide,
  'NumpadMultiply': ImGui.Key.KeypadMultiply,
  'NumpadSubtract': ImGui.Key.KeypadSubtract,
  'NumpadAdd': ImGui.Key.KeypadAdd,
  'NumpadEqual': ImGui.Key.KeypadEqual,
};

function canvas_on_blur (event: FocusEvent): void {
  // 焦点转移到 IME 隐藏输入框时不重置状态，否则会丢失鼠标点击
  if (event.relatedTarget === ime_input) {
    return;
  }
  const io = ImGui.GetIO();

  io.AddKeyEvent(ImGui.Key.Mod_Ctrl, false);
  io.AddKeyEvent(ImGui.Key.Mod_Shift, false);
  io.AddKeyEvent(ImGui.Key.Mod_Alt, false);
  io.AddKeyEvent(ImGui.Key.Mod_Super, false);
  for (let i = 0; i < io.MouseDown.length; ++i) {
    io.MouseDown[i] = false;
  }
}

function canvas_on_keydown (event: KeyboardEvent): void {
  const io = ImGui.GetIO();

  io.AddKeyEvent(ImGui.Key.Mod_Ctrl, event.ctrlKey);
  io.AddKeyEvent(ImGui.Key.Mod_Shift, event.shiftKey);
  io.AddKeyEvent(ImGui.Key.Mod_Alt, event.altKey);
  io.AddKeyEvent(ImGui.Key.Mod_Super, event.metaKey);

  const imgui_key = code_to_imgui_key[event.code];

  if (imgui_key !== undefined) {
    io.AddKeyEvent(imgui_key, true);
  }

  if (/*io.WantCaptureKeyboard ||*/ event.key === 'Tab') {
    event.preventDefault();
  }
}

function canvas_on_keyup (event: KeyboardEvent): void {
  const io = ImGui.GetIO();

  io.AddKeyEvent(ImGui.Key.Mod_Ctrl, event.ctrlKey);
  io.AddKeyEvent(ImGui.Key.Mod_Shift, event.shiftKey);
  io.AddKeyEvent(ImGui.Key.Mod_Alt, event.altKey);
  io.AddKeyEvent(ImGui.Key.Mod_Super, event.metaKey);

  const imgui_key = code_to_imgui_key[event.code];

  if (imgui_key !== undefined) {
    io.AddKeyEvent(imgui_key, false);
  }

  if (io.WantCaptureKeyboard) {
    event.preventDefault();
  }
}

let ime_input: HTMLTextAreaElement | null = null;
let is_composing = false;

function ime_on_compositionstart (): void {
  is_composing = true;
}

function ime_on_compositionend (): void {
  is_composing = false;
  ime_flush();
}

function ime_on_input (): void {
  if (!is_composing) {
    ime_flush();
  }
}

function ime_flush (): void {
  if (!ime_input) {
    return;
  }
  const text = ime_input.value;

  ime_input.value = '';
  if (!text) {
    return;
  }
  const io = ImGui.GetIO();

  for (const ch of text) {
    io.AddInputCharacter(ch.codePointAt(0));
  }
}

function ime_create (): void {
  if (ime_input || typeof document === 'undefined') {
    return;
  }
  ime_input = document.createElement('textarea');
  ime_input.style.cssText =
    'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
  document.body.appendChild(ime_input);

  ime_input.addEventListener('compositionstart', ime_on_compositionstart);
  ime_input.addEventListener('compositionend', ime_on_compositionend);
  ime_input.addEventListener('input', ime_on_input);

  ime_input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!is_composing && !e.isComposing) {
      canvas_on_keydown(e);
    }
  });
  ime_input.addEventListener('keyup', (e: KeyboardEvent) => {
    if (!is_composing && !e.isComposing) {
      canvas_on_keyup(e);
    }
  });
}

function ime_destroy (): void {
  if (ime_input) {
    ime_input.remove();
    ime_input = null;
  }
  is_composing = false;
}

function ime_focus (): void {
  if (ime_input && document.activeElement !== ime_input) {
    // 仅当焦点在 canvas 或 body 上时才切换到 IME 输入框，避免从无关 DOM 控件抢走焦点
    const active = document.activeElement;

    if (active === canvas || active === document.body || active === null) {
      ime_input.focus();
    }
  }
}

function ime_blur (): void {
  if (ime_input && document.activeElement === ime_input) {
    if (canvas) {
      canvas.focus();
    }
  }
}

function canvas_on_keypress (event: KeyboardEvent): void {
  // console.log(event.type, event.key, event.code, event.keyCode);
  const io = ImGui.GetIO();

  io.AddInputCharacter(event.charCode);
  if (io.WantCaptureKeyboard) {
    event.preventDefault();
  }
}

function canvas_on_pointermove (event: PointerEvent): void {
  const io = ImGui.GetIO();

  io.MousePos.x = event.offsetX;
  io.MousePos.y = event.offsetY;
  if (io.WantCaptureMouse) {
    event.preventDefault();
  }
}

// MouseEvent.button
// A number representing a given button:
// 0: Main button pressed, usually the left button or the un-initialized state
// 1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
// 2: Secondary button pressed, usually the right button
// 3: Fourth button, typically the Browser Back button
// 4: Fifth button, typically the Browser Forward button
const mouse_button_map: number[] = [0, 2, 1, 3, 4];

function canvas_on_pointerdown (event: PointerEvent): void {
  const io = ImGui.GetIO();

  io.MousePos.x = event.offsetX;
  io.MousePos.y = event.offsetY;
  io.MouseDown[mouse_button_map[event.button]] = true;
  // if (io.WantCaptureMouse) {
  //     event.preventDefault();
  // }
}
function canvas_on_contextmenu (event: Event): void {
  const io = ImGui.GetIO();

  if (io.WantCaptureMouse) {
    event.preventDefault();
  }
}

function canvas_on_pointerup (event: PointerEvent): void {
  const io = ImGui.GetIO();

  io.MouseDown[mouse_button_map[event.button]] = false;
  if (io.WantCaptureMouse) {
    event.preventDefault();
  }
}

function canvas_on_wheel (event: WheelEvent): void {
  const io = ImGui.GetIO();
  let scale: number = 1.0;

  switch (event.deltaMode) {
    case event.DOM_DELTA_PIXEL: scale = 0.01;

      break;
    case event.DOM_DELTA_LINE: scale = 0.2;

      break;
    case event.DOM_DELTA_PAGE: scale = 1.0;

      break;
  }
  io.MouseWheelH = event.deltaX * scale;
  io.MouseWheel = -event.deltaY * scale; // Mouse wheel: 1 unit scrolls about 5 lines text.
  if (io.WantCaptureMouse) {
    event.preventDefault();
  }
}

export function Init (value: HTMLCanvasElement | WebGL2RenderingContext | WebGLRenderingContext | CanvasRenderingContext2D | null): void {
  const io = ImGui.GetIO();

  if (typeof(window) !== 'undefined') {
    io.BackendPlatformName = 'imgui_impl_browser';
    ImGui.LoadIniSettingsFromMemory(window.localStorage.getItem('imgui.ini') || '');
  } else {
    io.BackendPlatformName = 'imgui_impl_console';
  }

  if (typeof(navigator) !== 'undefined') {
    io.ConfigMacOSXBehaviors = navigator.platform.match(/Mac/) !== null;
  }

  if (typeof(document) !== 'undefined') {
    document.body.addEventListener('copy', document_on_copy);
    document.body.addEventListener('cut', document_on_cut);
    document.body.addEventListener('paste', document_on_paste);
  }

  io.SetClipboardTextFn = (user_data: any, text: string): void => {
    clipboard_text = text;
    // console.log(`set clipboard_text: "${clipboard_text}"`);
    if (typeof navigator !== 'undefined' && typeof (navigator as any).clipboard !== 'undefined') {
      // console.log(`clipboard.writeText: "${clipboard_text}"`);
      (navigator as any).clipboard.writeText(clipboard_text).then((): void => {
        // console.log(`clipboard.writeText: "${clipboard_text}" done.`);
      });
    }
  };
  io.GetClipboardTextFn = (user_data: any): string => {
    // if (typeof navigator !== "undefined" && typeof (navigator as any).clipboard !== "undefined") {
    //     console.log(`clipboard.readText: "${clipboard_text}"`);
    //     (navigator as any).clipboard.readText().then((text: string): void => {
    //         clipboard_text = text;
    //         console.log(`clipboard.readText: "${clipboard_text}" done.`);
    //     });
    // }
    // console.log(`get clipboard_text: "${clipboard_text}"`);
    return clipboard_text;
  };
  io.ClipboardUserData = null;

  if (typeof(window) !== 'undefined') {
    window.addEventListener('resize', window_on_resize);
    window.addEventListener('gamepadconnected', window_on_gamepadconnected);
    window.addEventListener('gamepaddisconnected', window_on_gamepaddisconnected);
  }

  if (typeof(window) !== 'undefined') {
    if (value instanceof (HTMLCanvasElement)) {
      canvas = value;
      value = canvas.getContext('webgl2', { alpha: false }) || canvas.getContext('webgl', { alpha: false }) || canvas.getContext('2d');
    }
    if (typeof WebGL2RenderingContext !== 'undefined' && value instanceof (WebGL2RenderingContext)) {
      io.BackendRendererName = 'imgui_impl_webgl2';
      canvas = canvas || value.canvas as HTMLCanvasElement;
      gl = value;
    } else if (typeof WebGLRenderingContext !== 'undefined' && value instanceof (WebGLRenderingContext)) {
      io.BackendRendererName = 'imgui_impl_webgl';
      canvas = canvas || value.canvas as HTMLCanvasElement;
      gl = value;
    } else if (typeof CanvasRenderingContext2D !== 'undefined' && value instanceof (CanvasRenderingContext2D)) {
      io.BackendRendererName = 'imgui_impl_2d';
      canvas = canvas || value.canvas;
      ctx = value;
    }
  }

  if (canvas !== null) {
    window_on_resize();
    canvas.style.touchAction = 'none'; // Disable browser handling of all panning and zooming gestures.
    canvas.addEventListener('blur', canvas_on_blur);
    canvas.addEventListener('keydown', canvas_on_keydown);
    canvas.addEventListener('keyup', canvas_on_keyup);
    canvas.addEventListener('keypress', canvas_on_keypress);
    canvas.addEventListener('pointermove', canvas_on_pointermove);
    canvas.addEventListener('pointerdown', canvas_on_pointerdown);
    canvas.addEventListener('contextmenu', canvas_on_contextmenu);
    canvas.addEventListener('pointerup', canvas_on_pointerup);
    canvas.addEventListener('wheel', canvas_on_wheel);
  }

  ime_create();

  // Setup back-end capabilities flags
  io.BackendFlags |= ImGui.BackendFlags.HasMouseCursors;   // We can honor GetMouseCursor() values (optional)

  // Keyboard input is handled via AddKeyEvent in canvas_on_keydown/canvas_on_keyup

  CreateDeviceObjects();
}

export function Shutdown (): void {
  DestroyDeviceObjects();

  if (canvas !== null) {
    canvas.removeEventListener('blur', canvas_on_blur);
    canvas.removeEventListener('keydown', canvas_on_keydown);
    canvas.removeEventListener('keyup', canvas_on_keyup);
    canvas.removeEventListener('keypress', canvas_on_keypress);
    canvas.removeEventListener('pointermove', canvas_on_pointermove);
    canvas.removeEventListener('pointerdown', canvas_on_pointerdown);
    canvas.removeEventListener('contextmenu', canvas_on_contextmenu);
    canvas.removeEventListener('pointerup', canvas_on_pointerup);
    canvas.removeEventListener('wheel', canvas_on_wheel);
  }

  ime_destroy();

  gl = null;
  ctx = null;
  canvas = null;

  if (typeof(window) !== 'undefined') {
    window.removeEventListener('resize', window_on_resize);
    window.removeEventListener('gamepadconnected', window_on_gamepadconnected);
    window.removeEventListener('gamepaddisconnected', window_on_gamepaddisconnected);
  }

  if (typeof(document) !== 'undefined') {
    document.body.removeEventListener('copy', document_on_copy);
    document.body.removeEventListener('cut', document_on_cut);
    document.body.removeEventListener('paste', document_on_paste);
  }
}

export function NewFrame (time: number): void {
  const io = ImGui.GetIO();

  if (io.WantSaveIniSettings) {
    io.WantSaveIniSettings = false;
    if (typeof(window) !== 'undefined') {
      window.localStorage.setItem('imgui.ini', ImGui.SaveIniSettingsToMemory());
    }
  }

  // 当 ImGui 需要文字输入时，焦点切到隐藏 textarea 以激活 IME
  if (io.WantTextInput) {
    ime_focus();
  } else {
    ime_blur();
  }

  const w: number = canvas && canvas.scrollWidth || 640;
  const h: number = canvas && canvas.scrollHeight || 480;
  const display_w: number = gl && gl.drawingBufferWidth || w;
  const display_h: number = gl && gl.drawingBufferHeight || h;

  io.DisplaySize.x = w;
  io.DisplaySize.y = h;
  io.DisplayFramebufferScale.x = w > 0 ? (display_w / w) : 0;
  io.DisplayFramebufferScale.y = h > 0 ? (display_h / h) : 0;

  const dt: number = time - prev_time;

  prev_time = time;
  io.DeltaTime = dt / 1000;

  if (io.WantSetMousePos) {
    console.log('TODO: MousePos', io.MousePos.x, io.MousePos.y);
  }

  if (typeof(document) !== 'undefined') {
    if (io.MouseDrawCursor) {
      document.body.style.cursor = 'none';
    } else {
      switch (ImGui.GetMouseCursor()) {
        case ImGui.MouseCursor.None: document.body.style.cursor = 'none';

          break;
        default: case ImGui.MouseCursor.Arrow: document.body.style.cursor = 'default';

          break;
        case ImGui.MouseCursor.TextInput: document.body.style.cursor = 'text';

          break;         // When hovering over InputText, etc.
        case ImGui.MouseCursor.ResizeAll: document.body.style.cursor = 'all-scroll';

          break;         // Unused
        case ImGui.MouseCursor.ResizeNS: document.body.style.cursor = 'ns-resize';

          break;     // When hovering over an horizontal border
        case ImGui.MouseCursor.ResizeEW: document.body.style.cursor = 'ew-resize';

          break;     // When hovering over a vertical border or a column
        case ImGui.MouseCursor.ResizeNESW: document.body.style.cursor = 'nesw-resize';

          break; // When hovering over the bottom-left corner of a window
        case ImGui.MouseCursor.ResizeNWSE: document.body.style.cursor = 'nwse-resize';

          break; // When hovering over the bottom-right corner of a window
        case ImGui.MouseCursor.Hand: document.body.style.cursor = 'move';

          break;
        case ImGui.MouseCursor.NotAllowed: document.body.style.cursor = 'not-allowed';

          break;
      }
    }
  }

  // Gamepad navigation mapping
  // In v1.92+, use io.AddKeyEvent/AddKeyAnalogEvent with ImGuiKey_GamepadXXX keys instead of NavInputs[]
  if (io.ConfigFlags & ImGui.ConfigFlags.NavEnableGamepad) {
    const gamepads: (Gamepad | null)[] = (typeof(navigator) !== 'undefined' && typeof(navigator.getGamepads) === 'function') ? navigator.getGamepads() : [];

    for (let i = 0; i < gamepads.length; ++i) {
      const gamepad: Gamepad | null = gamepads[i];

      if (!gamepad) { continue; }
      io.BackendFlags |= ImGui.BackendFlags.HasGamepad;
      const buttons_count: number = gamepad.buttons.length;
      const axes_count: number = gamepad.axes.length;

      function MAP_BUTTON (KEY: number, BUTTON_NO: number): void {
        if (!gamepad) { return; }
        const pressed = buttons_count > BUTTON_NO && gamepad.buttons[BUTTON_NO].pressed;

        io.AddKeyEvent(KEY, pressed);
      }
      function MAP_ANALOG (KEY: number, AXIS_NO: number, V0: number, V1: number): void {
        if (!gamepad) { return; }
        let v: number = (axes_count > AXIS_NO) ? gamepad.axes[AXIS_NO] : V0;

        v = (v - V0) / (V1 - V0);
        if (v > 1.0) { v = 1.0; }
        if (v < 0.0) { v = 0.0; }
        io.AddKeyAnalogEvent(KEY, v > 0.1, v);
      }

      // Standard gamepad mapping (most gamepads follow this)
      // https://w3c.github.io/gamepad/#remapping
      MAP_BUTTON(ImGui.Key.GamepadFaceDown, 0);     // Cross / A
      MAP_BUTTON(ImGui.Key.GamepadFaceRight, 1);    // Circle / B
      MAP_BUTTON(ImGui.Key.GamepadFaceLeft, 2);     // Square / X
      MAP_BUTTON(ImGui.Key.GamepadFaceUp, 3);       // Triangle / Y
      MAP_BUTTON(ImGui.Key.GamepadL1, 4);            // L1 / LB
      MAP_BUTTON(ImGui.Key.GamepadR1, 5);            // R1 / RB
      MAP_ANALOG(ImGui.Key.GamepadL2, 6, +0.3, +0.9); // L2 / LT
      MAP_ANALOG(ImGui.Key.GamepadR2, 7, +0.3, +0.9); // R2 / RT
      MAP_BUTTON(ImGui.Key.GamepadBack, 8);          // Select / Back
      MAP_BUTTON(ImGui.Key.GamepadStart, 9);         // Start / Menu
      MAP_BUTTON(ImGui.Key.GamepadL3, 10);           // L3
      MAP_BUTTON(ImGui.Key.GamepadR3, 11);           // R3
      MAP_BUTTON(ImGui.Key.GamepadDpadUp, 12);
      MAP_BUTTON(ImGui.Key.GamepadDpadDown, 13);
      MAP_BUTTON(ImGui.Key.GamepadDpadLeft, 14);
      MAP_BUTTON(ImGui.Key.GamepadDpadRight, 15);
      MAP_ANALOG(ImGui.Key.GamepadLStickLeft, 0, -0.3, -0.9);
      MAP_ANALOG(ImGui.Key.GamepadLStickRight, 0, +0.3, +0.9);
      MAP_ANALOG(ImGui.Key.GamepadLStickUp, 1, -0.3, -0.9);
      MAP_ANALOG(ImGui.Key.GamepadLStickDown, 1, +0.3, +0.9);
      MAP_ANALOG(ImGui.Key.GamepadRStickLeft, 2, -0.3, -0.9);
      MAP_ANALOG(ImGui.Key.GamepadRStickRight, 2, +0.3, +0.9);
      MAP_ANALOG(ImGui.Key.GamepadRStickUp, 3, -0.3, -0.9);
      MAP_ANALOG(ImGui.Key.GamepadRStickDown, 3, +0.3, +0.9);
    }
  }
}

export function RenderDrawData (draw_data: ImGui.DrawData | null = ImGui.GetDrawData()): void {
  const io = ImGui.GetIO();

  if (draw_data === null) { throw new Error(); }

  gl || ctx || console.log(draw_data);

  // Avoid rendering when minimized, scale coordinates for retina displays (screen coordinates != framebuffer coordinates)
  const fb_width: number = io.DisplaySize.x * io.DisplayFramebufferScale.x;
  const fb_height: number = io.DisplaySize.y * io.DisplayFramebufferScale.y;

  if (fb_width === 0 || fb_height === 0) {
    return;
  }
  draw_data.ScaleClipRects(io.DisplayFramebufferScale);

  const gl2: WebGL2RenderingContext | null = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext && gl || null;
  const gl_vao: OES_vertex_array_object | null = gl && gl.getExtension('OES_vertex_array_object') || null;

  // Backup GL state
  const last_active_texture: GLenum | null = gl && gl.getParameter(gl.ACTIVE_TEXTURE) || null;
  const last_program: WebGLProgram | null = gl && gl.getParameter(gl.CURRENT_PROGRAM) || null;
  const last_texture: WebGLTexture | null = gl && gl.getParameter(gl.TEXTURE_BINDING_2D) || null;
  const last_array_buffer: WebGLBuffer | null = gl && gl.getParameter(gl.ARRAY_BUFFER_BINDING) || null;
  const last_element_array_buffer: WebGLBuffer | null = gl && gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) || null;
  const last_vertex_array_object: WebGLVertexArrayObject | WebGLVertexArrayObjectOES | null = gl2 && gl2.getParameter(gl2.VERTEX_ARRAY_BINDING) || gl && gl_vao && gl.getParameter(gl_vao.VERTEX_ARRAY_BINDING_OES) || null;
  // GLint last_polygon_mode[2]; glGetIntegerv(GL_POLYGON_MODE, last_polygon_mode);
  const last_viewport: Int32Array | null = gl && gl.getParameter(gl.VIEWPORT) || null;
  const last_scissor_box: Int32Array | null = gl && gl.getParameter(gl.SCISSOR_BOX) || null;
  const last_blend_src_rgb: GLenum | null = gl && gl.getParameter(gl.BLEND_SRC_RGB) || null;
  const last_blend_dst_rgb: GLenum | null = gl && gl.getParameter(gl.BLEND_DST_RGB) || null;
  const last_blend_src_alpha: GLenum | null = gl && gl.getParameter(gl.BLEND_SRC_ALPHA) || null;
  const last_blend_dst_alpha: GLenum | null = gl && gl.getParameter(gl.BLEND_DST_ALPHA) || null;
  const last_blend_equation_rgb: GLenum | null = gl && gl.getParameter(gl.BLEND_EQUATION_RGB) || null;
  const last_blend_equation_alpha: GLenum | null = gl && gl.getParameter(gl.BLEND_EQUATION_ALPHA) || null;
  const last_enable_blend: GLboolean | null = gl && gl.getParameter(gl.BLEND) || null;
  const last_enable_cull_face: GLboolean | null = gl && gl.getParameter(gl.CULL_FACE) || null;
  const last_enable_depth_test: GLboolean | null = gl && gl.getParameter(gl.DEPTH_TEST) || null;
  const last_enable_scissor_test: GLboolean | null = gl && gl.getParameter(gl.SCISSOR_TEST) || null;

  // Setup desired GL state
  // Recreate the VAO every time (this is to easily allow multiple GL contexts to be rendered to. VAO are not shared among GL contexts)
  // The renderer would actually work without any VAO bound, but then our VertexAttrib calls would overwrite the default one currently bound.
  const vertex_array_object: WebGLVertexArrayObject | WebGLVertexArrayObjectOES | null = gl2 && gl2.createVertexArray() || gl_vao && gl_vao.createVertexArrayOES();

  // Setup render state: alpha-blending enabled, no face culling, no depth testing, scissor enabled, polygon fill
  gl && gl.enable(gl.BLEND);
  gl && gl.blendEquation(gl.FUNC_ADD);
  gl && gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl && gl.disable(gl.CULL_FACE);
  gl && gl.disable(gl.DEPTH_TEST);
  gl && gl.enable(gl.SCISSOR_TEST);
  // glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);

  // Setup viewport, orthographic projection matrix
  // Our visible imgui space lies from draw_data->DisplayPps (top left) to draw_data->DisplayPos+data_data->DisplaySize (bottom right). DisplayMin is typically (0,0) for single viewport apps.
  gl && gl.viewport(0, 0, fb_width, fb_height);
  const L: number = draw_data.DisplayPos.x;
  const R: number = draw_data.DisplayPos.x + draw_data.DisplaySize.x;
  const T: number = draw_data.DisplayPos.y;
  const B: number = draw_data.DisplayPos.y + draw_data.DisplaySize.y;
  const ortho_projection: Float32Array = new Float32Array([
    2.0 / (R - L), 0.0, 0.0, 0.0,
    0.0, 2.0 / (T - B), 0.0, 0.0,
    0.0, 0.0, -1.0, 0.0,
    (R + L) / (L - R), (T + B) / (B - T), 0.0, 1.0,
  ]);

  gl && gl.useProgram(g_ShaderHandle);
  gl && gl.uniform1i(g_AttribLocationTex, 0);
  gl && g_AttribLocationProjMtx && gl.uniformMatrix4fv(g_AttribLocationProjMtx, false, ortho_projection);

  gl2 && gl2.bindVertexArray(vertex_array_object) || gl_vao && gl_vao.bindVertexArrayOES(vertex_array_object);

  // Render command lists
  gl && gl.bindBuffer(gl.ARRAY_BUFFER, g_VboHandle);
  gl && gl.enableVertexAttribArray(g_AttribLocationPosition);
  gl && gl.enableVertexAttribArray(g_AttribLocationUV);
  gl && gl.enableVertexAttribArray(g_AttribLocationColor);

  gl && gl.vertexAttribPointer(g_AttribLocationPosition, 2, gl.FLOAT, false, ImGui.DrawVertSize, ImGui.DrawVertPosOffset);
  gl && gl.vertexAttribPointer(g_AttribLocationUV, 2, gl.FLOAT, false, ImGui.DrawVertSize, ImGui.DrawVertUVOffset);
  gl && gl.vertexAttribPointer(g_AttribLocationColor, 4, gl.UNSIGNED_BYTE, true, ImGui.DrawVertSize, ImGui.DrawVertColOffset);

  // Draw
  const pos = draw_data.DisplayPos;
  const idx_buffer_type: GLenum = gl && ((ImGui.DrawIdxSize === 4) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT) || 0;

  draw_data.IterateDrawLists((draw_list: ImGui.DrawList): void => {
    gl || ctx || console.log(draw_list);
    gl || ctx || console.log('VtxBuffer.length', draw_list.VtxBuffer.length);
    gl || ctx || console.log('IdxBuffer.length', draw_list.IdxBuffer.length);

    let idx_buffer_offset = 0;

    gl && gl.bindBuffer(gl.ARRAY_BUFFER, g_VboHandle);
    gl && gl.bufferData(gl.ARRAY_BUFFER, draw_list.VtxBuffer, gl.STREAM_DRAW);
    gl && gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g_ElementsHandle);
    gl && gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, draw_list.IdxBuffer, gl.STREAM_DRAW);

    draw_list.IterateDrawCmds((draw_cmd: ImGui.DrawCmd): void => {
      gl || ctx || console.log(draw_cmd);
      gl || ctx || console.log('ElemCount', draw_cmd.ElemCount);
      gl || ctx || console.log('ClipRect', draw_cmd.ClipRect.x, fb_height - draw_cmd.ClipRect.w, draw_cmd.ClipRect.z - draw_cmd.ClipRect.x, draw_cmd.ClipRect.w - draw_cmd.ClipRect.y);
      gl || ctx || console.log('TextureId', draw_cmd.TextureId);
      if (!gl && !ctx) {
        console.log('i: pos.x pos.y uv.x uv.y col');
        for (let i = 0; i < Math.min(3, draw_cmd.ElemCount); ++i) {
          const view: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i * ImGui.DrawVertSize);

          console.log(`${i}: ${view.pos[0].toFixed(2)} ${view.pos[1].toFixed(2)} ${view.uv[0].toFixed(5)} ${view.uv[1].toFixed(5)} ${('00000000' + view.col[0].toString(16)).substr(-8)}`);
        }
      }

      if (draw_cmd.UserCallback !== null) {
        // User callback (registered via ImDrawList::AddCallback)
        draw_cmd.UserCallback(draw_list, draw_cmd);
      } else {
        const clip_rect = new ImGui.Vec4(draw_cmd.ClipRect.x - pos.x, draw_cmd.ClipRect.y - pos.y, draw_cmd.ClipRect.z - pos.x, draw_cmd.ClipRect.w - pos.y);

        if (clip_rect.x < fb_width && clip_rect.y < fb_height && clip_rect.z >= 0.0 && clip_rect.w >= 0.0) {
          // Apply scissor/clipping rectangle
          gl && gl.scissor(clip_rect.x, fb_height - clip_rect.w, clip_rect.z - clip_rect.x, clip_rect.w - clip_rect.y);

          // Bind texture, Draw
          gl && gl.activeTexture(gl.TEXTURE0);
          gl && gl.bindTexture(gl.TEXTURE_2D, draw_cmd.TextureId);
          gl && gl.drawElements(gl.TRIANGLES, draw_cmd.ElemCount, idx_buffer_type, idx_buffer_offset);

          if (ctx) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(clip_rect.x, clip_rect.y, clip_rect.z - clip_rect.x, clip_rect.w - clip_rect.y);
            ctx.clip();
            const idx = ImGui.DrawIdxSize === 4 ?
              new Uint32Array(draw_list.IdxBuffer.buffer, draw_list.IdxBuffer.byteOffset + idx_buffer_offset) :
              new Uint16Array(draw_list.IdxBuffer.buffer, draw_list.IdxBuffer.byteOffset + idx_buffer_offset);

            for (let i = 0; i < draw_cmd.ElemCount; i += 3) {
              const i0: number = idx[i + 0];
              const i1: number = idx[i + 1];
              const i2: number = idx[i + 2];
              const v0: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i0 * ImGui.DrawVertSize);
              const v1: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i1 * ImGui.DrawVertSize);
              const v2: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i2 * ImGui.DrawVertSize);
              const i3: number = idx[i + 3];
              const i4: number = idx[i + 4];
              const i5: number = idx[i + 5];
              const v3: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i3 * ImGui.DrawVertSize);
              const v4: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i4 * ImGui.DrawVertSize);
              const v5: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i5 * ImGui.DrawVertSize);
              let quad = true;
              let minmin: ImGui.DrawVert = v0;
              let minmax: ImGui.DrawVert = v0;
              let maxmin: ImGui.DrawVert = v0;
              let maxmax: ImGui.DrawVert = v0;

              for (const v of [v1, v2, v3, v4, v5]) {
                let found = false;

                if (v.pos[0] <= minmin.pos[0] && v.pos[1] <= minmin.pos[1]) { minmin = v; found = true; }
                if (v.pos[0] <= minmax.pos[0] && v.pos[1] >= minmax.pos[1]) { minmax = v; found = true; }
                if (v.pos[0] >= maxmin.pos[0] && v.pos[1] <= maxmin.pos[1]) { maxmin = v; found = true; }
                if (v.pos[0] >= maxmax.pos[0] && v.pos[1] >= maxmax.pos[1]) { maxmax = v; found = true; }
                if (!found) { quad = false; }
              }
              quad = quad && (minmin.pos[0] === minmax.pos[0]);
              quad = quad && (maxmin.pos[0] === maxmax.pos[0]);
              quad = quad && (minmin.pos[1] === maxmin.pos[1]);
              quad = quad && (minmax.pos[1] === maxmax.pos[1]);
              if (quad) {
                if (minmin.uv[0] === maxmax.uv[0] || minmin.uv[1] === maxmax.uv[1]) {
                  // one vertex color
                  ctx.beginPath();
                  ctx.rect(minmin.pos[0], minmin.pos[1], maxmax.pos[0] - minmin.pos[0], maxmax.pos[1] - minmin.pos[1]);
                  ctx.fillStyle = `rgba(${v0.col[0] >> 0 & 0xff}, ${v0.col[0] >> 8 & 0xff}, ${v0.col[0] >> 16 & 0xff}, ${(v0.col[0] >> 24 & 0xff) / 0xff})`;
                  ctx.fill();
                } else {
                  // no vertex color
                  const image = draw_cmd.TextureId as CanvasImageSource; // HACK
                  const width = image instanceof HTMLVideoElement ? image.videoWidth : image.width as number;
                  const height = image instanceof HTMLVideoElement ? image.videoHeight : image.height as number;

                  image && ctx.drawImage(image,
                    minmin.uv[0] * width, minmin.uv[1] * height,
                    (maxmax.uv[0] - minmin.uv[0]) * width, (maxmax.uv[1] - minmin.uv[1]) * height,
                    minmin.pos[0], minmin.pos[1],
                    maxmax.pos[0] - minmin.pos[0], maxmax.pos[1] - minmin.pos[1]);
                  // ctx.beginPath();
                  // ctx.rect(minmin.pos[0], minmin.pos[1], maxmax.pos[0] - minmin.pos[0], maxmax.pos[1] - minmin.pos[1]);
                  // ctx.strokeStyle = "yellow";
                  // ctx.stroke();
                }
                i += 3;
              } else {
                // one vertex color, no texture
                ctx.beginPath();
                ctx.moveTo(v0.pos[0], v0.pos[1]);
                ctx.lineTo(v1.pos[0], v1.pos[1]);
                ctx.lineTo(v2.pos[0], v2.pos[1]);
                ctx.closePath();
                ctx.fillStyle = `rgba(${v0.col[0] >> 0 & 0xff}, ${v0.col[0] >> 8 & 0xff}, ${v0.col[0] >> 16 & 0xff}, ${(v0.col[0] >> 24 & 0xff) / 0xff})`;
                ctx.fill();
              }
            }
            ctx.restore();
          }
        }
      }
      idx_buffer_offset += draw_cmd.ElemCount * ImGui.DrawIdxSize;
    });
  });

  // Destroy the temporary VAO
  gl2 && gl2.deleteVertexArray(vertex_array_object) || gl_vao && gl_vao.deleteVertexArrayOES(vertex_array_object);

  // Restore modified GL state
  gl && (last_program !== null) && gl.useProgram(last_program);
  gl && (last_texture !== null) && gl.bindTexture(gl.TEXTURE_2D, last_texture);
  gl && (last_active_texture !== null) && gl.activeTexture(last_active_texture);
  gl2 && gl2.bindVertexArray(last_vertex_array_object) || gl_vao && gl_vao.bindVertexArrayOES(last_vertex_array_object);
  gl && (last_array_buffer !== null) && gl.bindBuffer(gl.ARRAY_BUFFER, last_array_buffer);
  gl && (last_element_array_buffer !== null) && gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, last_element_array_buffer);
  gl && (last_blend_equation_rgb !== null && last_blend_equation_alpha !== null) && gl.blendEquationSeparate(last_blend_equation_rgb, last_blend_equation_alpha);
  gl && (last_blend_src_rgb !== null && last_blend_src_alpha !== null && last_blend_dst_rgb !== null && last_blend_dst_alpha !== null) && gl.blendFuncSeparate(last_blend_src_rgb, last_blend_src_alpha, last_blend_dst_rgb, last_blend_dst_alpha);
  gl && (last_enable_blend ? gl.enable(gl.BLEND) : gl.disable(gl.BLEND));
  gl && (last_enable_cull_face ? gl.enable(gl.CULL_FACE) : gl.disable(gl.CULL_FACE));
  gl && (last_enable_depth_test ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST));
  gl && (last_enable_scissor_test ? gl.enable(gl.SCISSOR_TEST) : gl.disable(gl.SCISSOR_TEST));
  // glPolygonMode(GL_FRONT_AND_BACK, (GLenum)last_polygon_mode[0]);
  gl && (last_viewport !== null) && gl.viewport(last_viewport[0], last_viewport[1], last_viewport[2], last_viewport[3]);
  gl && (last_scissor_box !== null) && gl.scissor(last_scissor_box[0], last_scissor_box[1], last_scissor_box[2], last_scissor_box[3]);
}

export function CreateFontsTexture (): void {
  const io = ImGui.GetIO();

  // Backup GL state
  const last_texture: WebGLTexture | null = gl && gl.getParameter(gl.TEXTURE_BINDING_2D);

  // Build texture atlas
  // const width: number = 256;
  // const height: number = 256;
  // const pixels: Uint8Array = new Uint8Array(4 * width * height).fill(0xff);
  const { width, height, pixels } = io.Fonts.GetTexDataAsRGBA32();   // Load as RGBA 32-bits (75% of the memory is wasted, but default font is so small) because it is more likely to be compatible with user's existing shaders. If your ImTextureId represent a higher-level concept than just a GL texture id, consider calling GetTexDataAsAlpha8() instead to save on GPU memory.
  // console.log(`font texture ${width} x ${height} @ ${pixels.length}`);

  // Upload texture to graphics system
  g_FontTexture = gl && gl.createTexture();
  gl && gl.bindTexture(gl.TEXTURE_2D, g_FontTexture);
  gl && gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl && gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // gl && gl.pixelStorei(gl.UNPACK_ROW_LENGTH); // WebGL2
  gl && gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // Store our identifier
  io.Fonts.TexID = g_FontTexture || { foo: 'bar' };
  // console.log("font texture id", g_FontTexture);

  if (ctx) {
    const image_canvas: HTMLCanvasElement = document.createElement('canvas');

    image_canvas.width = width;
    image_canvas.height = height;
    const image_ctx = image_canvas.getContext('2d');

    if (image_ctx === null) { throw new Error(); }
    const image_data = image_ctx.getImageData(0, 0, width, height);

    image_data.data.set(pixels);
    image_ctx.putImageData(image_data, 0, 0);
    io.Fonts.TexID = image_canvas;
  }

  // Restore modified GL state
  gl && last_texture && gl.bindTexture(gl.TEXTURE_2D, last_texture);
}

export function DestroyFontsTexture (): void {
  const io = ImGui.GetIO();

  io.Fonts.TexID = null;
  gl && gl.deleteTexture(g_FontTexture); g_FontTexture = null;
}

export function CreateDeviceObjects (): void {
  const vertex_shader: string[] = [
    'uniform mat4 ProjMtx;',
    'attribute vec2 Position;',
    'attribute vec2 UV;',
    'attribute vec4 Color;',
    'varying vec2 Frag_UV;',
    'varying vec4 Frag_Color;',
    'void main() {',
    '	Frag_UV = UV;',
    '	Frag_Color = Color;',
    '	gl_Position = ProjMtx * vec4(Position.xy,0,1);',
    '}',
  ];

  const fragment_shader: string[] = [
    'precision mediump float;', // WebGL requires precision specifiers
    'uniform sampler2D Texture;',
    'varying vec2 Frag_UV;',
    'varying vec4 Frag_Color;',
    'void main() {',
    '	gl_FragColor = Frag_Color * texture2D(Texture, Frag_UV);',
    '}',
  ];

  g_ShaderHandle = gl && gl.createProgram();
  g_VertHandle = gl && gl.createShader(gl.VERTEX_SHADER);
  g_FragHandle = gl && gl.createShader(gl.FRAGMENT_SHADER);
  gl && gl.shaderSource(g_VertHandle, vertex_shader.join('\n'));
  gl && gl.shaderSource(g_FragHandle, fragment_shader.join('\n'));
  gl && gl.compileShader(g_VertHandle);
  gl && gl.compileShader(g_FragHandle);
  gl && gl.attachShader(g_ShaderHandle, g_VertHandle);
  gl && gl.attachShader(g_ShaderHandle, g_FragHandle);
  gl && gl.linkProgram(g_ShaderHandle);

  g_AttribLocationTex = gl && gl.getUniformLocation(g_ShaderHandle, 'Texture');
  g_AttribLocationProjMtx = gl && gl.getUniformLocation(g_ShaderHandle, 'ProjMtx');
  g_AttribLocationPosition = gl && gl.getAttribLocation(g_ShaderHandle, 'Position') || 0;
  g_AttribLocationUV = gl && gl.getAttribLocation(g_ShaderHandle, 'UV') || 0;
  g_AttribLocationColor = gl && gl.getAttribLocation(g_ShaderHandle, 'Color') || 0;

  g_VboHandle = gl && gl.createBuffer();
  g_ElementsHandle = gl && gl.createBuffer();

  CreateFontsTexture();
}

export function DestroyDeviceObjects (): void {
  DestroyFontsTexture();

  gl && gl.deleteBuffer(g_VboHandle); g_VboHandle = null;
  gl && gl.deleteBuffer(g_ElementsHandle); g_ElementsHandle = null;

  g_AttribLocationTex = null;
  g_AttribLocationProjMtx = null;
  g_AttribLocationPosition = -1;
  g_AttribLocationUV = -1;
  g_AttribLocationColor = -1;

  gl && gl.deleteProgram(g_ShaderHandle); g_ShaderHandle = null;
  gl && gl.deleteShader(g_VertHandle); g_VertHandle = null;
  gl && gl.deleteShader(g_FragHandle); g_FragHandle = null;
}
