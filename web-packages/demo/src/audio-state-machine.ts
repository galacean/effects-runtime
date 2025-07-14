/* eslint-disable brace-style */
interface AudioData {
  floatData: Float32Array,
  frequencyBands: number,
}

type AudioCallback = () => void;

enum AudioStage {
  Idle,
  FadeIn,
  Speaking,
  FadeOut
}

class AudioStateMachine {
  public readonly frequencyBands: number;
  private data: Float32Array;
  private isRunning: boolean;
  private animationId: number | null;

  private stage: AudioStage;
  private fadeOutDuration: number;

  private fadeInDuration: number;

  private useRealData: boolean = false;

  private stageDurations: Record<AudioStage, number> = {
    [AudioStage.Idle]: 2.0,      // 秒
    [AudioStage.FadeIn]: 1.5,    // 秒
    [AudioStage.Speaking]: 3.0,  // 秒
    [AudioStage.FadeOut]: 1.5,   // 秒
  };
  private stageTime: number = 0;

  constructor (frequencyBands: number = 64) {
    this.frequencyBands = frequencyBands;
    this.data = new Float32Array(frequencyBands);
    this.isRunning = false;
    this.animationId = null;

    this.stage = AudioStage.Idle; // 初始状态为 Idle
    this.fadeOutDuration = 20.0;

    this.fadeInDuration = 3.0; // 默认淡入时长（秒），可自行调整

  }

  setStage (stage: AudioStage) {
    this.stage = stage;
    this.stageTime = 0;
  }

  setStageDuration (stage: AudioStage, duration: number) {
    this.stageDurations[stage] = duration;
  }

  public updateStageTime (deltaTime: number) {
    this.stageTime += deltaTime;
  }

  /**
   * 推进状态机
   * 返回新的 fadeProgressGlobal、fadeProgressMask、当前状态
   */
  public driveState (
    fadeProgressGlobal: number,
    fadeProgressMask: number,
    shaderParams: { fadeSpeedGlobal: number, fadeSpeedMask: number },
    avgAmplitude: number,
    fadeThreshold: number
  ): {
      fadeProgressGlobal: number,
      fadeProgressMask: number,
    } {
    let newFadeProgressGlobal = fadeProgressGlobal;
    let newFadeProgressMask = fadeProgressMask;

    // 计算推进速度
    const fadeInSpeedGlobal = shaderParams.fadeSpeedGlobal * Math.max(1, (avgAmplitude - fadeThreshold) * 5);
    const fadeInSpeedMask = shaderParams.fadeSpeedMask * Math.max(1, (avgAmplitude - fadeThreshold) * 5);
    const fadeOutSpeedGlobal = shaderParams.fadeSpeedGlobal * Math.max(1, (fadeThreshold - avgAmplitude) * 5);
    const fadeOutSpeedMask = shaderParams.fadeSpeedMask * Math.max(1, (fadeThreshold - avgAmplitude) * 5);

    if (this.stage === AudioStage.FadeIn) {
      newFadeProgressGlobal -= fadeInSpeedGlobal;
      newFadeProgressMask -= fadeInSpeedMask;
      if (newFadeProgressGlobal < 0) {newFadeProgressGlobal = 0;}
      if (newFadeProgressMask < 0) {newFadeProgressMask = 0;}
    } else if (this.stage === AudioStage.Speaking) {
      newFadeProgressGlobal = 0;
      newFadeProgressMask = 0;
    } else if (this.stage === AudioStage.FadeOut) {
      newFadeProgressGlobal += fadeOutSpeedGlobal;
      newFadeProgressMask += fadeOutSpeedMask;
      if (newFadeProgressGlobal > 1) {newFadeProgressGlobal = 1;}
      if (newFadeProgressMask > 1) {newFadeProgressMask = 1;}
    } else if (this.stage === AudioStage.Idle) {
      newFadeProgressGlobal = 1;
      newFadeProgressMask = 1;
    }

    return {
      fadeProgressGlobal: newFadeProgressGlobal,
      fadeProgressMask: newFadeProgressMask,
    };
  }

  setUseRealData (flag: boolean) {
    this.useRealData = flag;
  }

  // 你可以加一个方法来注入真实数据
  public setRealData (data: Float32Array) {
    if (this.useRealData) {
      this.data.set(data);
    }
  }

  start (callback?: AudioCallback, fps: number = 60): void {
    if (this.isRunning) {this.stop();}
    this.isRunning = true;

    const update = (): void => {
      if (!this.isRunning) {return;}

      if (callback) {
        callback();
      }
      this.animationId = requestAnimationFrame(update);
    };

    this.animationId = requestAnimationFrame(update);
  }

  stop (): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getFadeInDuration (): number {
    return this.fadeInDuration;
  }
  getFadeOutDuration (): number {
    return this.fadeOutDuration;
  }
  public getStageTime (): number {
    return this.stageTime;
  }
  public getStageDurations (): Record<AudioStage, number> {
    return this.stageDurations;
  }
  public getStage (): AudioStage {
    return this.stage;
  }

  /**
   * 判断说话状态并返回新的 speakState
   */
  public static getSpeakState (
    avgAmplitude: number,
    envLevel: number,
    fadeThreshold: number,
    prevState: AudioStage,
    stageTime: number,
    stageDurations: Record<AudioStage, number>
  ): AudioStage {
    // Idle -> FadeIn（音量大于环境噪声）
    if (prevState === AudioStage.Idle && avgAmplitude > envLevel) {
      //console.log(`Transitioning from Idle to FadeIn: avgAmplitude=${avgAmplitude}, envLevel=${envLevel}`);

      return AudioStage.FadeIn;
    }
    // FadeIn -> Speaking（淡入时间到且音量大于fadeThreshold）
    if (prevState === AudioStage.FadeIn && stageTime >= stageDurations[AudioStage.FadeIn] && avgAmplitude > fadeThreshold) {
      //console.log(`Transitioning from FadeIn to Speaking: stageTime=${avgAmplitude}, fadeThreshold=${fadeThreshold}`);

      return AudioStage.Speaking;
    }
    // FadeIn -> FadeOut（淡入时间到且音量小于等于fadeThreshold）
    /*if (prevState === AudioStage.FadeIn && stageTime >= stageDurations[AudioStage.FadeIn] && avgAmplitude <= fadeThreshold) {
      console.log(`Transitioning from FadeIn to FadeOut: stageTime=${stageTime}, fadeThreshold=${fadeThreshold}`);

      return AudioStage.FadeOut;
    }*/
    // Speaking -> FadeOut（音量低于等于fadeThreshold）
    if (prevState === AudioStage.Speaking && avgAmplitude <= fadeThreshold) {
      return AudioStage.FadeOut;
    }
    // FadeOut -> Idle（**只允许淡出时间到时进入Idle**）
    if (prevState === AudioStage.FadeOut && stageTime >= stageDurations[AudioStage.FadeOut] && avgAmplitude <= envLevel) {
      return AudioStage.Idle;
    }

    // FadeOut -> Speaking (if volume increases above threshold)
    /*if (prevState === AudioStage.FadeOut && avgAmplitude > fadeThreshold) {
      console.log(`Transitioning from FadeOut to Speaking: avgAmplitude=${avgAmplitude}, fadeThreshold=${fadeThreshold}`);

      return AudioStage.Speaking;
    }*/

    // FadeOut期间无论音量如何都不能提前进入Idle
    return prevState;
  }

  /**
   * 根据输入自动判断并切换说话状态（内部自动调用 setStage）
   */
  public updateSpeakState (
    avgAmplitude: number,
    envLevel: number,
    fadeThreshold: number
  ) {
    this.updateStageTime(0.016); // 假设每帧大约 16ms
    const prevStage = this.getStage();
    const nextState = AudioStateMachine.getSpeakState(
      avgAmplitude,
      envLevel,
      fadeThreshold,
      prevStage,
      this.stageTime,
      this.stageDurations
    );

    if (nextState !== prevStage) {
      this.stageTime = 0; // 重置阶段时间
      this.setStage(nextState);
    }
  }
}

export default AudioStateMachine;
export type { AudioData, AudioCallback };
export { AudioStage };
