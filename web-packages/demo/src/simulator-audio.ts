/* eslint-disable brace-style */
interface AudioData {
  textureData: Float32Array,
  floatData: Float32Array,
  frequencyBands: number,
}

type AudioCallback = (audioData: AudioData) => void;

enum AudioStage {
  Silence,
  FadeIn,    // 新增淡入阶段
  Speaking,
  FadeOut
}

class AudioSimulator {
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
  private fadeInDuration: number;   // 新增
  private fadeInTime: number;       // 新增

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

    this.stage = AudioStage.Silence;
    this.fadeOutDuration = 3.0;
    this.fadeOutTime = 0;
    this.fadeInDuration = 1.5; // 默认淡入时长（秒），可自行调整
    this.fadeInTime = 0;
  }

  setStage (stage: AudioStage) {
    if (stage === AudioStage.FadeIn) {
      this.fadeInTime = 0;
    }
    if (stage === AudioStage.FadeOut) {
      this.fadeOutTime = 0;
    }
    this.stage = stage;
  }

  generateFrame (deltaTime: number = 0.016): Float32Array {
    this.time += deltaTime;

    if (this.stage === AudioStage.Silence) {
      this.data.fill(0);
    } else if (this.stage === AudioStage.FadeIn) {
      this.fadeInTime += deltaTime;
      // 计算淡入插值因子
      const fade = Math.min(1, this.fadeInTime / this.fadeInDuration);

      for (let i = 0; i < this.frequencyBands; i++) {
        // 生成目标说话数据
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

        // 插值从0到目标值
        this.data[i] = newValue * fade;
      }
      // 淡入结束后自动切换到 Speaking
      if (this.fadeInTime >= this.fadeInDuration) {
        this.stage = AudioStage.Speaking;
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
    } else if (this.stage === AudioStage.FadeOut) {
      this.fadeOutTime += deltaTime;
      const fade = Math.max(0, 1 - this.fadeOutTime / this.fadeOutDuration);

      for (let i = 0; i < this.frequencyBands; i++) {
        this.data[i] *= fade;
      }
    }

    if (this.stage === AudioStage.FadeOut && this.fadeOutTime >= this.fadeOutDuration) {
      this.stage = AudioStage.Silence;
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

  start (callback?: AudioCallback, fps: number = 60): void {
    if (this.isRunning) {this.stop();}

    this.isRunning = true;
    let lastTime = performance.now();

    const update = (currentTime: number): void => {
      if (!this.isRunning) {return;}

      const deltaTime = (currentTime - lastTime) / 1000;

      lastTime = currentTime;

      this.generateFrame(deltaTime);

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
}

export default AudioSimulator;
export type { AudioData, AudioCallback };
export { AudioStage };