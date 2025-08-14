import { EffectsObject } from '../../effects-object';
import type { Disposable } from '../../utils';

/**
 * 动画图可播放节点对象
 * @since 2.0.0
 */
export class Playable implements Disposable {
  onPlayablePlayFlag = true;
  onPlayablePauseFlag = false;

  private duration = 0;
  private destroyed = false;
  private playState: PlayState = PlayState.Playing;

  /**
   * 当前本地播放的时间
   */
  protected time: number = 0;

  constructor () {}

  play () {
    switch (this.playState) {
      case PlayState.Playing:
        break;
      case PlayState.Paused:
        this.playState = PlayState.Playing;
        this.onPlayablePlayFlag = true;
        this.onPlayablePauseFlag = false;

        break;
    }
  }

  pause () {
    switch (this.playState) {
      case PlayState.Playing:
        this.playState = PlayState.Paused;
        this.onPlayablePauseFlag = true;
        this.onPlayablePlayFlag = false;

        break;
      case PlayState.Paused:
        break;
    }
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

  // onPlayablePlay (context: FrameContext) {

  // }

  // onPlayablePause (context: FrameContext) {

  // }

  prepareFrame (context: FrameContext) {

  }

  processFrame (context: FrameContext) {

  }

  onPlayableDestroy () {

  }

  dispose (): void {
    if (this.destroyed) {
      return;
    }
    this.onPlayableDestroy();
    // TODO 将节点从动画图中移除
    this.destroyed = true;
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
  /**
   * 当前本地播放的时间
   */
  protected time: number;

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

  // onGraphStart () {

  // }

  prepareFrame () {

  }

  processFrame () {

  }
}

export abstract class PlayableAsset extends EffectsObject {
  abstract createPlayable (): Playable;
}

export interface FrameContext {
  deltaTime: number,
  output: PlayableOutput,
}

export enum PlayState {
  Playing,
  Paused,
}
