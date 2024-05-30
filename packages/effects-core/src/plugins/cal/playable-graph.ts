import { EffectsObject } from '../../effects-object';
import type { Disposable } from '../../utils';

/**
 * 动画图，负责更新所有的动画节点
 * @since 2.0.0
 * @internal
 */
export class PlayableGraph {
  private playableOutputs: PlayableOutput[] = [];
  private playables: Playable[] = [];

  evaluate (dt: number) {
    // 初始化节点状态
    for (const playable of this.playables) {
      this.updatePlayableTime(playable, dt);
    }
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
  }

  connect (source: Playable, sourceOutputPort: number, destination: Playable, destinationInputPort: number) {
    destination.connectInput(destinationInputPort, source, sourceOutputPort);
  }

  addOutput (output: PlayableOutput) {
    this.playableOutputs.push(output);
  }

  addPlayable (playable: Playable) {
    this.playables.push(playable);
  }

  private processFrameWithRoot (output: PlayableOutput) {
    output.sourcePlayable.processFrameRecursive(output.context, output.getSourceOutputPort());
    output.processFrame();
  }

  private prepareFrameWithRoot (output: PlayableOutput) {
    output.sourcePlayable.prepareFrameRecursive(output.context, output.getSourceOutputPort());
    output.prepareFrame();
  }

  private updatePlayableTime (playable: Playable, deltaTime: number) {
    if (playable.getPlayState() !== PlayState.Playing) {
      return;
    }
    if (playable.overrideTimeNextEvaluation) {
      playable.overrideTimeNextEvaluation = false;
    } else {
      playable.setTime(playable.getTime() + deltaTime);
    }
  }
}

/**
 * 动画图可播放节点对象
 * @since 2.0.0
 * @internal
 */
export class Playable implements Disposable {
  onPlayablePlayFlag = false;
  onPlayablePauseFlag = false;
  overrideTimeNextEvaluation = false;

  private destroyed = false;

  private inputs: Playable[] = [];
  private inputOuputPorts: number[] = [];
  private inputWeight: number[] = [];
  private outputs: Playable[] = [];
  private playState: PlayState = PlayState.Playing;
  private traversalMode: PlayableTraversalMode = PlayableTraversalMode.Mix;

  /**
   * 当前本地播放的时间
   */
  protected time: number;

  constructor (graph: PlayableGraph, inputCount = 0) {
    graph.addPlayable(this);
    this.inputs = new Array(inputCount);
    this.inputOuputPorts = new Array(inputCount);
    this.inputWeight = new Array(inputCount);
  }

  play () {
    this.playState = PlayState.Playing;
    this.onPlayablePlayFlag = true;
  }

  pause () {
    this.playState = PlayState.Paused;
    this.onPlayablePauseFlag = true;
  }

  connectInput (inputPort: number, sourcePlayable: Playable, sourceOutputPort: number, weight = 1.0) {
    this.setInput(sourcePlayable, inputPort);
    this.setInputWeight(inputPort, weight);
    sourcePlayable.setOutput(this, sourceOutputPort);

    if (this.inputOuputPorts.length < inputPort + 1) {
      this.inputOuputPorts.length = inputPort + 1;
    }
    this.inputOuputPorts[inputPort] = sourceOutputPort;
  }

  addInput (sourcePlayable: Playable, sourceOutputPort: number, weight = 1.0) {
    this.connectInput(this.getInputCount(), sourcePlayable, sourceOutputPort, weight);
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
      if (this.inputWeight.length < playableOrIndex + 1) {
        this.inputWeight.length = playableOrIndex + 1;
      }
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

  getPlayState () {
    return this.playState;
  }

  setTraversalMode (mode: PlayableTraversalMode) {
    this.traversalMode = mode;
  }

  getTraversalMode () {
    return this.traversalMode;
  }

  // onGraphStart () {

  // }

  // onGraphStop () {

  // }

  onPlayablePlay (context: FrameContext) {

  }

  onPlayablePause (context: FrameContext) {

  }

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
    this.destroyed = true;
  }

  /**
   * @internal
   */
  prepareFrameRecursive (context: FrameContext, passthroughPort: number) {
    if (this.destroyed) {
      return;
    }
    if (this.onPlayablePlayFlag) {
      this.onPlayablePlay(context);
      this.onPlayablePlayFlag = false;
    }
    if (this.onPlayablePauseFlag) {
      this.onPlayablePause(context);
      this.onPlayablePauseFlag = false;
    }
    if (passthroughPort === 0) {
      this.prepareFrame(context);
    }
    // 前序遍历，用于设置节点的初始状态，weight etc.
    if (this.getTraversalMode() === PlayableTraversalMode.Mix) {
      for (let i = 0; i < this.getInputCount(); i++) {
        const input = this.getInput(i);

        input.prepareFrameRecursive(context, this.inputOuputPorts[i]);
      }
    } else if (this.getTraversalMode() === PlayableTraversalMode.Passthrough) {
      const input = this.getInput(passthroughPort);

      input.prepareFrameRecursive(context, this.inputOuputPorts[passthroughPort]);
    }
  }

  /**
   * @internal
   */
  processFrameRecursive (context: FrameContext, passthroughPort: number) {
    if (this.destroyed) {
      return;
    }
    // 后序遍历，保证 playable 拿到的 input 节点的估计数据是最新的
    if (this.getTraversalMode() === PlayableTraversalMode.Mix) {
      for (let i = 0; i < this.getInputCount(); i++) {
        const input = this.getInput(i);

        if (this.getInputWeight(i) <= 0) {
          continue;
        }

        input.processFrameRecursive(context, this.inputOuputPorts[i]);
      }
    } else if (this.getTraversalMode() === PlayableTraversalMode.Passthrough) {
      const input = this.getInput(passthroughPort);

      if (this.getInputWeight(passthroughPort) > 0) {
        input.processFrameRecursive(context, this.inputOuputPorts[passthroughPort]);
      }
    }
    this.processFrame(context);
  }

  private setOutput (outputPlayable: Playable, outputPort: number) {
    if (this.outputs.length < outputPort + 1) {
      this.outputs.length = outputPort + 1;
    }
    this.outputs[outputPort] = outputPlayable;
  }

  private setInput (inputPlayable: Playable, inputPort: number) {
    if (this.inputs.length < inputPort + 1) {
      this.inputs.length = inputPort + 1;
    }
    this.inputs[inputPort] = inputPlayable;
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
  private sourceOutputPort = 0;

  constructor () {
    this.context = {
      deltaTime:0,
      output:this,
    };
  }

  setSourcePlayeble (playable: Playable, port = 0) {
    this.sourcePlayable = playable;
    this.sourceOutputPort = port;
  }

  getSourceOutputPort () {
    return this.sourceOutputPort;
  }

  setUserData (value: object) {
    this.userData = value;
  }

  getUserData () {
    return this.userData;
  }

  onGraphStart () {

  }

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

export enum PlayableTraversalMode {
  Mix,
  Passthrough,
}