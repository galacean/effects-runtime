import { EffectsObject } from '../../effects-object';
import type { Disposable } from '../../utils';
import type { VFXItem, VFXItemContent } from '../../vfx-item';

/**
 * 动画图，负责更新所有的动画节点
 * @since 2.0.0
 * @internal
 */
export class PlayableGraph {
  private playableOutputs: PlayableOutput[] = [];
  private playables: Playable[] = [];

  constructor () {
  }

  evaluate (dt: number) {
    for (const playableOutput of this.playableOutputs) {
      this.processFrameWithRoot(playableOutput, dt);
    }
  }

  connect (source: Playable, destination: Playable) {
    destination.connect(source);
  }

  addOutput (output: PlayableOutput) {
    this.playableOutputs.push(output);
  }

  private processFrameWithRoot (output: PlayableOutput, dt: number) {
    output.processFrameRecursive(dt);
  }
}

/**
 * 动画图可播放节点对象
 * @since 2.0.0
 * @internal
 */
export class Playable implements Disposable {
  static nullPlayable = new Playable();
  bindingItem: VFXItem<VFXItemContent>;

  private destroyed = false;
  private inputs: Playable[] = [];
  private inputWeight: number[] = [];
  private playState: PlayState = PlayState.Delayed;

  /**
   * 当前本地播放的时间
   */
  protected time: number;

  constructor () {
  }

  connect (playable: Playable) {
    this.inputs.push(playable);
    this.inputWeight.push(1);
  }

  getInputCount () {
    return this.inputs.length;
  }

  getInputs (): Playable[] {
    return this.inputs;
  }

  getInput (index: number): Playable {
    return this.inputs[index];
  }

  getInputWeight (inputIndex: number): number {
    return this.inputWeight[inputIndex];
  }

  setInputWeight (playable: Playable, weight: number): void;

  setInputWeight (inputIndex: number, weight: number): void;

  setInputWeight (playableOrIndex: Playable | number, weight: number): void {
    if (playableOrIndex instanceof Playable) {
      for (let i = 0; i < this.inputs.length; i++) {
        if (this.inputs[i] === playableOrIndex) {
          this.inputWeight[i] = weight;

          return;
        }
      }
    } else {
      this.inputWeight[playableOrIndex] = weight;
    }
  }

  setTime (time: number) {
    this.time = time;
  }

  getTime () {
    return this.time;
  }

  dispose (): void {
    if (this.destroyed) {
      return;
    }
    this.onPlayableDestroy();
    this.destroyed = true;
  }

  onGraphStart () {

  }

  onGraphStop () {

  }

  onPlayablePlay () {

  }

  processFrame (dt: number) {

  }

  onPlayableDestroy () {

  }

  fromData (data: any) { }

  /**
   * @internal
   */
  processFrameRecursive (dt: number) {
    // 后序遍历，保证 playable 拿到的 input 节点数据是最新的
    for (let i = 0; i < this.getInputCount(); i++) {
      if (this.getInputWeight(i) <= 0) {
        continue;
      }
      this.getInput(i).processFrameRecursive(dt);
    }
    if (this.playState === PlayState.Delayed) {
      this.onPlayablePlay();
      this.playState = PlayState.Playing;
    }
    if (this.destroyed) {
      return;
    }
    this.processFrame(dt);
  }
}

/**
 * 动画图输出节点对象，将动画数据采样到绑定的元素属性上
 * @since 2.0.0
 * @internal
 */
export class PlayableOutput {
  /**
   * 绑定到的动画 item
   */
  bindingItem: VFXItem<VFXItemContent>;
  /**
   * 源 playable 对象
   */
  sourcePlayable: Playable;
  /**
   * 当前本地播放的时间
   */
  protected time: number;

  constructor () {
  }

  setSourcePlayeble (playable: Playable) {
    this.sourcePlayable = playable;
  }

  onGraphStart () {

  }

  processFrame (dt: number) {
  }

  /**
   * @internal
   */
  processFrameRecursive (dt: number) {
    this.sourcePlayable.processFrameRecursive(dt);
    this.processFrame(dt);
  }
}

export abstract class PlayableAsset extends EffectsObject {
  abstract createPlayable (): Playable;
}

export enum PlayState {
  Playing,
  Paused,
  Delayed,
}
