/* eslint-disable no-multi-spaces */
/* eslint-disable no-console */
import { GalaceanEffects } from './ge';
import { ImGui, ImGui_Impl } from './imgui/index';
import { ShowDemoWindow } from './imgui/imgui_demo';
import { MemoryEditor } from './imgui/imgui_memory_editor';
import './panels';
import './custom-editors';
import { imGuiIni } from './imgui/imgui-config';
import { uiManager } from './core/ui-manager';
import { Project } from './panels';

let font: ImGui.Font | null = null;

// Our state
let show_demo_window: boolean = true;
let show_another_window: boolean = false;
// const clear_color: ImGui.Vec4 = new ImGui.Vec4(0.45, 0.55, 0.60, 1.0);
const clear_color: ImGui.Vec4 = new ImGui.Vec4(0.25, 0.25, 0.25, 0);

const memory_editor: MemoryEditor = new MemoryEditor();

memory_editor.Open = false;

let show_sandbox_window: boolean = false;
let show_gamepad_window: boolean = false;
let show_movie_window: boolean = false;

/* static */ let f: number = 0.0;
/* static */ let counter: number = 0;

let done: boolean = false;

async function LoadArrayBuffer (url: string): Promise<ArrayBuffer> {
  const response: Response = await fetch(url);

  return response.arrayBuffer();
}

async function main (): Promise<void> {
  await ImGui.default();
  if (typeof (window) !== 'undefined') {
    window.requestAnimationFrame(_init);
  } else {
    // eslint-disable-next-line no-inner-declarations
    async function _main (): Promise<void> {
      await _init();
      for (let i = 0; i < 3; ++i) { _loop(1 / 60); }
      await _done();
    }
    _main().catch(console.error);
  }
}

void main();

async function AddFontFromFileTTF (url: string, size_pixels: number, font_cfg: ImGui.FontConfig | null = null, glyph_ranges: number | null = null): Promise<ImGui.Font> {
  font_cfg = font_cfg || new ImGui.FontConfig();
  // eslint-disable-next-line no-useless-escape
  font_cfg.Name = font_cfg.Name || `${url.split(/[\\\/]/).pop()}, ${size_pixels.toFixed(0)}px`;

  return ImGui.GetIO().Fonts.AddFontFromMemoryTTF(await LoadArrayBuffer(url), size_pixels, font_cfg, glyph_ranges);
}

async function _init (): Promise<void> {
  // const EMSCRIPTEN_VERSION = `${ImGui.bind.__EMSCRIPTEN_major__}.${ImGui.bind.__EMSCRIPTEN_minor__}.${ImGui.bind.__EMSCRIPTEN_tiny__}`;

  // console.log('Emscripten Version', EMSCRIPTEN_VERSION);

  console.log('Total allocated space (uordblks) @ _init:', ImGui.bind.mallinfo().uordblks);

  if (!window.localStorage.getItem('imgui.ini')) {
    window.localStorage.setItem('imgui.ini', imGuiIni);
  }

  // Setup Dear ImGui context
  ImGui.CHECKVERSION();
  ImGui.CreateContext();
  const io: ImGui.IO = ImGui.GetIO();

  //io.ConfigFlags |= ImGui.ConfigFlags.NavEnableKeyboard;     // Enable Keyboard Controls
  //io.ConfigFlags |= ImGui.ConfigFlags.NavEnableGamepad;      // Enable Gamepad Controls
  io.ConfigFlags |= ImGui.ConfigFlags.DockingEnable;  // Enable Docking
  io.ConfigDockingAlwaysTabBar = true;
  io.ConfigWindowsMoveFromTitleBarOnly = true;

  // Setup Dear ImGui style
  // ImGui.StyleColorsDark();
  // ImGui.StyleColorsClassic();
  // embraceTheDarkness();
  // SoDark(0.548);
  styleBlack();

  // Load Fonts
  // - If no fonts are loaded, dear imgui will use the default font. You can also load multiple fonts and use ImGui::PushFont()/PopFont() to select them.
  // - AddFontFromFileTTF() will return the ImFont* so you can store it if you need to select the font among multiple.
  // - If the file cannot be loaded, the function will return NULL. Please handle those errors in your application (e.g. use an assertion, or display an error and quit).
  // - The fonts will be rasterized at a given size (w/ oversampling) and stored into a texture when calling ImFontAtlas::Build()/GetTexDataAsXXXX(), which ImGui_ImplXXXX_NewFrame below will call.
  // - Read 'docs/FONTS.md' for more instructions and details.
  // - Remember that in C/C++ if you want to include a backslash \ in a string literal you need to write a double backslash \\ !
  // io.Fonts.AddFontDefault();
  // font = await AddFontFromFileTTF('./public/fonts/Roboto-Medium.ttf', 16.0);
  // font = await AddFontFromFileTTF("./public/fonts/Cousine-Regular.ttf", 15.0);
  // font = await AddFontFromFileTTF("./public/fonts/DroidSans.ttf", 16.0);
  // font = await AddFontFromFileTTF("./public/fonts/ProggyTiny.ttf", 10.0);
  // font = await AddFontFromFileTTF('./public/fonts/Arial.ttf', 16.0);

  const fontConfig = new ImGui.FontConfig();

  fontConfig.internal.OversampleH = 3;
  fontConfig.internal.OversampleV = 3;
  font = await AddFontFromFileTTF('./Alibaba-PuHuiTi-Regular.ttf', 44, fontConfig, io.Fonts.GetGlyphRangesChineseSimplifiedCommon());
  // font = await AddFontFromFileTTF("https://raw.githubusercontent.com/googlei18n/noto-cjk/master/NotoSansJP-Regular.otf", 18.0, null, io.Fonts.GetGlyphRangesJapanese());
  ImGui.ASSERT(font !== null);
  font.Scale = 0.45;

  // Setup Platform/Renderer backends
  // ImGui_ImplSDL2_InitForOpenGL(window, gl_context);
  // ImGui_ImplOpenGL3_Init(glsl_version);
  if (typeof (window) !== 'undefined') {
    const output: HTMLElement = document.getElementById('output') || document.body;
    const canvas: HTMLCanvasElement = document.createElement('canvas');

    output.appendChild(canvas);
    canvas.tabIndex = 1;
    canvas.style.position = 'absolute';
    canvas.style.left = '0px';
    canvas.style.right = '0px';
    canvas.style.top = '0px';
    canvas.style.bottom = '0px';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.userSelect = 'none';

    canvas.addEventListener('dragover', Project.allowDrop);
    canvas.addEventListener('drop', Project.drop);

    ImGui_Impl.Init(canvas);
  } else {
    ImGui_Impl.Init(null);
  }

  uiManager.createWindows();
  await GalaceanEffects.initialize();

  StartUpImage();
  StartUpVideo();

  if (typeof (window) !== 'undefined') {
    window.requestAnimationFrame(_loop);
  }
}

// Main loop
function _loop (time: number): void {
  // Poll and handle events (inputs, window resize, etc.)
  // You can read the io.WantCaptureMouse, io.WantCaptureKeyboard flags to tell if dear imgui wants to use your inputs.
  // - When io.WantCaptureMouse is true, do not dispatch mouse input data to your main application.
  // - When io.WantCaptureKeyboard is true, do not dispatch keyboard input data to your main application.
  // Generally you may always pass all inputs to dear imgui, and hide them from your application based on those two flags.

  // Start the Dear ImGui frame
  ImGui_Impl.NewFrame(time);
  ImGui.NewFrame();

  ImGui.DockSpaceOverMainViewport();

  // 1. Show the big demo window (Most of the sample code is in ImGui::ShowDemoWindow()! You can browse its code to learn more about Dear ImGui!).
  if (!done && show_demo_window) {
    done = /*ImGui.*/ShowDemoWindow((value = show_demo_window) => show_demo_window = value);
  }

  // 2. Show a simple window that we create ourselves. We use a Begin/End pair to created a named window.
  {
    // static float f = 0.0;
    // static int counter = 0;

    ImGui.Begin('Hello, world!');                          // Create a window called "Hello, world!" and append into it.

    ImGui.Text('This is some useful text.');               // Display some text (you can use a format strings too)
    ImGui.Checkbox('Demo Window', (value = show_demo_window) => show_demo_window = value);      // Edit bools storing our windows open/close state
    ImGui.Checkbox('Another Window', (value = show_another_window) => show_another_window = value);

    ImGui.SliderFloat('float', (value = f) => f = value, 0.0, 1.0);            // Edit 1 float using a slider from 0.0f to 1.0f
    ImGui.ColorEdit3('clear color', clear_color); // Edit 3 floats representing a color

    if (ImGui.Button('Button')) {                       // Buttons return true when clicked (NB: most widgets return true when edited/activated)
      counter++;
    }
    ImGui.SameLine();
    ImGui.Text(`counter = ${counter}`);

    ImGui.Text(`Application average ${(1000.0 / ImGui.GetIO().Framerate).toFixed(3)} ms/frame (${ImGui.GetIO().Framerate.toFixed(1)} FPS)`);

    ImGui.Checkbox('Memory Editor', (value = memory_editor.Open) => memory_editor.Open = value);
    if (memory_editor.Open) { memory_editor.DrawWindow('Memory Editor', ImGui.bind.HEAP8.buffer); }
    const mi: ImGui.Bind.mallinfo = ImGui.bind.mallinfo();

    // ImGui.Text(`Total non-mmapped bytes (arena):       ${mi.arena}`);
    // ImGui.Text(`# of free chunks (ordblks):            ${mi.ordblks}`);
    // ImGui.Text(`# of free fastbin blocks (smblks):     ${mi.smblks}`);
    // ImGui.Text(`# of mapped regions (hblks):           ${mi.hblks}`);
    // ImGui.Text(`Bytes in mapped regions (hblkhd):      ${mi.hblkhd}`);
    ImGui.Text(`Max. total allocated space (usmblks):  ${mi.usmblks}`);
    // ImGui.Text(`Free bytes held in fastbins (fsmblks): ${mi.fsmblks}`);
    ImGui.Text(`Total allocated space (uordblks):      ${mi.uordblks}`);
    ImGui.Text(`Total free space (fordblks):           ${mi.fordblks}`);
    // ImGui.Text(`Topmost releasable block (keepcost):   ${mi.keepcost}`);
    if (ImGui.ImageButton(image_gl_texture, new ImGui.Vec2(48, 48))) {
      // show_demo_window = !show_demo_window;
      image_url = image_urls[(image_urls.indexOf(image_url) + 1) % image_urls.length];
      if (image_element) {
        image_element.src = image_url;
      }
    }
    if (ImGui.IsItemHovered()) {
      ImGui.BeginTooltip();
      ImGui.Text(image_url);
      ImGui.EndTooltip();
    }
    if (ImGui.Button('Sandbox Window')) { show_sandbox_window = true; }
    if (show_sandbox_window) { ShowSandboxWindow('Sandbox Window', (value = show_sandbox_window) => show_sandbox_window = value); }
    ImGui.SameLine();
    if (ImGui.Button('Gamepad Window')) { show_gamepad_window = true; }
    if (show_gamepad_window) { ShowGamepadWindow('Gamepad Window', (value = show_gamepad_window) => show_gamepad_window = value); }
    ImGui.SameLine();
    if (ImGui.Button('Movie Window')) { show_movie_window = true; }
    if (show_movie_window) { ShowMovieWindow('Movie Window', (value = show_movie_window) => show_movie_window = value); }

    if (font) {
      ImGui.PushFont(font);
      ImGui.Text(`${font.GetDebugName()}`);
      if (font.FindGlyphNoFallback(0x5929)) {
        ImGui.Text('U+5929: \u5929');
      }
      ImGui.PopFont();
    }

    ImGui.End();
  }

  // 3. Show another simple window.
  if (show_another_window) {
    ImGui.Begin('Another Window', (value = show_another_window) => show_another_window = value, ImGui.WindowFlags.AlwaysAutoResize);
    ImGui.Text('Hello from another window!');
    if (ImGui.Button('Close Me')) { show_another_window = false; }
    ImGui.End();
  }

  uiManager.draw();

  ImGui.EndFrame();

  // Rendering
  ImGui.Render();
  const gl: WebGLRenderingContext | null = ImGui_Impl.gl;

  if (gl) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(clear_color.x, clear_color.y, clear_color.z, clear_color.w);
    gl.clear(gl.COLOR_BUFFER_BIT);
    //gl.useProgram(0); // You may want this if using this code in an OpenGL 3+ context where shaders may be bound
  }

  const ctx: CanvasRenderingContext2D | null = ImGui_Impl.ctx;

  if (ctx) {
    // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = `rgba(${clear_color.x * 0xff}, ${clear_color.y * 0xff}, ${clear_color.z * 0xff}, ${clear_color.w})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  UpdateVideo();

  ImGui_Impl.RenderDrawData(ImGui.GetDrawData());

  if (typeof (window) !== 'undefined') {
    window.requestAnimationFrame(done ? _done : _loop);
  }
}

async function _done (): Promise<void> {
  const gl: WebGLRenderingContext | null = ImGui_Impl.gl;

  if (gl) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(clear_color.x, clear_color.y, clear_color.z, clear_color.w);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  const ctx: CanvasRenderingContext2D | null = ImGui_Impl.ctx;

  if (ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  CleanUpImage();
  CleanUpVideo();

  // Cleanup
  ImGui_Impl.Shutdown();
  ImGui.DestroyContext();

  console.log('Total allocated space (uordblks) @ _done:', ImGui.bind.mallinfo().uordblks);
}

function ShowHelpMarker (desc: string): void {
  ImGui.TextDisabled('(?)');
  if (ImGui.IsItemHovered()) {
    ImGui.BeginTooltip();
    ImGui.PushTextWrapPos(ImGui.GetFontSize() * 35.0);
    ImGui.TextUnformatted(desc);
    ImGui.PopTextWrapPos();
    ImGui.EndTooltip();
  }
}

let source: string = [
  'ImGui.Text("Hello, world!");',
  'ImGui.SliderFloat("float",',
  '\t(value = f) => f = value,',
  '\t0.0, 1.0);',
  '',
].join('\n');

function ShowSandboxWindow (title: string, p_open: ImGui.Access<boolean> | null = null): void {
  ImGui.SetNextWindowSize(new ImGui.Vec2(320, 240), ImGui.Cond.FirstUseEver);
  ImGui.Begin(title, p_open);
  ImGui.Text('Source');
  ImGui.SameLine(); ShowHelpMarker('Contents evaluated and appended to the window.');
  ImGui.PushItemWidth(-1);
  ImGui.InputTextMultiline('##source', (_ = source) => (source = _), 1024, ImGui.Vec2.ZERO, ImGui.InputTextFlags.AllowTabInput);
  ImGui.PopItemWidth();
  try {
    eval(source);
  } catch (e: any) {
    ImGui.TextColored(new ImGui.Vec4(1.0, 0.0, 0.0, 1.0), 'error: ');
    ImGui.SameLine();
    ImGui.Text(e.message);
  }
  ImGui.End();
}

function ShowGamepadWindow (title: string, p_open: ImGui.Access<boolean> | null = null): void {
  ImGui.Begin(title, p_open, ImGui.WindowFlags.AlwaysAutoResize);
  const gamepads: (Gamepad | null)[] = (typeof (navigator) !== 'undefined' && typeof (navigator.getGamepads) === 'function') ? navigator.getGamepads() : [];

  if (gamepads.length > 0) {
    for (let i = 0; i < gamepads.length; ++i) {
      const gamepad: Gamepad | null = gamepads[i];

      ImGui.Text(`gamepad ${i} ${gamepad && gamepad.id}`);
      if (!gamepad) { continue; }
      ImGui.Text('       ');
      for (let button = 0; button < gamepad.buttons.length; ++button) {
        ImGui.SameLine(); ImGui.Text(`${button.toString(16)}`);
      }
      ImGui.Text('buttons');
      for (let button = 0; button < gamepad.buttons.length; ++button) {
        ImGui.SameLine(); ImGui.Text(`${gamepad.buttons[button].value}`);
      }
      ImGui.Text('axes');
      for (let axis = 0; axis < gamepad.axes.length; ++axis) {
        ImGui.Text(`${axis}: ${gamepad.axes[axis].toFixed(2)}`);
      }
    }
  } else {
    ImGui.Text('connect a gamepad');
  }
  ImGui.End();
}

const image_urls: string[] = [
  'https://threejs.org/examples/textures/crate.gif',
  'https://threejs.org/examples/textures/sprite.png',
  'https://threejs.org/examples/textures/uv_grid_opengl.jpg',
];
let image_url: string = image_urls[0];
let image_element: HTMLImageElement | null = null;
let image_gl_texture: WebGLTexture | null = null;

function StartUpImage (): void {
  if (typeof document !== 'undefined') {
    image_element = document.createElement('img');
    image_element.crossOrigin = 'anonymous';
    image_element.src = image_url;
  }

  const gl: WebGLRenderingContext | null = ImGui_Impl.gl;

  if (gl) {
    const width: number = 256;
    const height: number = 256;
    const pixels: Uint8Array = new Uint8Array(4 * width * height);

    image_gl_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, image_gl_texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    if (image_element) {
      image_element.addEventListener('load', (event: Event) => {
        if (image_element) {
          gl.bindTexture(gl.TEXTURE_2D, image_gl_texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image_element);
        }
      });
    }
  }

  const ctx: CanvasRenderingContext2D | null = ImGui_Impl.ctx;

  if (ctx) {
    image_gl_texture = image_element; // HACK
  }
}

function CleanUpImage (): void {
  const gl: WebGLRenderingContext | null = ImGui_Impl.gl;

  if (gl) {
    gl.deleteTexture(image_gl_texture); image_gl_texture = null;
  }

  const ctx: CanvasRenderingContext2D | null = ImGui_Impl.ctx;

  if (ctx) {
    image_gl_texture = null;
  }

  image_element = null;
}

const video_urls: string[] = [
  'https://threejs.org/examples/textures/sintel.ogv',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
];
let video_url: string = video_urls[0];
let video_element: HTMLVideoElement | null = null;
let video_gl_texture: WebGLTexture | null = null;
let video_w: number = 640;
let video_h: number = 360;
let video_time_active: boolean = false;
let video_time: number = 0;
let video_duration: number = 0;

function StartUpVideo (): void {
  if (typeof document !== 'undefined') {
    video_element = document.createElement('video');
    video_element.crossOrigin = 'anonymous';
    video_element.preload = 'auto';
    video_element.src = video_url;
    video_element.load();
  }

  const gl: WebGLRenderingContext | null = ImGui_Impl.gl;

  if (gl) {
    const width: number = 256;
    const height: number = 256;
    const pixels: Uint8Array = new Uint8Array(4 * width * height);

    video_gl_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, video_gl_texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  }

  const ctx: CanvasRenderingContext2D | null = ImGui_Impl.ctx;

  if (ctx) {
    video_gl_texture = video_element; // HACK
  }
}

function CleanUpVideo (): void {
  const gl: WebGLRenderingContext | null = ImGui_Impl.gl;

  if (gl) {
    gl.deleteTexture(video_gl_texture); video_gl_texture = null;
  }

  const ctx: CanvasRenderingContext2D | null = ImGui_Impl.ctx;

  if (ctx) {
    video_gl_texture = null;
  }

  video_element = null;
}

function UpdateVideo (): void {
  const gl: WebGLRenderingContext | null = ImGui_Impl.gl;

  if (gl && video_element && video_element.readyState >= video_element.HAVE_CURRENT_DATA) {
    gl.bindTexture(gl.TEXTURE_2D, video_gl_texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video_element);
  }
}

function ShowMovieWindow (title: string, p_open: ImGui.Access<boolean> | null = null): void {
  ImGui.Begin(title, p_open, ImGui.WindowFlags.AlwaysAutoResize);
  if (video_element !== null) {
    if (p_open && !p_open()) {
      video_element.pause();
    }
    const w: number = video_element.videoWidth;
    const h: number = video_element.videoHeight;

    if (w > 0) { video_w = w; }
    if (h > 0) { video_h = h; }

    ImGui.BeginGroup();
    if (ImGui.BeginCombo('##urls', null, ImGui.ComboFlags.NoPreview | ImGui.ComboFlags.PopupAlignLeft)) {
      for (let n = 0; n < ImGui.ARRAYSIZE(video_urls); n++) {
        if (ImGui.Selectable(video_urls[n])) {
          video_url = video_urls[n];
          console.log(video_url);
          video_element.src = video_url;
          video_element.autoplay = true;
        }
      }
      ImGui.EndCombo();
    }
    ImGui.SameLine();
    ImGui.PushItemWidth(video_w - 20);
    if (ImGui.InputText('##url', (value = video_url) => video_url = value)) {
      console.log(video_url);
      video_element.src = video_url;
    }
    ImGui.PopItemWidth();
    ImGui.EndGroup();

    if (ImGui.ImageButton(video_gl_texture, new ImGui.Vec2(video_w, video_h))) {
      if (video_element.readyState >= video_element.HAVE_CURRENT_DATA) {
        void (video_element.paused ? video_element.play() : video_element.pause());
      }
    }

    ImGui.BeginGroup();
    if (ImGui.Button(video_element.paused ? 'Play' : 'Stop')) {
      if (video_element.readyState >= video_element.HAVE_CURRENT_DATA) {
        void (video_element.paused ? video_element.play() : video_element.pause());
      }
    }
    ImGui.SameLine();
    if (!video_time_active) {
      video_time = video_element.currentTime;
      video_duration = video_element.duration || 0;
    }
    ImGui.SliderFloat('##time', (value = video_time) => video_time = value, 0, video_duration);
    const video_time_was_active: boolean = video_time_active;

    video_time_active = ImGui.IsItemActive();
    if (!video_time_active && video_time_was_active) {
      video_element.currentTime = video_time;
    }
    ImGui.EndGroup();
  } else {
    ImGui.Text('No Video Element');
  }
  ImGui.End();
}

function embraceTheDarkness () {
  const colors = ImGui.GetStyle().Colors;

  colors[ImGui.ImGuiCol.Text]                   = new ImGui.ImVec4(1.00, 1.00, 1.00, 1.00);
  colors[ImGui.ImGuiCol.TextDisabled]           = new ImGui.ImVec4(0.50, 0.50, 0.50, 1.00);
  colors[ImGui.ImGuiCol.WindowBg]               = new ImGui.ImVec4(0.10, 0.10, 0.10, 1.00);
  colors[ImGui.ImGuiCol.ChildBg]                = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.00);
  colors[ImGui.ImGuiCol.PopupBg]                = new ImGui.ImVec4(0.19, 0.19, 0.19, 0.92);
  colors[ImGui.ImGuiCol.Border]                 = new ImGui.ImVec4(0.19, 0.19, 0.19, 0.29);
  colors[ImGui.ImGuiCol.BorderShadow]           = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.24);
  colors[ImGui.ImGuiCol.FrameBg]                = new ImGui.ImVec4(0.05, 0.05, 0.05, 0.54);
  colors[ImGui.ImGuiCol.FrameBgHovered]         = new ImGui.ImVec4(0.19, 0.19, 0.19, 0.54);
  colors[ImGui.ImGuiCol.FrameBgActive]          = new ImGui.ImVec4(0.20, 0.22, 0.23, 1.00);
  colors[ImGui.ImGuiCol.TitleBg]                = new ImGui.ImVec4(0.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.TitleBgActive]          = new ImGui.ImVec4(0.06, 0.06, 0.06, 1.00);
  colors[ImGui.ImGuiCol.TitleBgCollapsed]       = new ImGui.ImVec4(0.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.MenuBarBg]              = new ImGui.ImVec4(0.14, 0.14, 0.14, 1.00);
  colors[ImGui.ImGuiCol.ScrollbarBg]            = new ImGui.ImVec4(0.05, 0.05, 0.05, 0.54);
  colors[ImGui.ImGuiCol.ScrollbarGrab]          = new ImGui.ImVec4(0.34, 0.34, 0.34, 0.54);
  colors[ImGui.ImGuiCol.ScrollbarGrabHovered]   = new ImGui.ImVec4(0.40, 0.40, 0.40, 0.54);
  colors[ImGui.ImGuiCol.ScrollbarGrabActive]    = new ImGui.ImVec4(0.56, 0.56, 0.56, 0.54);
  colors[ImGui.ImGuiCol.CheckMark]              = new ImGui.ImVec4(0.33, 0.67, 0.86, 1.00);
  colors[ImGui.ImGuiCol.SliderGrab]             = new ImGui.ImVec4(0.34, 0.34, 0.34, 0.54);
  colors[ImGui.ImGuiCol.SliderGrabActive]       = new ImGui.ImVec4(0.56, 0.56, 0.56, 0.54);
  colors[ImGui.ImGuiCol.Button]                 = new ImGui.ImVec4(0.05, 0.05, 0.05, 0.54);
  colors[ImGui.ImGuiCol.ButtonHovered]          = new ImGui.ImVec4(0.19, 0.19, 0.19, 0.54);
  colors[ImGui.ImGuiCol.ButtonActive]           = new ImGui.ImVec4(0.20, 0.22, 0.23, 1.00);
  colors[ImGui.ImGuiCol.Header]                 = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.HeaderHovered]          = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.36);
  colors[ImGui.ImGuiCol.HeaderActive]           = new ImGui.ImVec4(0.20, 0.22, 0.23, 0.33);
  colors[ImGui.ImGuiCol.Separator]              = new ImGui.ImVec4(0.28, 0.28, 0.28, 0.29);
  colors[ImGui.ImGuiCol.SeparatorHovered]       = new ImGui.ImVec4(0.44, 0.44, 0.44, 0.29);
  colors[ImGui.ImGuiCol.SeparatorActive]        = new ImGui.ImVec4(0.40, 0.44, 0.47, 1.00);
  colors[ImGui.ImGuiCol.ResizeGrip]             = new ImGui.ImVec4(0.28, 0.28, 0.28, 0.29);
  colors[ImGui.ImGuiCol.ResizeGripHovered]      = new ImGui.ImVec4(0.44, 0.44, 0.44, 0.29);
  colors[ImGui.ImGuiCol.ResizeGripActive]       = new ImGui.ImVec4(0.40, 0.44, 0.47, 1.00);
  colors[ImGui.ImGuiCol.Tab]                    = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.TabHovered]             = new ImGui.ImVec4(0.14, 0.14, 0.14, 1.00);
  colors[ImGui.ImGuiCol.TabActive]              = new ImGui.ImVec4(0.20, 0.20, 0.20, 0.36);
  colors[ImGui.ImGuiCol.TabUnfocused]           = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.TabUnfocusedActive]     = new ImGui.ImVec4(0.14, 0.14, 0.14, 1.00);
  // colors[ImGui.ImGuiCol.DockingPreview]         = new ImGui.ImVec4(0.33, 0.67, 0.86, 1.00);
  // colors[ImGui.ImGuiCol.DockingEmptyBg]         = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotLines + 2]              = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotLinesHovered + 2]       = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotHistogram + 2]          = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotHistogramHovered + 2]   = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.TableHeaderBg + 2]          = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.TableBorderStrong + 2]      = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.TableBorderLight + 2]       = new ImGui.ImVec4(0.28, 0.28, 0.28, 0.29);
  colors[ImGui.ImGuiCol.TableRowBg + 2]             = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.00);
  colors[ImGui.ImGuiCol.TableRowBgAlt + 2]          = new ImGui.ImVec4(1.00, 1.00, 1.00, 0.06);
  colors[ImGui.ImGuiCol.TextSelectedBg + 2]         = new ImGui.ImVec4(0.20, 0.22, 0.23, 1.00);
  colors[ImGui.ImGuiCol.DragDropTarget + 2]         = new ImGui.ImVec4(0.33, 0.67, 0.86, 1.00);
  colors[ImGui.ImGuiCol.NavHighlight + 2]           = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.NavWindowingHighlight + 2]  = new ImGui.ImVec4(1.00, 0.00, 0.00, 0.70);
  colors[ImGui.ImGuiCol.NavWindowingDimBg + 2]      = new ImGui.ImVec4(1.00, 0.00, 0.00, 0.20);
  colors[ImGui.ImGuiCol.ModalWindowDimBg + 2]       = new ImGui.ImVec4(1.00, 0.00, 0.00, 0.35);

  const style = ImGui.GetStyle();

  // style.internal.WindowPadding                     = new ImGui.ImVec2(8.00, 8.00);
  // //@ts-expect-error
  // style.internal.FramePadding                      = new ImGui.ImVec2(5.00, 2.00);
  // //@ts-expect-error
  // style.internal.CellPadding                       = new ImGui.ImVec2(6.00, 6.00);
  // //@ts-expect-error
  // style.internal.ItemSpacing                       = new ImGui.ImVec2(6.00, 6.00);
  // //@ts-expect-error
  // style.internal.ItemInnerSpacing                  = new ImGui.ImVec2(6.00, 6.00);
  // //@ts-expect-error
  // style.internal.TouchExtraPadding                 = new ImGui.ImVec2(0.00, 0.00);
  style.IndentSpacing                     = 25;
  style.ScrollbarSize                     = 15;
  style.GrabMinSize                       = 10;
  style.WindowBorderSize                  = 1;
  style.ChildBorderSize                   = 1;
  style.PopupBorderSize                   = 1;
  style.FrameBorderSize                   = 1;
  style.TabBorderSize                     = 1;
  style.WindowRounding                    = 7;
  style.ChildRounding                     = 4;
  style.FrameRounding                     = 3;
  style.PopupRounding                     = 4;
  style.ScrollbarRounding                 = 9;
  style.GrabRounding                      = 3;
  style.LogSliderDeadzone                 = 4;
  style.TabRounding                       = 4;
}

function SoDark (hue: number) {
  const style = ImGui.GetStyle();
  const colors = style.Colors;

  colors[ImGui.ImGuiCol.Text]                   = new ImGui.ImVec4(1.00, 1.00, 1.00, 1.00);
  colors[ImGui.ImGuiCol.TextDisabled]           = new ImGui.ImVec4(0.50, 0.50, 0.50, 1.00);
  colors[ImGui.ImGuiCol.WindowBg]               = new ImGui.ImVec4(0.10, 0.10, 0.10, 1.00);
  colors[ImGui.ImGuiCol.ChildBg]                = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.00);
  colors[ImGui.ImGuiCol.PopupBg]                = new ImGui.ImVec4(0.19, 0.19, 0.19, 0.92);
  colors[ImGui.ImGuiCol.Border]                 = new ImGui.ImVec4(0.2, 0.2, 0.2, 0.6);
  // colors[ImGui.ImGuiCol.BorderShadow]           = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.24);
  colors[ImGui.ImGuiCol.FrameBg]                = new ImGui.ImVec4(0.25, 0.25, 0.25, 0.54);
  colors[ImGui.ImGuiCol.FrameBgHovered]         = new ImGui.ImVec4(0.19, 0.19, 0.19, 0.54);
  colors[ImGui.ImGuiCol.FrameBgActive]          = new ImGui.ImVec4(0.20, 0.22, 0.23, 1.00);
  colors[ImGui.ImGuiCol.TitleBg]                = new ImGui.ImVec4(0.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.TitleBgActive]          = new ImGui.ImVec4(0.06, 0.06, 0.06, 1.00);
  colors[ImGui.ImGuiCol.TitleBgCollapsed]       = new ImGui.ImVec4(0.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.MenuBarBg]              = new ImGui.ImVec4(0.14, 0.14, 0.14, 1.00);
  colors[ImGui.ImGuiCol.ScrollbarBg]            = new ImGui.ImVec4(0.05, 0.05, 0.05, 0.54);
  colors[ImGui.ImGuiCol.ScrollbarGrab]          = new ImGui.ImVec4(0.34, 0.34, 0.34, 0.54);
  colors[ImGui.ImGuiCol.ScrollbarGrabHovered]   = new ImGui.ImVec4(0.40, 0.40, 0.40, 0.54);
  colors[ImGui.ImGuiCol.ScrollbarGrabActive]    = new ImGui.ImVec4(0.56, 0.56, 0.56, 0.54);
  colors[ImGui.ImGuiCol.CheckMark]              = new ImGui.ImVec4(0.33, 0.67, 0.86, 1.00);
  colors[ImGui.ImGuiCol.SliderGrab]             = new ImGui.ImVec4(0.34, 0.34, 0.34, 0.54);
  colors[ImGui.ImGuiCol.SliderGrabActive]       = new ImGui.ImVec4(0.56, 0.56, 0.56, 0.54);
  colors[ImGui.ImGuiCol.Button]                 = new ImGui.ImVec4(0.30, 0.30, 0.30, 0.54);
  colors[ImGui.ImGuiCol.ButtonHovered]          = new ImGui.ImVec4(0.19, 0.19, 0.19, 0.54);
  colors[ImGui.ImGuiCol.ButtonActive]           = new ImGui.ImVec4(0.20, 0.22, 0.23, 1.00);
  colors[ImGui.ImGuiCol.Header]                 = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.HeaderHovered]          = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.36);
  colors[ImGui.ImGuiCol.HeaderActive]           = new ImGui.ImVec4(0.20, 0.22, 0.23, 0.33);
  colors[ImGui.ImGuiCol.Separator]              = new ImGui.ImVec4(0.28, 0.28, 0.28, 0.29);
  colors[ImGui.ImGuiCol.SeparatorHovered]       = new ImGui.ImVec4(0.44, 0.44, 0.44, 0.29);
  colors[ImGui.ImGuiCol.SeparatorActive]        = new ImGui.ImVec4(0.40, 0.44, 0.47, 1.00);
  colors[ImGui.ImGuiCol.ResizeGrip]             = new ImGui.ImVec4(0.28, 0.28, 0.28, 0.29);
  colors[ImGui.ImGuiCol.ResizeGripHovered]      = new ImGui.ImVec4(0.44, 0.44, 0.44, 0.29);
  colors[ImGui.ImGuiCol.ResizeGripActive]       = new ImGui.ImVec4(0.40, 0.44, 0.47, 1.00);
  colors[ImGui.ImGuiCol.Tab]                    = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.TabHovered]             = new ImGui.ImVec4(0.14, 0.14, 0.14, 1.00);
  colors[ImGui.ImGuiCol.TabActive]              = new ImGui.ImVec4(0.20, 0.20, 0.20, 0.36);
  colors[ImGui.ImGuiCol.TabUnfocused]           = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.TabUnfocusedActive]     = new ImGui.ImVec4(0.14, 0.14, 0.14, 1.00);
  // colors[ImGui.ImGuiCol.DockingPreview]         = new ImGui.ImVec4(0.33, 0.67, 0.86, 1.00);
  // colors[ImGui.ImGuiCol.DockingEmptyBg]         = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotLines + 2]              = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotLinesHovered + 2]       = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotHistogram + 2]          = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotHistogramHovered + 2]   = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.TableHeaderBg + 2]          = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.TableBorderStrong + 2]      = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.52);
  colors[ImGui.ImGuiCol.TableBorderLight + 2]       = new ImGui.ImVec4(0.28, 0.28, 0.28, 0.29);
  colors[ImGui.ImGuiCol.TableRowBg + 2]             = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.00);
  colors[ImGui.ImGuiCol.TableRowBgAlt + 2]          = new ImGui.ImVec4(1.00, 1.00, 1.00, 0.06);
  colors[ImGui.ImGuiCol.TextSelectedBg + 2]         = new ImGui.ImVec4(0.20, 0.22, 0.23, 1.00);
  colors[ImGui.ImGuiCol.DragDropTarget + 2]         = new ImGui.ImVec4(0.33, 0.67, 0.86, 1.00);
  colors[ImGui.ImGuiCol.NavHighlight + 2]           = new ImGui.ImVec4(1.00, 0.00, 0.00, 1.00);
  colors[ImGui.ImGuiCol.NavWindowingHighlight + 2]  = new ImGui.ImVec4(1.00, 0.00, 0.00, 0.70);
  colors[ImGui.ImGuiCol.NavWindowingDimBg + 2]      = new ImGui.ImVec4(1.00, 0.00, 0.00, 0.20);
  colors[ImGui.ImGuiCol.ModalWindowDimBg + 2]       = new ImGui.ImVec4(1.00, 0.00, 0.00, 0.35);

  // style.WindowPadding                     = new ImGui.ImVec2(8.00, 8.00);
  // style.FramePadding                      = new ImGui.ImVec2(5.00, 2.00);
  // style.CellPadding                       = new ImGui.ImVec2(6.00, 6.00);
  // style.ItemSpacing                       = new ImGui.ImVec2(6.00, 6.00);
  // style.ItemInnerSpacing                  = new ImGui.ImVec2(6.00, 6.00);
  // style.TouchExtraPadding                 = new ImGui.ImVec2(0.00, 0.00);
  style.IndentSpacing                     = 25;
  style.ScrollbarSize                     = 15;
  style.GrabMinSize                       = 10;
  style.WindowBorderSize                  = 1;
  style.ChildBorderSize                   = 1;
  style.PopupBorderSize                   = 1;
  // style.FrameBorderSize                   = 1;
  style.TabBorderSize                     = 1;
  style.WindowRounding                    = 7;
  style.ChildRounding                     = 4;
  style.FrameRounding                     = 3;
  style.PopupRounding                     = 4;
  style.ScrollbarRounding                 = 9;
  style.GrabRounding                      = 3;
  style.LogSliderDeadzone                 = 4;
  style.TabRounding                       = 4;

  ApplyHue(style, hue);

  return style;
}

function styleBlack () {
  const style = ImGui.GetStyle();
  const colors = style.Colors;

  // 基础文本颜色 - 更接近AE的浅灰色文本
  colors[ImGui.ImGuiCol.Text] = new ImGui.ImVec4(0.88, 0.88, 0.88, 1.00);
  colors[ImGui.ImGuiCol.TextDisabled] = new ImGui.ImVec4(0.45, 0.45, 0.45, 1.00);

  // 窗口背景 - 更深的背景色，模仿AE的深色调
  colors[ImGui.ImGuiCol.WindowBg] = new ImGui.ImVec4(0.09, 0.09, 0.09, 1.00);  // 更深的主背景
  colors[ImGui.ImGuiCol.ChildBg] = new ImGui.ImVec4(0.12, 0.12, 0.12, 1.00);   // 面板背景稍亮
  colors[ImGui.ImGuiCol.PopupBg] = new ImGui.ImVec4(0.14, 0.14, 0.14, 0.98);

  // 边框颜色 - 更微妙的边框，接近AE的分割线
  colors[ImGui.ImGuiCol.Border] = new ImGui.ImVec4(0.20, 0.20, 0.20, 0.80);
  colors[ImGui.ImGuiCol.BorderShadow] = new ImGui.ImVec4(0.00, 0.00, 0.00, 0.00);

  // 输入框和控件背景 - 更暗的输入框，类似AE
  colors[ImGui.ImGuiCol.FrameBg] = new ImGui.ImVec4(0.08, 0.08, 0.08, 1.00);    // 很暗的输入框背景
  colors[ImGui.ImGuiCol.FrameBgHovered] = new ImGui.ImVec4(0.15, 0.15, 0.15, 1.00);
  colors[ImGui.ImGuiCol.FrameBgActive] = new ImGui.ImVec4(0.18, 0.18, 0.18, 1.00);

  // 标题栏 - 与主窗口背景一致的深色
  colors[ImGui.ImGuiCol.TitleBg] = new ImGui.ImVec4(0.07, 0.07, 0.07, 1.00);
  colors[ImGui.ImGuiCol.TitleBgActive] = new ImGui.ImVec4(0.09, 0.09, 0.09, 1.00);
  colors[ImGui.ImGuiCol.TitleBgCollapsed] = new ImGui.ImVec4(0.05, 0.05, 0.05, 1.00);

  // 菜单栏背景 - 与面板一致
  colors[ImGui.ImGuiCol.MenuBarBg] = new ImGui.ImVec4(0.10, 0.10, 0.10, 1.00);

  // 滚动条 - 更精细的滚动条设计
  colors[ImGui.ImGuiCol.ScrollbarBg] = new ImGui.ImVec4(0.05, 0.05, 0.05, 0.70);
  colors[ImGui.ImGuiCol.ScrollbarGrab] = new ImGui.ImVec4(0.25, 0.25, 0.25, 1.00);
  colors[ImGui.ImGuiCol.ScrollbarGrabHovered] = new ImGui.ImVec4(0.35, 0.35, 0.35, 1.00);
  colors[ImGui.ImGuiCol.ScrollbarGrabActive] = new ImGui.ImVec4(0.45, 0.45, 0.45, 1.00);

  // 选择标记 - 使用AE风格的亮蓝色
  colors[ImGui.ImGuiCol.CheckMark] = new ImGui.ImVec4(0.30, 0.60, 1.00, 1.00);

  // 滑块控制 - 蓝色系
  colors[ImGui.ImGuiCol.SliderGrab] = new ImGui.ImVec4(0.28, 0.56, 0.90, 1.00);
  colors[ImGui.ImGuiCol.SliderGrabActive] = new ImGui.ImVec4(0.30, 0.60, 1.00, 1.00);

  // 按钮样式 - 更接近AE的按钮设计
  colors[ImGui.ImGuiCol.Button] = new ImGui.ImVec4(0.15, 0.15, 0.15, 0.90);
  colors[ImGui.ImGuiCol.ButtonHovered] = new ImGui.ImVec4(0.22, 0.22, 0.22, 1.00);
  colors[ImGui.ImGuiCol.ButtonActive] = new ImGui.ImVec4(0.10, 0.50, 0.90, 1.00);

  // 头部/列表项 - 模仿AE的列表选中效果
  colors[ImGui.ImGuiCol.Header] = new ImGui.ImVec4(0.15, 0.15, 0.15, 0.85);
  colors[ImGui.ImGuiCol.HeaderHovered] = new ImGui.ImVec4(0.20, 0.20, 0.20, 1.00);
  colors[ImGui.ImGuiCol.HeaderActive] = new ImGui.ImVec4(0.20, 0.45, 0.85, 1.00);  // 蓝色选中

  // 分隔线 - 更微妙的分割效果
  colors[ImGui.ImGuiCol.Separator] = new ImGui.ImVec4(0.22, 0.22, 0.22, 0.60);
  colors[ImGui.ImGuiCol.SeparatorHovered] = new ImGui.ImVec4(0.35, 0.35, 0.35, 0.80);
  colors[ImGui.ImGuiCol.SeparatorActive] = new ImGui.ImVec4(0.30, 0.60, 1.00, 1.00);

  // 调整大小手柄
  colors[ImGui.ImGuiCol.ResizeGrip] = new ImGui.ImVec4(0.30, 0.60, 1.00, 0.20);
  colors[ImGui.ImGuiCol.ResizeGripHovered] = new ImGui.ImVec4(0.30, 0.60, 1.00, 0.60);
  colors[ImGui.ImGuiCol.ResizeGripActive] = new ImGui.ImVec4(0.30, 0.60, 1.00, 0.90);

  // Tab标签页 - 更接近AE的标签页层次
  colors[ImGui.ImGuiCol.Tab] = new ImGui.ImVec4(0.08, 0.08, 0.08, 0.90);         // 非活跃标签很暗
  colors[ImGui.ImGuiCol.TabHovered] = new ImGui.ImVec4(0.18, 0.18, 0.18, 1.00);  // 悬停稍亮
  colors[ImGui.ImGuiCol.TabActive] = new ImGui.ImVec4(0.15, 0.15, 0.15, 1.00);   // 活跃标签与面板一致
  colors[ImGui.ImGuiCol.TabUnfocused] = new ImGui.ImVec4(0.06, 0.06, 0.06, 0.95);
  colors[ImGui.ImGuiCol.TabUnfocusedActive] = new ImGui.ImVec4(0.12, 0.12, 0.12, 1.00);

  // 高级颜色设置
  colors[ImGui.ImGuiCol.PlotLines] = new ImGui.ImVec4(0.30, 0.60, 1.00, 0.75);
  colors[ImGui.ImGuiCol.PlotLinesHovered] = new ImGui.ImVec4(0.09, 0.09, 0.09, 1.00);
  colors[ImGui.ImGuiCol.PlotHistogram] = new ImGui.ImVec4(0.85, 0.65, 0.00, 1.00);
  colors[ImGui.ImGuiCol.PlotHistogramHovered] = new ImGui.ImVec4(1.00, 0.70, 0.00, 1.00);

  // 文本选择 - 蓝色选中背景，更接近AE
  colors[ImGui.ImGuiCol.TextSelectedBg] = new ImGui.ImVec4(0.25, 0.55, 0.95, 0.40);
  colors[ImGui.ImGuiCol.DragDropTarget] = new ImGui.ImVec4(1.00, 1.00, 0.00, 0.90);
  colors[ImGui.ImGuiCol.NavHighlight] = new ImGui.ImVec4(0.30, 0.60, 1.00, 1.00);
  colors[ImGui.ImGuiCol.NavWindowingHighlight] = new ImGui.ImVec4(1.00, 1.00, 1.00, 0.70);
  colors[ImGui.ImGuiCol.NavWindowingDimBg] = new ImGui.ImVec4(0.80, 0.80, 0.80, 0.20);
  colors[ImGui.ImGuiCol.ModalWindowDimBg] = new ImGui.ImVec4(0.80, 0.80, 0.80, 0.35);

  // 处理扩展颜色（如果存在）
  if (colors[ImGui.ImGuiCol.PlotLines + 2]) {
    colors[ImGui.ImGuiCol.PlotLines + 2] = new ImGui.ImVec4(0.65, 0.65, 0.65, 1.00);
    colors[ImGui.ImGuiCol.PlotLinesHovered + 2] = new ImGui.ImVec4(1.00, 0.45, 0.35, 1.00);
    colors[ImGui.ImGuiCol.PlotHistogram + 2] = new ImGui.ImVec4(0.65, 0.65, 0.65, 1.00);
    colors[ImGui.ImGuiCol.PlotHistogramHovered + 2] = new ImGui.ImVec4(1.00, 0.45, 0.35, 1.00);
    colors[ImGui.ImGuiCol.TextSelectedBg + 2] = new ImGui.ImVec4(0.25, 0.55, 0.95, 0.40);
    colors[ImGui.ImGuiCol.DragDropTarget + 2] = new ImGui.ImVec4(1.00, 1.00, 0.00, 0.90);
    colors[ImGui.ImGuiCol.NavHighlight + 2] = new ImGui.ImVec4(0.30, 0.60, 1.00, 1.00);
    colors[ImGui.ImGuiCol.NavWindowingHighlight + 2] = new ImGui.ImVec4(1.00, 1.00, 1.00, 0.70);
    colors[ImGui.ImGuiCol.NavWindowingDimBg + 2] = new ImGui.ImVec4(0.80, 0.80, 0.80, 0.20);
    colors[ImGui.ImGuiCol.ModalWindowDimBg + 2] = new ImGui.ImVec4(0.80, 0.80, 0.80, 0.35);
  }

  style.IndentSpacing = 20.0;       // 风格的缩进
  style.ScrollbarSize = 12.0;       // 更细的滚动条
  style.GrabMinSize = 8.0;          // 更小的抓取手柄

  style.WindowBorderSize = 1.0;
  style.ChildBorderSize = 1.0;
  style.PopupBorderSize = 1.0;
  style.FrameBorderSize = 0.0;      // 无输入框边框，符合设计
  style.TabBorderSize = 0.0;

  style.WindowRounding = 0.0;       // 窗口无圆角
  style.ChildRounding = 0.0;        // 面板无圆角
  style.FrameRounding = 5.0;        // 输入框轻微圆角
  style.PopupRounding = 5.0;
  style.ScrollbarRounding = 6.0;    // 滚动条圆角
  style.GrabRounding = 1.0;
  style.LogSliderDeadzone = 4.0;
}

function ApplyHue (style: ImGui.ImGuiStyle, hue: number) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  for (let i = 0; i < ImGui.ImGuiCol.COUNT; i++) {
    const col = style.Colors[i];
    const h: ImGui.ImScalar<number> = [0];
    const s: ImGui.ImScalar<number> = [0];
    const v: ImGui.ImScalar<number> = [0];

    ImGui.ColorConvertRGBtoHSV(col.x, col.y, col.z, h, s, v);
    const r: ImGui.ImScalar<number> = [0];
    const g: ImGui.ImScalar<number> = [0];
    const b: ImGui.ImScalar<number> = [0];

    ImGui.ColorConvertHSVtoRGB(hue, s[0], v[0], r, g, b);
    col.x = r[0];
    col.y = g[0];
    col.z = b[0];
  }
}
