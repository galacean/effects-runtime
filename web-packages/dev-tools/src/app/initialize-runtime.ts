import { getClass } from '@galacean/effects';
import { assetLibrary } from '../features/assets/asset-library';
import { createDefaultDemoScene } from '../examples/scenes/default-scene';
import { DEFAULT_PROJECT_ID } from '../features/projects/project-types';
import { projectWorkspace } from '../features/projects/project-workspace';
import { sceneWorkspace } from '../features/scene/scene-workspace';
import { jsonData, resolveSceneURLs } from '../features/scene/serialization/scene-values';
import { EditorSelection } from '../framework/selection/editor-selection';
import { EditorRuntimeSession } from '../platform/effects-runtime/editor-runtime-session';

export async function initializeEditorRuntime (surface: HTMLCanvasElement): Promise<void> {
  EditorRuntimeSession.initialize(document.getElementById('J-container'), surface);
  assetLibrary.registerEngine(EditorRuntimeSession.player.engine);
  await projectWorkspace.initialize();
  const lastScene = await sceneWorkspace.initialize(async source => {
    const player = EditorRuntimeSession.player;
    const manager = player.engine.assetServer.createAssetManager({ env: 'editor', autoplay: false, reusable: true });
    const scene = await manager.loadScene(source, player.renderer);
    const baseURL = typeof source === 'string' ? new URL(source, location.href).href : location.href;
    const authored = resolveSceneURLs(scene.jsonScene, baseURL);

    for (const composition of authored.compositions) {
      for (const reference of composition.components ?? []) {
        const component = authored.components.find(entry => entry.id === reference.id);

        if (!component) {
          throw new Error('The scene references a missing component: ' + reference.id);
        }
        if (!getClass(component.dataType)) { throw new Error('Unknown scene component type: ' + component.dataType); }
      }
    }

    sceneWorkspace.current?.dispose();
    EditorSelection.clear('sync'); sceneWorkspace.current = undefined;
    player.destroyCurrentCompositions();
    let composition;

    try { composition = await player.loadScene(scene, { autoplay: false, reusable: true }); } catch (error) {
      player.destroyCurrentCompositions(); throw error;
    }

    return { composition, source: jsonData(authored) };
  });

  if (lastScene) {
    await sceneWorkspace.openSaved(lastScene);
    if (sceneWorkspace.current) { return; }
  }
  if (projectWorkspace.current?.id !== DEFAULT_PROJECT_ID) {
    await sceneWorkspace.loadProject();

    return;
  }
  await sceneWorkspace.requestOpen(createDefaultDemoScene());
}
