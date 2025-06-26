/* eslint-disable brace-style */
interface AudioData {
  textureData: Float32Array,
  floatData: Float32Array,
  frequencyBands: number,
}

type AudioCallback = (audioData: AudioData) => void;

enum AudioStage {
  Idle,
  FadeIn,    // 新增淡入阶段
  Speaking,
  FadeOut
}

class AudioStateMachine {
  public readonly frequencyBands: number;
  private data: Float32Array;
  private time: number;
  private isRunning: boolean;
  private animationId: number | null;

  private bassWeight: number;
  private midWeight: number;
  private highWeight: number;
  private smoothingFactor: number;

  private stage: AudioStage;
  private fadeOutDuration: number;
  private fadeOutTime: number;
  private fadeInDuration: number;
  private fadeInTime: number;

  // 新增：自动循环状态相关
  private autoLoop: boolean = false;
  private autoLoopTimer: number | null = null;

  // 新增：用于淡出阶段的快照
  private fadeOutStartData: Float32Array | null = null;

  // 新增：真实数据标志
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
    this.time = 0;
    this.isRunning = false;
    this.animationId = null;

    this.bassWeight = 1.2;
    this.midWeight = 1.0;
    this.highWeight = 0.7;
    this.smoothingFactor = 0.75; // 降低平滑系数

    this.stage = AudioStage.Idle; // 初始状态为 Idle
    this.fadeOutDuration = 20.0;
    this.fadeOutTime = 0;
    this.fadeInDuration = 3.0; // 默认淡入时长（秒），可自行调整
    this.fadeInTime = 0;
  }

  setStage (stage: AudioStage) {
    this.stage = stage;
    this.stageTime = 0;
    if (stage === AudioStage.FadeIn) { this.fadeInTime = 0; }
    if (stage === AudioStage.FadeOut) {
      this.fadeOutTime = 0;
      this.fadeOutStartData = this.data.slice(); // 记录淡出起始能量
    }
  }

  setStageDuration (stage: AudioStage, duration: number) {
    this.stageDurations[stage] = duration;
  }

  public updateStageTime (deltaTime: number) {
    this.stageTime += deltaTime;
  }

  /**
   * 推进状态机并自动切换状态（会自动调用 setStage）
   * 返回新的 fadeProgressGlobal、fadeProgressMask、当前状态
   */
  public driveState (
    fadeProgressGlobal: number,
    fadeProgressMask: number,
    shaderParams: { fadeSpeedGlobal: number, fadeSpeedMask: number }
  ): {
      fadeProgressGlobal: number,
      fadeProgressMask: number,
      speakState: AudioStage,
    } {
    let newFadeProgressGlobal = fadeProgressGlobal;
    let newFadeProgressMask = fadeProgressMask;
    let newSpeakState = this.stage;

    if (this.stage === AudioStage.FadeIn) {
      newFadeProgressGlobal -= shaderParams.fadeSpeedGlobal;
      newFadeProgressMask -= shaderParams.fadeSpeedMask;
      if (newFadeProgressGlobal < 0) { newFadeProgressGlobal = 0; }
      if (newFadeProgressMask < 0) { newFadeProgressMask = 0; }
      if (newFadeProgressGlobal === 0 && newFadeProgressMask === 0) {
        this.setStage(AudioStage.Speaking);
        newSpeakState = AudioStage.Speaking;
      }
    } else if (this.stage === AudioStage.Speaking) {
      newFadeProgressGlobal = 0;
      newFadeProgressMask = 0;
    } else if (this.stage === AudioStage.FadeOut) {
      if (newFadeProgressMask < 1) {
        newFadeProgressMask += shaderParams.fadeSpeedMask;
        if (newFadeProgressMask > 1) { newFadeProgressMask = 1; }
      }
      if (newFadeProgressGlobal < 1) {
        newFadeProgressGlobal += shaderParams.fadeSpeedGlobal;
        if (newFadeProgressGlobal > 1) { newFadeProgressGlobal = 1; }
      }
      if (newFadeProgressGlobal === 1 && newFadeProgressMask === 1) {
        this.setStage(AudioStage.Idle);
        newSpeakState = AudioStage.Idle;
      }
    } else if (this.stage === AudioStage.Idle) {
      newFadeProgressGlobal = 1;
      newFadeProgressMask = 1;
    }

    return {
      fadeProgressGlobal: newFadeProgressGlobal,
      fadeProgressMask: newFadeProgressMask,
      speakState: this.stage,
    };
  }

  generateFrame (deltaTime: number = 0.016): Float32Array {
    this.time += deltaTime;
    this.stageTime += deltaTime;

    if (this.stage === AudioStage.Idle) {
      this.data.fill(0);
      if (this.stageTime >= this.stageDurations[AudioStage.Idle]) {
        this.setStage(AudioStage.FadeIn);
      }
    } else if (this.stage === AudioStage.FadeIn) {
      this.fadeInTime += deltaTime;
      const fade = Math.min(1, this.fadeInTime / this.stageDurations[AudioStage.FadeIn]);

      for (let i = 0; i < this.frequencyBands; i++) {
        const normalizedIndex = i / (this.frequencyBands - 1);
        const base =
          Math.sin(this.time * 2.0 + normalizedIndex * Math.PI * 8.0) * (1.0 - normalizedIndex) * 2.5 +
          Math.sin(this.time * 1.3 + normalizedIndex * Math.PI * 3.0) * 1.2 +
          Math.sin(this.time * 3.7 + normalizedIndex * Math.PI * 12.0) * 0.7 +
          1.5 * (1.0 - normalizedIndex) +
          0.5;
        const noise = (Math.random() - 0.5) * 0.18;
        const amplitude = base + noise;
        const newValue = Math.max(0, Math.min(1, amplitude));

        // 线性插值从0到目标值
        this.data[i] = newValue * fade;
      }
      if (this.fadeInTime >= this.stageDurations[AudioStage.FadeIn]) {
        this.setStage(AudioStage.Speaking);
      }
    } else if (this.stage === AudioStage.Speaking) {
      for (let i = 0; i < this.frequencyBands; i++) {
        const normalizedIndex = i / (this.frequencyBands - 1);
        const base =
          Math.sin(this.time * 2.0 + normalizedIndex * Math.PI * 8.0) * (1.0 - normalizedIndex) * 2.5 +
          Math.sin(this.time * 1.3 + normalizedIndex * Math.PI * 3.0) * 1.2 +
          Math.sin(this.time * 3.7 + normalizedIndex * Math.PI * 12.0) * 0.7 +
          1.5 * (1.0 - normalizedIndex) +
          0.5;
        const noise = (Math.random() - 0.5) * 0.18;
        const amplitude = base + noise;
        const newValue = Math.max(0, Math.min(1, amplitude));

        this.data[i] = this.data[i] * this.smoothingFactor + newValue * (1 - this.smoothingFactor);
      }
      if (this.stageTime >= this.stageDurations[AudioStage.Speaking]) {
        this.setStage(AudioStage.FadeOut);
      }
    } else if (this.stage === AudioStage.FadeOut) {
      this.fadeOutTime += deltaTime;
      const fade = Math.max(0, 1 - this.fadeOutTime / this.stageDurations[AudioStage.FadeOut]);

      if (this.fadeOutStartData) {
        for (let i = 0; i < this.frequencyBands; i++) {
          // 线性插值到0，和fadeIn一致
          this.data[i] = this.fadeOutStartData[i] * fade;
        }
      }
      if (this.fadeOutTime >= this.stageDurations[AudioStage.FadeOut]) {
        this.setStage(AudioStage.Idle);
        this.fadeOutStartData = null;
      }
    }

    return this.data;
  }

  getTextureData (): Float32Array {
    // 创建 RGBA 格式的浮点纹理数据
    const textureData = new Float32Array(this.frequencyBands * 4);

    for (let i = 0; i < this.frequencyBands; i++) {
      const value = this.data[i]; // 直接使用 0-1 范围的浮点值
      const index = i * 4;

      textureData[index] = value;     // R 红色通道
      textureData[index + 1] = value; // G 绿色通道
      textureData[index + 2] = value; // B 蓝色通道
      textureData[index + 3] = value;   // A 透明度通道 (完全不透明)
    }

    return textureData;
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
    let lastTime = performance.now();

    const update = (currentTime: number): void => {
      if (!this.isRunning) {return;}
      const deltaTime = (currentTime - lastTime) / 1000;

      lastTime = currentTime;

      if (!this.useRealData) {
        this.generateFrame(deltaTime);
      }
      // 如果 useRealData 为 true，则 this.data 由外部 setRealData 注入

      if (callback) {
        callback({
          textureData: this.getTextureData(),
          floatData: this.data,
          frequencyBands: this.frequencyBands,
        });
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

  // 新增插值和分段公式
  private lerp (a: number, b: number, t: number): number {
    return a * (1 - t) + b * t;
  }

  private bassFormula (normalizedIndex: number): number {
    return this.bassWeight * (
      Math.sin(this.time * 1.8 + normalizedIndex * Math.PI * 4) * 0.3 + 0.4 +
      Math.sin(this.time * 0.6) * 0.25 +
      Math.sin(this.time * 3.2) * 0.15
    );
  }

  private midFormula (normalizedIndex: number, i: number): number {
    return this.midWeight * (
      Math.sin(this.time * 2.5 + normalizedIndex * Math.PI * 6) * 0.25 + 0.35 +
      Math.sin(this.time * 1.2 + i * 0.08) * 0.2 +
      Math.sin(this.time * 4.5 + normalizedIndex * 8) * 0.1
    );
  }

  private highFormula (normalizedIndex: number, i: number): number {
    return this.highWeight * (
      Math.sin(this.time * 4 + normalizedIndex * Math.PI * 8) * 0.2 + 0.25 +
      Math.sin(this.time * 7 + i * 0.3) * 0.15 +
      (Math.random() - 0.5) * 0.1 + 0.1
    );
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
    //const triggerLevel = envLevel + fadeThreshold;
    //打印avgAmplitude
    //(`Avg Amplitude: ${avgAmplitude}, Prev State: ${prevState}, Stage Time: ${stageTime}`);

    if (prevState === AudioStage.Idle && avgAmplitude > fadeThreshold) {
      return AudioStage.FadeIn;
    }
    if (prevState === AudioStage.FadeIn) {
      // 淡入阶段只持续设定时长
      if (stageTime >= stageDurations[AudioStage.FadeIn]) {
        return AudioStage.Speaking;
      }

      return AudioStage.FadeIn;
    }
    if (prevState === AudioStage.Speaking && avgAmplitude < fadeThreshold) {
      return AudioStage.FadeOut;
    }
    if (prevState === AudioStage.FadeOut) {
      // 淡出阶段只持续设定时长
      if (stageTime >= stageDurations[AudioStage.FadeOut]) {
        return AudioStage.Idle;
      }

      return AudioStage.FadeOut;
    }

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
    const nextState = AudioStateMachine.getSpeakState(
      avgAmplitude,
      envLevel,
      fadeThreshold,
      this.getStage(),
      this.getStageTime(),
      this.getStageDurations()
    );

    //打印nextState
    //(`Next State: ${nextState}`);
    if (nextState !== this.getStage()) {
      this.setStage(nextState);
    }
  }
}

/**
 * 状态机驱动淡入淡出，返回新的 fadeProgressGlobal、fadeProgressMask、speakState 和 fadeMode
 */
function driveSpeakState (
  speakState: AudioStage,
  fadeProgressGlobal: number,
  fadeProgressMask: number,
  shaderParams: { fadeSpeedGlobal: number, fadeSpeedMask: number }
): {
    fadeProgressGlobal: number,
    fadeProgressMask: number,
    speakState: AudioStage,
  } {
  let newFadeProgressGlobal = fadeProgressGlobal;
  let newFadeProgressMask = fadeProgressMask;
  let newSpeakState = speakState;

  if (speakState === AudioStage.FadeIn) {
    newFadeProgressGlobal -= shaderParams.fadeSpeedGlobal;
    newFadeProgressMask -= shaderParams.fadeSpeedMask;
    if (newFadeProgressGlobal < 0) {newFadeProgressGlobal = 0;}
    if (newFadeProgressMask < 0) {newFadeProgressMask = 0;}
    if (newFadeProgressGlobal === 0 && newFadeProgressMask === 0) {
      newSpeakState = AudioStage.Speaking;
    }
  } else if (speakState === AudioStage.Speaking) {
    newFadeProgressGlobal = 0;
    newFadeProgressMask = 0;
  } else if (speakState === AudioStage.FadeOut) {
    if (newFadeProgressMask < 1) {
      newFadeProgressMask += shaderParams.fadeSpeedMask;
      if (newFadeProgressMask > 1) {newFadeProgressMask = 1;}
    }
    if (newFadeProgressGlobal < 1) {
      newFadeProgressGlobal += shaderParams.fadeSpeedGlobal;
      if (newFadeProgressGlobal > 1) {newFadeProgressGlobal = 1;}
    }
    if (newFadeProgressGlobal === 1 && newFadeProgressMask === 1) {
      newSpeakState = AudioStage.Idle;
    }
  } else if (speakState === AudioStage.Idle) {
    newFadeProgressGlobal = 1;
    newFadeProgressMask = 1;
  }

  return {
    fadeProgressGlobal: newFadeProgressGlobal,
    fadeProgressMask: newFadeProgressMask,
    speakState: newSpeakState,
  };
}

export default AudioStateMachine;
export type { AudioData, AudioCallback };
export { AudioStage };