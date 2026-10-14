import { Asset } from '../../asset';

/**
 * 动画图可播放节点对象
 * @since 2.0.0
 */
export class Playable {
  private duration = 0;
  private playState: PlayState = PlayState.Playing;

  /**
   * 当前本地播放的时间
   */
  protected time: number = 0;

  play () {
    this.playState = PlayState.Playing;
  }

  pause () {
    this.playState = PlayState.Paused;
  }

  setTime (time: number) {
    this.time = time;
  }

  getTime () {
    return this.time;
  }

  setDuration (duration: number) {
    this.duration = duration;
  }

  getDuration () {
    return this.duration;
  }

  getPlayState () {
    return this.playState;
  }

  processFrame (boundObject: object, context: FrameContext) {

  }
}

export abstract class PlayableAsset extends Asset {
  abstract createPlayable (): Playable;
}

export interface FrameContext {
  deltaTime: number,
}

export enum PlayState {
  Playing,
  Paused,
  Stopped,
}
