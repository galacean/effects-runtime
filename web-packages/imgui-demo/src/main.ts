import { GalaceanEffects } from './ge';
import { ImGui, ImGui_Impl } from './imgui/index';
import './panels';
import './custom-editors';
import { editorApp } from './core/editor-application';
import { editorLayout } from './core/editor-layout';
import { defaultEditorLayout, EDITOR_DOCKSPACE_ID } from './core/default-layout';
import { ContentImport } from './panels/content-browser/content-import';
import { EditorThemeManager } from './panels/theme';
import { loadEditorIcons } from './widgets/editor-icons';

async function initialize (): Promise<void> {
  await ImGui.default();
  ImGui.CHECKVERSION();
  ImGui.CreateContext();
  const io = ImGui.GetIO();

  io.ConfigFlags |= ImGui.ConfigFlags.DockingEnable;
  io.ConfigDockingAlwaysTabBar = true;
  io.ConfigWindowsMoveFromTitleBarOnly = true;
  EditorThemeManager.apply();

  const fontConfig = new ImGui.FontConfig();

  fontConfig.Name = 'Alibaba PuHuiTi Regular';
  fontConfig.internal.OversampleH = 3;
  fontConfig.internal.OversampleV = 3;
  const fontData = await (await fetch('./Alibaba-PuHuiTi-Regular.ttf')).arrayBuffer();

  io.Fonts.AddFontFromMemoryTTF(fontData, 44, fontConfig, io.Fonts.GetGlyphRangesChineseSimplifiedCommon());
  ImGui.GetStyle().FontScaleMain = 0.45;

  const output = document.getElementById('output') || document.body;
  const canvas = document.createElement('canvas');

  output.appendChild(canvas);
  canvas.tabIndex = 1;
  Object.assign(canvas.style, {
    position: 'absolute', left: '0px', right: '0px', top: '0px', bottom: '0px',
    width: '100%', height: '100%', userSelect: 'none', outline: 'none',
  });
  canvas.addEventListener('dragover', ContentImport.preventNavigation);
  canvas.addEventListener('drop', ContentImport.preventNavigation);
  ImGui.LoadIniSettingsFromMemory(editorLayout.loadIni(defaultEditorLayout()));
  ImGui_Impl.Init(canvas);
  await Promise.all([GalaceanEffects.initialize(), loadEditorIcons()]);
  editorApp.initialize();
  window.requestAnimationFrame(frame);
}

function frame (time: number): void {
  ImGui_Impl.NewFrame(time);
  editorLayout.beforeFrame();
  ImGui.NewFrame();
  ImGui.DockSpaceOverViewport(EDITOR_DOCKSPACE_ID, ImGui.GetMainViewport());
  editorApp.tick(time);
  ImGui.EndFrame();
  ImGui.Render();
  editorLayout.endFrame();

  const gl = ImGui_Impl.gl;

  if (gl) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.14, 0.14, 0.14, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  const context = ImGui_Impl.ctx;

  if (context) { context.clearRect(0, 0, context.canvas.width, context.canvas.height); }
  ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
  window.requestAnimationFrame(frame);
}

void initialize().catch(console.error);
