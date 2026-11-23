import { ContentImportController } from '../features/content-browser/content-import';
import { EditorRuntimeSession } from '../platform/effects-runtime/editor-runtime-session';
import { editorSurface } from '../platform/editor-surface';
import { clearControlIcons, loadControlIcons } from '../ui/icons/control-icons';
import { texturePreviewCache } from '../features/assets/preview/texture-preview-cache';
import { editorApp } from './editor-application';
import { initializeEditorRuntime } from './initialize-runtime';
import { registerEditorCommands } from './register-commands';
import './register-editors';
import { registerPropertyEditors } from './register-property-editors';
import './register-runtime-plugins';

async function initialize (): Promise<void> {
  const output = document.getElementById('output') || document.body;
  const canvas = document.createElement('canvas');

  output.appendChild(canvas); canvas.tabIndex = 1;
  Object.assign(canvas.style, { position: 'absolute', left: '0px', right: '0px', top: '0px', bottom: '0px', width: '100%', height: '100%', userSelect: 'none', outline: 'none' });
  canvas.addEventListener('dragover', ContentImportController.preventNavigation); canvas.addEventListener('drop', ContentImportController.preventNavigation);
  await editorSurface.initialize(canvas);
  await Promise.all([initializeEditorRuntime(canvas), loadControlIcons(editorSurface.engine)]);
  registerPropertyEditors(); registerEditorCommands(); editorApp.initialize(editorSurface.engine, editorSurface.root);
  EditorRuntimeSession.player.engine.on('contextlost', () => { texturePreviewCache.clear(); clearControlIcons(); });
  EditorRuntimeSession.player.engine.on('contextrestored', () => { void loadControlIcons(editorSurface.engine).catch(console.error); });
  window.addEventListener('pagehide', () => editorApp.shutdown(), { once: true });
  window.requestAnimationFrame(frame);
}
function frame (time: number): void {
  window.requestAnimationFrame(frame);
  if (EditorRuntimeSession.device.contextWasLost || EditorRuntimeSession.device.gl.isContextLost()) {
    EditorRuntimeSession.resetClock();

    return;
  }
  const delta = editorApp.tick(time);

  EditorRuntimeSession.render(time);
  editorSurface.update(delta);
  texturePreviewCache.renderPending(time);
  editorSurface.render();
}
void initialize().catch(console.error);
