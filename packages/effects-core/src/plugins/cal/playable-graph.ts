import type { VFXItem, VFXItemContent } from '../../vfx-item';

/**
 * 动画图，负责更新所有的动画节点
 * @since 2.0.0
 * @internal
 */
export class PlayableGraph {
  private playableOutputs: PlayableOutput[] = [];

  constructor () {
  }

  evaluate (dt: number) {
    for (const playableOutput of this.playableOutputs) {
      this.callProcessFrame(playableOutput.sourcePlayable, dt);
      playableOutput.processFrame(dt);
    }
  }

  connect (source: Playable, destination: Playable) {
    destination.connect(source);
  }

  addOutput (output: PlayableOutput) {
    this.playableOutputs.push(output);
  }

  private callProcessFrame (playable: Playable, dt: number) {
    // 后序遍历，保证 playable 拿到的 input 节点数据是最新的
    for (const inputPlayable of playable.getInputs()) {
      this.callProcessFrame(inputPlayable, dt);
    }
    playable.processFrame(dt);
  }
}

/**
 * 动画图可播放节点对象
 * @since 2.0.0
 * @internal
 */
export class Playable {
  bindingItem: VFXItem<VFXItemContent>;

  private inputs: Playable[] = [];

  /**
   * 当前本地播放的时间
   */
  protected time: number;

  constructor () {
  }

  connect (playable: Playable) {
    this.inputs.push(playable);
  }

  getInputs (): Playable[] {
    return this.inputs;
  }

  getInput (index: number): Playable | undefined {
    if (index > this.inputs.length - 1) {
      return;
    }

    return this.inputs[index];
  }

  setTime (time: number) {
    this.time = time;
  }

  getTime () {
    return this.time;
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
}
