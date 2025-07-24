/* eslint-disable no-console */
const DEBUG = true;

enum MainStage { Listening, Input, Stop }
enum TexFadeStage { Hidden, FadingIn, Showing, FadingOut }

interface TexState {
  id: number,                   // 纹理唯一ID
  x: number,                    // 横向位置
  stage: TexFadeStage,          // 当前透明阶段
  alpha: number,                // 当前透明度
  startedAt: number,            // 创建时间戳
  duration: number,             // 总持续时间
  fadeIn: number,               // 渐显时长
  fadeOutStart: number,         // 渐隐开始时间
  fadeOutEnd: number,           // 渐隐结束时间
  distance: number,             // 移动距离
  type: 'listening' | 'input',  // 纹理类型
  triggered?: boolean,          // 是否已触发检测
  color?: [number, number, number, number]; // 直接颜色值[r,g,b,a]
  colorMode?: number;           // 颜色模式 0:固定 1:动态渐变
  colorStops?: [number, number, number, number][]; // 颜色渐变点
  colorSpeed: number;          // 颜色变化速度
}

export class TextureController {
  textures: TexState[] = [];
  nextId = 1;
  currentStage: MainStage = MainStage.Listening;
  volumeThreshold = 0.1;
  pendingInputStage = false;    // 标记是否在3.4s触发第二阶段
  stageStartTime = 0;           // 当前阶段开始时间

  // 参数配置
  listeningDuration = 3.4;
  listeningFadeIn = 0.6;
  listeningFadeOutStart = 2.4;
  listeningFadeOutEnd = 3.4;
  listeningDistance = 100; // 对应UV偏移0.5

  inputDuration = 2.4;
  inputFadeIn = 0.4;
  inputFadeOutStart = 1.9;
  inputDistance = 200; // 对应UV偏移1.0
  textureInterval = 500;        // 纹理B生成延迟(毫秒)

  onStage: (stage: MainStage) => void = () => {};
  onUpdate: (textures: TexState[]) => void = () => {};

  constructor () {
    this.resetToListening(performance.now() / 1000);
  }

  resetToListening (now: number) {
    this.currentStage = MainStage.Listening;
    this.stageStartTime = now;
    this.textures = [this.createTexture('listening', now)];
    this.onStage(MainStage.Listening);
    if (DEBUG) {
      console.log('重置到监听阶段', this.textures);
    }
  }

  createTexture (type: 'listening' | 'input', startTime: number): TexState {
    return {
      id: this.nextId++,
      type,
      x: 0,
      stage: TexFadeStage.FadingIn,
      alpha: 0,
      startedAt: startTime,
      duration: type === 'listening' ? this.listeningDuration : this.inputDuration,
      fadeIn: type === 'listening' ? this.listeningFadeIn : this.inputFadeIn,
      fadeOutStart: type === 'listening' ? this.listeningFadeOutStart : this.inputFadeOutStart,
      fadeOutEnd: type === 'listening' ? this.listeningFadeOutEnd : this.inputDuration,
      distance: type === 'listening' ? this.listeningDistance : this.inputDistance,
      triggered: false,
      colorSpeed: 1.0 // 默认颜色变化速度
    };
  }

  // 颜色配置
  inputColors = {
    primary: [0, 0, 1, 1] as [number, number, number, number], // 蓝色
    secondary: [0, 1, 0, 1] as [number, number, number, number], // 绿色
    colorMode: 0, // 0:固定 1:动态渐变
    colorStops: [
      [0, 0, 1, 1] as [number, number, number, number], // 蓝色
      [0, 1, 0, 1] as [number, number, number, number], // 绿色
      [1, 0, 0, 1] as [number, number, number, number]  // 红色
    ],
    colorSpeed: 1.0
  };

  // 设置输入阶段颜色
  setInputColors(colors: {
    primary?: [number, number, number, number],
    secondary?: [number, number, number, number],
    colorMode?: number,
    colorStops?: [number, number, number, number][],
    colorSpeed?: number
  }) {
    Object.assign(this.inputColors, colors);
  }

  enterInputStage (now: number) {
    this.currentStage = MainStage.Input;
    this.stageStartTime = now;
    this.pendingInputStage = false;

    // 创建输入阶段纹理A
    const texA = this.createTexture('input', now);
    texA.color = this.inputColors.primary;
    texA.colorMode = this.inputColors.colorMode;
    texA.colorStops = this.inputColors.colorStops;
    texA.colorSpeed = this.inputColors.colorSpeed;

    this.textures.push(texA);

    // 0.5s后创建纹理B
    setTimeout(() => {
      const texB = this.createTexture('input', performance.now() / 1000);
      texB.color = this.inputColors.secondary;
      texB.colorMode = this.inputColors.colorMode;
      texB.colorStops = this.inputColors.colorStops;
      texB.colorSpeed = this.inputColors.colorSpeed;

      this.textures.push(texB);

      if (DEBUG) {
        console.log('生成第二纹理', texB);
      }
    }, this.textureInterval);

    this.onStage(MainStage.Input);
    if (DEBUG) {
      console.log('进入第二阶段');
    }
  }

  stop () {
    this.currentStage = MainStage.Stop;
    this.textures = [];
    this.onStage(MainStage.Stop);
  }

  update (delta: number, volume: number, now: number) {
    // 更新所有纹理状态
    this.textures.forEach(tex => {
      const elapsed = now - tex.startedAt;
      const lifeProgress = elapsed / tex.duration;

      // 更新位置
      tex.x = tex.distance * (1 - lifeProgress);

      // 更新透明度
      if (elapsed < tex.fadeIn) {
        tex.alpha = elapsed / tex.fadeIn;
        tex.stage = TexFadeStage.FadingIn;
      } else if (elapsed < tex.fadeOutStart) {
        tex.alpha = 1;
        tex.stage = TexFadeStage.Showing;
      } else if (elapsed < tex.fadeOutEnd) {
        tex.alpha = 1 - (elapsed - tex.fadeOutStart) /
                   (tex.fadeOutEnd - tex.fadeOutStart);
        tex.stage = TexFadeStage.FadingOut;
      } else {
        tex.alpha = 0;
        tex.stage = TexFadeStage.Hidden;
      }

      // 更新颜色 (如果是动态模式)
      if (tex.colorMode === 1 && tex.colorStops && tex.colorStops.length > 1) {
        const t = (Math.sin(now * tex.colorSpeed) * 0.5 + 0.5);
        const colorIndex = Math.floor(t * (tex.colorStops.length - 1));
        const nextIndex = Math.min(colorIndex + 1, tex.colorStops.length - 1);
        const lerpT = t * (tex.colorStops.length - 1) - colorIndex;
        
        const colorA = tex.colorStops[colorIndex];
        const colorB = tex.colorStops[nextIndex];
        tex.color = [
          colorA[0] + (colorB[0] - colorA[0]) * lerpT,
          colorA[1] + (colorB[1] - colorA[1]) * lerpT,
          colorA[2] + (colorB[2] - colorA[2]) * lerpT,
          colorA[3] + (colorB[3] - colorA[3]) * lerpT
        ];
      }

      // 精确时间点检测
      this.checkTriggerPoints(tex, elapsed, volume, now);
    });

    // 清理结束的纹理
    this.textures = this.textures.filter(
      tex => (now - tex.startedAt) < tex.duration
    );

    // 3.4s阶段转换点
    if (this.currentStage === MainStage.Listening &&
        this.pendingInputStage &&
        now - this.stageStartTime >= this.listeningFadeOutEnd) {
      this.enterInputStage(now);
    }
  }

  checkTriggerPoints (tex: TexState, elapsed: number, volume: number, now: number) {
    // 监听阶段2.4s检测点
    if (tex.type === 'listening' &&
        Math.abs(elapsed - this.listeningFadeOutStart) < 0.05 &&
        !tex.triggered) {
      tex.triggered = true;

      if (volume > this.volumeThreshold && !this.pendingInputStage) {
        this.pendingInputStage = true;
        if (DEBUG) {
          console.log(`[精确检测] 音量${volume}超阈值，将在3.4s进入第二阶段`);
        }
      } else if (!this.pendingInputStage) {
        const newTex = this.createTexture('listening', now);

        this.textures.push(newTex);
        if (DEBUG) {
          console.log(`[精确检测] 音量${volume}未超阈值，生成新监听纹理`, newTex);
        }
      }
    }

    // 输入阶段1.9s检测点
    if (tex.type === 'input' &&
        Math.abs(elapsed - this.inputFadeOutStart) < 0.05 &&
        !tex.triggered) {
      tex.triggered = true;

      if (volume > this.volumeThreshold) {
        this.enterInputStage(now);
        if (DEBUG) {
          console.log(`[精确检测] 音量${volume}超阈值，生成新输入纹理组`);
        }
      }
    }
  }
}
