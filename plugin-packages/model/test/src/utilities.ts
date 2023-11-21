// @ts-nocheck
import type { Player, SceneLoadOptions, SceneLoadType } from '@galacean/effects';

export async function generateComposition (player: Player, scene: SceneLoadType, loadOptions?: SceneLoadOptions, playerOptions?: any) {
  player.compositions.forEach(comp => comp.dispose());
  player.compositions.length = 0;

  const comp = await player.loadScene(scene, loadOptions);

  if (playerOptions?.pauseOnFirstFrame) {
    player.gotoAndStop(playerOptions?.currentTime ?? 0);
  } else {
    player.play();
  }

  return comp;
}
