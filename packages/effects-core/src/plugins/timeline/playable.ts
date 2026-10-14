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

  processFrame (context: FrameContext) {

  }
}

/**
 * 动画图输出节点对象，将动画数据采样到绑定的元素属性上
 * @since 2.0.0
 */
export class PlayableOutput {
  /**
   * 绑定到的动画 item
   */
  userData: object;
  context: FrameContext;

  constructor () {
    this.context = {
      deltaTime: 0,
      output: this,
    };
  }

  setUserData (value: object) {
    this.userData = value;
  }

  getUserData () {
    return this.userData;
  }
}

export abstract class PlayableAsset extends Asset {
  abstract createPlayable (): Playable;
}

export interface FrameContext {
  deltaTime: number,
  output: PlayableOutput,
}

export enum PlayState {
  Playing,
  Paused,
  Stopped,
}
