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
    for (const playable of this.playables) {
      playable.prepareFrameFlag = false;
      if (!playable.overrideTimeNextEvaluation) {
        playable.setTime(playable.getTime() + dt);
      } else {
        playable.overrideTimeNextEvaluation = false;
      }
    }
    for (const playableOutput of this.playableOutputs) {
      this.prepareFrameWithRoot(playableOutput, dt);
    }
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

  addPlayable (playable: Playable) {
    this.playables.push(playable);
  }

  private processFrameWithRoot (output: PlayableOutput, dt: number) {
    output.sourcePlayable.processFrameRecursive(dt, output.getSourceOutputPort());
    output.processFrame(dt);
  }

  private prepareFrameWithRoot (output: PlayableOutput, dt: number) {
    output.sourcePlayable.prepareFrameRecursive(dt, output.getSourceOutputPort());
    output.prepareFrame(dt);
  }
}

/**
 * 动画图可播放节点对象
 * @since 2.0.0
 * @internal
 */
export class Playable implements Disposable {
  bindingItem: VFXItem<VFXItemContent>;
  prepareFrameFlag = false;
  overrideTimeNextEvaluation = false;

  private destroyed = false;

  private inputs: Playable[] = [];
  private inputOuputPorts: number[] = [];
  private inputWeight: number[] = [];
  private outputs: Playable[] = [];
  private playState: PlayState = PlayState.Delayed;
  private traversalMode: PlayableTraversalMode = PlayableTraversalMode.Mix;

  /**
   * 当前本地播放的时间
   */
  protected time: number;

  constructor (graph: PlayableGraph) {
    graph.addPlayable(this);
  }

  connect (playable: Playable) {
    this.inputs.push(playable);
    this.inputWeight.push(1);
    playable.outputs.push(this);
    this.inputOuputPorts.push(playable.outputs.length - 1);
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

  getOutputCount () {
    return this.outputs.length;
  }

  getOutputs (): Playable[] {
    return this.outputs;
  }

  getOutput (index: number): Playable {
    return this.outputs[index];
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
    this.overrideTimeNextEvaluation = true;
  }

  getTime () {
    return this.time;
  }

  setTraversalMode (mode: PlayableTraversalMode) {
    this.traversalMode = mode;
  }

  getTraversalMode () {
    return this.traversalMode;
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

  prepareFrame (dt: number) {

  }

  processFrame (dt: number) {

  }

  onPlayableDestroy () {

  }

  fromData (data: any) { }

  /**
   * @internal
   */
  prepareFrameRecursive (dt: number, passthroughPort: number) {
    if (this.destroyed || this.prepareFrameFlag) {
      return;
    }
    this.prepareFrame(dt);
    this.prepareFrameFlag = true;

    // 前序遍历，用于设置节点的初始状态，weight etc.
    if (this.getTraversalMode() === PlayableTraversalMode.Mix) {
      for (let i = 0; i < this.getInputCount(); i++) {
        const input = this.getInput(i);

        input.prepareFrameRecursive(dt, this.inputOuputPorts[i]);
      }
    } else if (this.getTraversalMode() === PlayableTraversalMode.Passthrough) {
      const input = this.getInput(passthroughPort);

      input.prepareFrameRecursive(dt, this.inputOuputPorts[passthroughPort]);
    }
  }

  /**
   * @internal
   */
  processFrameRecursive (dt: number, passthroughPort: number) {
    // 后序遍历，保证 playable 拿到的 input 节点的估计数据是最新的
    if (this.getTraversalMode() === PlayableTraversalMode.Mix) {
      for (let i = 0; i < this.getInputCount(); i++) {
        if (this.getInputWeight(i) <= 0) {
          continue;
        }
        const input = this.getInput(i);

        input.processFrameRecursive(dt, this.inputOuputPorts[i]);
      }
    } else if (this.getTraversalMode() === PlayableTraversalMode.Passthrough) {
      const input = this.getInput(passthroughPort);

      if (this.getInputWeight(passthroughPort) <= 0) {
        return;
      }

      input.processFrameRecursive(dt, this.inputOuputPorts[passthroughPort]);
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
  private sourceOutputPort = 0;

  constructor () {
  }

  setSourcePlayeble (playable: Playable, port = 0) {
    this.sourcePlayable = playable;
    this.sourceOutputPort = port;
  }

  getSourceOutputPort () {
    return this.sourceOutputPort;
  }

  onGraphStart () {

  }

  prepareFrame (dt: number) {

  }

  processFrame (dt: number) {

  }
}

export abstract class PlayableAsset extends EffectsObject {
  abstract createPlayable (graph: PlayableGraph): Playable;
}

export enum PlayState {
  Playing,
  Paused,
  Delayed,
}

export enum PlayableTraversalMode {
  Mix,
  Passthrough,
}