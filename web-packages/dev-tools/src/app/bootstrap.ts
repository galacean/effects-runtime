import { ContentImportController } from '../features/content-browser/content-import';
import { editorLayout } from '../framework/layout/editor-layout';
import { ImGui, ImGuiBackend } from '../platform/imgui/index';
import { releaseImGuiTextureBindings } from '../platform/imgui/texture-binding';
import { EditorRuntimeSession } from '../platform/effects-runtime/editor-runtime-session';
import { clearEditorIcons, loadEditorIcons } from '../ui/icons/editor-icons';
import { texturePreviewCache } from '../features/assets/preview/texture-preview-cache';
import { EditorThemeManager } from '../ui/theme/index';
import { editorApp } from './editor-application';
import { initializeEditorRuntime } from './initialize-runtime';
import { DEFAULT_WINDOWS, EDITOR_DOCKSPACE_ID, defaultEditorLayout } from './layout/default-layout';
import { registerEditorCommands } from './register-commands';
import './register-editors';
import { registerPropertyEditors } from './register-property-editors';
import './register-runtime-plugins';

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
  canvas.addEventListener('dragover', ContentImportController.preventNavigation);
  canvas.addEventListener('drop', ContentImportController.preventNavigation);
  editorLayout.configureDefault(DEFAULT_WINDOWS, defaultEditorLayout);
  ImGui.LoadIniSettingsFromMemory(editorLayout.loadIni(defaultEditorLayout()));
  ImGuiBackend.Init(canvas);
  await Promise.all([initializeEditorRuntime(canvas), loadEditorIcons()]);
  registerPropertyEditors();
  registerEditorCommands();
  editorApp.initialize();
  EditorRuntimeSession.player.engine.on('contextlost', () => {
    texturePreviewCache.clear(); clearEditorIcons(); ImGuiBackend.DestroyDeviceObjects();
  });
  EditorRuntimeSession.player.engine.on('contextrestored', () => {
    ImGuiBackend.CreateDeviceObjects();
    void loadEditorIcons().catch(console.error);
  });
  window.requestAnimationFrame(frame);
}

function frame (time: number): void {
  window.requestAnimationFrame(frame);
  if (EditorRuntimeSession.device.contextWasLost || EditorRuntimeSession.device.gl.isContextLost()) {
    EditorRuntimeSession.resetClock();

    return;
  }
  ImGuiBackend.NewFrame(time);
  editorLayout.beforeFrame();
  ImGui.NewFrame();
  ImGui.DockSpaceOverViewport(EDITOR_DOCKSPACE_ID, ImGui.GetMainViewport());
  editorApp.tick(time);
  ImGui.EndFrame();
  EditorRuntimeSession.render(time);
  texturePreviewCache.renderPending(time);
  ImGui.Render();
  editorLayout.endFrame();

  const gl = ImGuiBackend.gl;

  if (gl) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.14, 0.14, 0.14, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  const context = ImGuiBackend.ctx;

  if (context) { context.clearRect(0, 0, context.canvas.width, context.canvas.height); }
  ImGuiBackend.RenderDrawData(ImGui.GetDrawData());
  releaseImGuiTextureBindings();
  EditorRuntimeSession.device.prepareFrame();
}

void initialize().catch(console.error);
