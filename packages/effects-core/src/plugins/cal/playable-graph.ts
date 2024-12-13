import { EffectsObject } from '../../effects-object';
import type { Disposable } from '../../utils';

/**
 * 动画图，负责更新所有的动画节点
 * @since 2.0.0
 */
export class PlayableGraph {
  private playableOutputs: PlayableOutput[] = [];
  private playables: Playable[] = [];

  evaluate (dt: number) {
    // 初始化输出节点状态
    for (const playableOutput of this.playableOutputs) {
      playableOutput.context.deltaTime = dt;
    }

    // 执行生命周期函数
    for (const playableOutput of this.playableOutputs) {
      this.prepareFrameWithRoot(playableOutput);
    }
    for (const playableOutput of this.playableOutputs) {
      this.processFrameWithRoot(playableOutput);
    }

    // 更新节点时间
    for (const playable of this.playables) {
      this.updatePlayableTime(playable, dt / 1000);
    }
  }

  addOutput (output: PlayableOutput) {
    this.playableOutputs.push(output);
  }

  addPlayable (playable: Playable) {
    this.playables.push(playable);
  }

  private processFrameWithRoot (output: PlayableOutput) {
    output.sourcePlayable.processFrame(output.context);
    output.processFrame();
  }

  private prepareFrameWithRoot (output: PlayableOutput) {
    output.prepareFrame();
    output.sourcePlayable.prepareFrame(output.context);
  }

  private updatePlayableTime (playable: Playable, deltaTime: number) {
    if (playable.getPlayState() !== PlayState.Playing) {
      return;
    }
    playable.setTime(playable.getTime() + deltaTime);
  }
}

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

  constructor (graph: PlayableGraph, inputCount = 0) {
    graph.addPlayable(this);
  }

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

  // onGraphStart () {

  // }

  // onGraphStop () {

  // }

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
  /**
   * 源 playable 对象
   */
  sourcePlayable: Playable;
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

  setSourcePlayable (playable: Playable) {
    this.sourcePlayable = playable;
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
  abstract createPlayable (graph: PlayableGraph): Playable;
}

export interface FrameContext {
  deltaTime: number,
  output: PlayableOutput,
}

export enum PlayState {
  Playing,
  Paused,
}
