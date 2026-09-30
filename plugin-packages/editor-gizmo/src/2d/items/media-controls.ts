import { SceneServer } from '@galacean/effects';
import { CompositionComponent, type Engine, spec } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';
import { getPlayerItemById } from './item-hierarchy';

const pendingPauseRequests = new WeakMap<VideoComponent, symbol>();

/**
 * 请求播放视频组件，并撤销尚未落地的暂停请求。
 * @param videoComponent 视频组件
 */
export function playVideoComponent (videoComponent: VideoComponent): void {
  pendingPauseRequests.delete(videoComponent);
  videoComponent.playVideo();
}

/**
 * 请求暂停视频组件。
 *
 * Multimedia 组件在 `HTMLVideoElement.play()` 尚未完成时直接暂停会产生 AbortError，
 * 因此等待组件内部的在途播放结束后再暂停；期间再次播放会取消本次暂停请求。
 * @param videoComponent 视频组件
 */
export function pauseVideoComponent (videoComponent: VideoComponent): void {
  const playPromise = (videoComponent as any).playPromise;

  if (!playPromise) {
    pendingPauseRequests.delete(videoComponent);
    videoComponent.pauseVideo();

    return;
  }

  const request = Symbol('pause-video');

  pendingPauseRequests.set(videoComponent, request);

  const pauseAfterPlay = (): void => {
    if (pendingPauseRequests.get(videoComponent) !== request) {
      return;
    }
    pendingPauseRequests.delete(videoComponent);
    videoComponent.pauseVideo();
  };

  void playPromise.then(pauseAfterPlay, pauseAfterPlay);
}

/**
 * 播放视频元素。
 * @param engine 引擎
 * @param id 视频元素 id
 */
export function playVideoItem (engine: Engine, id: string) {
  const playerItem = getPlayerItemById(engine.getServer(SceneServer).compositions[0], id);

  if (playerItem?.type !== spec.ItemType.video) {
    return;
  }
  const videoComponent = playerItem.getComponent(VideoComponent);

  if (videoComponent) {
    playVideoComponent(videoComponent);
  }
}

/**
 * 暂停视频元素。
 * @param engine 引擎
 * @param id 视频元素 id
 */
export function pauseVideoItem (engine: Engine, id: string) {
  const playerItem = getPlayerItemById(engine.getServer(SceneServer).compositions[0], id);

  if (playerItem?.type !== spec.ItemType.video) {
    return;
  }
  const videoComponent = playerItem.getComponent(VideoComponent);

  if (videoComponent) {
    pauseVideoComponent(videoComponent);
  }
}

/**
 * 播放特效元素。
 * @param engine 引擎
 * @param id 特效元素 id
 */
export function playEffectsItem (engine: Engine, id: string) {
  const controlItem = getPlayerItemById(engine.getServer(SceneServer).compositions[0], id);
  const compositionItem = controlItem?.children?.[0];

  if (compositionItem?.type !== spec.ItemType.composition) {
    return;
  }
  compositionItem.getComponent(CompositionComponent).play();
}

/**
 * 暂停特效元素。
 * @param engine 引擎
 * @param id 特效元素 id
 */
export function pauseEffectsItem (engine: Engine, id: string) {
  const controlItem = getPlayerItemById(engine.getServer(SceneServer).compositions[0], id);
  const compositionItem = controlItem?.children?.[0];

  if (compositionItem?.type !== spec.ItemType.composition) {
    return;
  }
  compositionItem.getComponent(CompositionComponent).pause();
}
