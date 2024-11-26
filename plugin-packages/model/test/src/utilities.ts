import type { Player, SceneLoadOptions, Scene } from '@galacean/effects';

export async function generateComposition (
  player: Player,
  scene: Scene.LoadType,
  loadOptions?: SceneLoadOptions,
  options: Record<string, any> = {},
) {
  player.getCompositions().forEach(comp => comp.dispose());
  player.getCompositions().length = 0;

  const composition = await player.loadScene(scene, loadOptions);

  if (options.pauseOnFirstFrame) {
    player.gotoAndStop(options?.currentTime ?? 0);
  } else {
    player.play();
  }

  return composition;
}
