/* eslint-disable no-console */
const DEBUG = true;

enum MainStage { Listening, Input, Stop }
enum TexFadeStage { Hidden, FadingIn, Showing, FadingOut }

interface TexState {
  id: number,                   // 纹理唯一ID
  layer: number,                // 渲染层级（0~3）
  groupId?: number,             // 所属纹理组ID（第一阶段）
  batchId?: number,             // 所属input批次ID（第二阶段）
  x: number,                    // 横向位置
  y: number,                    // 纵向位置
  stage: TexFadeStage,          // 当前透明阶段
  alpha: number,                // 当前透明度
  startedAt: number,            // 创建时间戳
  duration: number,             // 总持续时间
  fadeIn: number,               // 渐显时长
  fadeOutStart: number,         // 渐隐开始时间
  fadeOutEnd: number,           // 渐隐结束时间
  distance: number,             // 移动距离
  type: 'listening' | 'input',  // 纹理类型
  textureType: 'blue' | 'green' | 'input', // 纹理类型标识
  triggered?: boolean,          // 是否已触发监听阶段检测
  batchTriggered?: boolean,     // 所属批次是否已触发输入检测
  color?: [number, number, number, number], // 直接颜色值[r,g,b,a]
  colorMode?: number,           // 颜色模式 0:固定 1:动态渐变
  colorStops?: [number, number, number, number][], // 颜色渐变点
  colorSpeed: number,          // 颜色变化速度
  isSecondTexture?: boolean,    // 标识是否为第二阶段纹理
  initialOffsetU?: number,      // 初始U偏移量（第二阶段）
  initialOffsetV?: number,      // 初始V偏移量（第二阶段）
}

export class TextureController {
  textures: TexState[] = [];
  nextId = 1;
  nextLayer = 0;
  currentStage: MainStage = MainStage.Listening;
  volumeThreshold = 0.1; // 默认值
  pendingInputStage = false;    // 标记是否在3.4s触发第二阶段
  stageStartTime = 0;           // 当前阶段开始时间
  listeningTextureColor: 'blue' | 'green' = 'blue'; // 监听阶段纹理颜色控制
  stopActive = false; // 总闸标志，防止在停止期间生成新批次
  allowInputChaining = true; // 是否允许输入阶段链式生成新纹理
  pendingTimers: number[] = []; // 存储pending的计时器ID

  // 第一阶段参数配置
  firstStageParams = {
    // 蓝色光参数
    blue: {
      fadeInStart: 0.000,     // 淡入开始
      fadeInEnd: 0.625,       // 淡入结束
      move1Start: 0.625,      // 第一段移动开始
      move1End: 2.375,        // 第一段移动结束
      move2Start: 2.375,      // 第二段移动开始
      move2End: 3.558,        // 第二段移动结束
      fadeOutStart: 2.375,    // 淡出开始
      fadeOutEnd: 3.417,      // 淡出结束
      initialOffsetU: -0.30,    // 初始U偏移量 (可调整)
      initialOffsetV: 0.0,    // 初始V偏移量 (可调整)
      move1TargetU: 0.1198,  // 第一段移动u偏移量 (从初始偏移量开始)
      move1TargetV: -0.0,   // 第一段移动v偏移量
      move2TargetU: 0.2382,  // 第二段移动u偏移量 (从第一阶段结束位置开始)
      move2TargetV: -0.0,   // 第二段移动v偏移量
      fadeInDeltaV: 0.0,  // 淡入阶段v偏移量
    },

    // 绿色光参数
    green: {
      fadeInStart: 0.500,     // 淡入开始
      fadeInEnd: 1.292,       // 淡入结束
      moveStart: 1.292,       // 移动开始
      moveEnd: 2.875,         // 移动结束
      fadeOutStart: 2.375,    // 淡出开始
      fadeOutEnd: 3.458,      // 淡出结束
      initialOffsetU: -0.20,    // 初始U偏移量 (可调整)
      initialOffsetV: -0.0,    // 初始V偏移量 (可调整)
      moveTargetU: 0.266,   // 移动u偏移量
      moveTargetV: -0.00,    // 移动v偏移量
      fadeInDeltaV: 0.0,  // 淡入阶段v偏移量
    },
  };

  // 参数配置
  listeningDuration = 3.4;
  listeningFadeIn = 0.6;
  listeningFadeOutStart = 2.4;
  listeningFadeOutEnd = 3.4;
  listeningDistance = 0.5; // 对应UV偏移0.5

  inputDuration = 3.7;
  inputFadeIn1 = 0.533;
  inputFadeIn2 = 0.7417; // 第二纹理的渐显时间
  inputInitialOffsetU = -0.48; // 第二阶段初始U偏移量

  inputFadeOutStart = 2.9333;
  InputFadeOutEnd = 3.6167;
  inputDistance1 = 1.2315; // 对应UV偏移（蓝色纹理）
  inputDistance2 = 1.4164; // 对应UV偏移（绿色纹理）
  textureInterval = 733;        // 纹理B生成延迟(毫秒)

  onStage: (stage: MainStage) => void = () => {};
  onUpdate: (textures: TexState[]) => void = () => {};
  onStop: (now: number) => void = () => {};
  onReset: () => void = () => {};

  // 纹理组管理
  listeningGroupId = 0; // 监听阶段纹理组ID
  groupStartedAt = 0; // 当前组开始时间
  groupDuration = 3.458; // 组完整生命周期（取蓝绿光最长时间）
  inputStageTriggered = false; // 当前input批次是否已触发
  pendingTriggerTime = 0; // 记录触发时间点（用于2.75秒逻辑）
  inputBatchId = 0; // 当前input批次ID

  // 第一阶段颜色配置
  firstStageBlueColor: [number, number, number, number] = [0, 0, 1, 1]; // 默认蓝色
  firstStageGreenColor: [number, number, number, number] = [0, 1, 0, 1]; // 默认绿色

  // 第二阶段颜色配置
  secondStagePrimaryColor: [number, number, number, number] = [0, 0, 1, 1]; // 默认蓝色
  secondStageSecondaryColor: [number, number, number, number] = [0, 1, 0, 1]; // 默认绿色

  constructor (initialVolumeThreshold?: number) {
    if (typeof initialVolumeThreshold === 'number') {
      this.volumeThreshold = initialVolumeThreshold;
    }
    this.resetToListening(performance.now() / 1000);
  }

  setVolumeThreshold(threshold: number) {
    this.volumeThreshold = threshold;
  }

  resetToListening (now: number) {
    this.currentStage = MainStage.Listening;
    this.stageStartTime = now;
    this.groupStartedAt = now; // 记录组开始时间
    this.listeningGroupId++; // 生成新组ID
    this.nextLayer = 0;
    this.pendingInputStage = false;
    this.inputStageTriggered = false;
    this.inputBatchId = 0;
    this.pendingTriggerTime = 0; // 重置触发时间点
    this.stopActive = false; // 重置停止激活标志

    // 清理所有pending计时器
    this.pendingTimers.forEach(id => clearTimeout(id));
    this.pendingTimers.length = 0;

    // 触发重置回调，通知Shader重置停止信号
    this.onReset();

    // 创建蓝色和绿色纹理（同一组）
    this.listeningTextureColor = 'blue';
    const blueTexture = this.createTexture('listening', now);

    blueTexture.groupId = this.listeningGroupId;

    this.listeningTextureColor = 'green';
    const greenTexture = this.createTexture('listening', now);

    greenTexture.groupId = this.listeningGroupId;

    this.textures = [blueTexture, greenTexture];

    this.onStage(MainStage.Listening);
    if (DEBUG) {
      console.log(`[组${this.listeningGroupId}] 重置到监听阶段`, this.textures);
    }
  }

  // 设置第一阶段颜色
  setFirstStageColors (blue?: [number, number, number, number], green?: [number, number, number, number]) {
    if (blue) {
      this.firstStageBlueColor = blue;
    }
    if (green) {
      this.firstStageGreenColor = green;
    }

    // 更新现有纹理的颜色
    this.textures.forEach(tex => {
      if (tex.type === 'listening') {
        if (tex.textureType === 'blue') {
          tex.color = this.firstStageBlueColor;
        } else if (tex.textureType === 'green') {
          tex.color = this.firstStageGreenColor;
        }
      }
    });
  }

  // 设置第二阶段颜色
  setSecondStageColors (primary?: [number, number, number, number], secondary?: [number, number, number, number]) {
    if (primary) {
      this.secondStagePrimaryColor = primary;
    }
    if (secondary) {
      this.secondStageSecondaryColor = secondary;
    }

    // 更新现有纹理的颜色
    this.textures.forEach(tex => {
      if (tex.type === 'input') {
        if (!tex.isSecondTexture) {
          tex.color = this.secondStagePrimaryColor;
        } else {
          tex.color = this.secondStageSecondaryColor;
        }
      }
    });
  }

  createTexture (type: 'listening' | 'input', startTime: number): TexState {
    // 明确纹理类型
    const textureType = type === 'input'
      ? 'input'
      : this.listeningTextureColor;

    const tex: TexState = {
      id: this.nextId++,
      layer: this.nextLayer++,
      batchId: type === 'input' ? this.inputBatchId : undefined,
      type,
      textureType, // 使用明确的纹理类型变量
      x: 0,
      y: 0, // 初始化y坐标
      stage: TexFadeStage.FadingIn,
      alpha: 0,
      startedAt: startTime,
      duration: type === 'listening' ? this.listeningDuration : this.inputDuration,
      fadeIn: type === 'listening' ? this.listeningFadeIn : this.inputFadeIn1,
      fadeOutStart: type === 'listening' ? this.listeningFadeOutStart : this.inputFadeOutStart,
      fadeOutEnd: type === 'listening' ? this.listeningFadeOutEnd : this.InputFadeOutEnd,
      distance: type === 'listening' ? this.listeningDistance : this.inputDistance1,
      triggered: false,
      colorSpeed: 1.0,
    };

    // 设置第二阶段初始偏移
    if (type === 'input') {
      tex.initialOffsetU = this.inputInitialOffsetU;
      tex.initialOffsetV = 0; // 默认垂直偏移为0
    }

    if (type === 'listening') {
      // 根据纹理类型选择参数
      const params = textureType === 'blue'
        ? this.firstStageParams.blue
        : this.firstStageParams.green;

      // 应用初始偏移量
      tex.x = params.initialOffsetU;
      tex.y = params.initialOffsetV;
      // 为Shader计算保存初始偏移量
      tex.initialOffsetU = params.initialOffsetU;
      tex.initialOffsetV = params.initialOffsetV;

      // 设置纹理特定颜色
      if (textureType === 'blue') {
        tex.color = this.firstStageBlueColor;
      } else if (textureType === 'green') {
        tex.color = this.firstStageGreenColor;
      }

      tex.colorMode = 0;
    }
    if (type === 'input') {
      // 设置第二阶段纹理颜色
      if (tex.isSecondTexture) {
        tex.color = this.secondStageSecondaryColor;
      } else {
        tex.color = this.secondStagePrimaryColor;
      }
    }

    return tex;
  }

  // 颜色配置
  inputColors = {
    primary: [0, 0, 1, 1] as [number, number, number, number], // 蓝色
    secondary: [0, 1, 0, 1] as [number, number, number, number], // 绿色
    colorMode: 0, // 0:固定 1:动态渐变
    colorStops: [
      [0, 0, 1, 1] as [number, number, number, number], // 蓝色
      [0, 1, 0, 1] as [number, number, number, number], // 绿色
      [1, 0, 0, 1] as [number, number, number, number],  // 红色
    ],
    colorSpeed: 1.0,
  };

  // 设置输入阶段颜色
  setInputColors (colors: {
    primary?: [number, number, number, number],
    secondary?: [number, number, number, number],
    colorMode?: number,
    colorStops?: [number, number, number, number][],
    colorSpeed?: number,
  }) {
    Object.assign(this.inputColors, colors);
  }

  enterInputStage (now: number) {
    if (this.stopActive) return;
    
    // 清 _StopSignal/_StopTime，避免旧事件影响新批次
    this.onReset?.();
    
    this.currentStage = MainStage.Input;
    this.stageStartTime = now;
    this.pendingInputStage = false;
    this.inputBatchId++;

    // 创建输入阶段纹理A
    const texA = this.createTexture('input', now);

    texA.color = this.secondStagePrimaryColor;
    texA.colorMode = 0;
    texA.batchTriggered = false;
    this.textures.push(texA);

    // 保存当前批次ID用于回调
    const capturedBatchId = this.inputBatchId;
    
    // 0.5s后创建纹理B
    const id = window.setTimeout(() => {
      // 兜底：停止了/批次变了/阶段不是Input就不生成
      if (this.stopActive || this.currentStage !== MainStage.Input || this.inputBatchId !== capturedBatchId) return;
      
      const texB = this.createTexture('input', performance.now() / 1000);

      texB.isSecondTexture = true; // 标记为第二阶段纹理

      // 复制初始偏移值
      texB.initialOffsetU = texA.initialOffsetU;
      texB.initialOffsetV = (texA.initialOffsetV || 0) - 0.1; // 继承垂直偏移量


      texB.color = this.secondStageSecondaryColor;
      texB.colorMode = 0;
      texB.batchTriggered = false;
      texB.fadeIn = this.inputFadeIn2; // 使用参数配置中的 inputFadeIn2
      texB.distance = this.inputDistance2; // 使用参数配置中的 inputDistance2

      // 修正：调整绿色纹理渐隐时间，使其与蓝色纹理同时消失
      const delayInSeconds = this.textureInterval / 1000;

      texB.fadeOutStart = this.inputFadeOutStart - delayInSeconds;
      texB.fadeOutEnd = this.InputFadeOutEnd - delayInSeconds + 0.0416;

      this.textures.push(texB);

      if (DEBUG) {
        console.log('生成第二纹理', texB);
      }
    }, this.textureInterval);
    
    // 保存计时器ID以便后续清理
    this.pendingTimers.push(id);

    this.onStage(MainStage.Input);
    if (DEBUG) {
      console.log('进入第二阶段');
    }
  }

  stop () {
    this.currentStage = MainStage.Stop;
    const now = performance.now() / 1000;
    this.stopActive = true; // 设置停止激活标志

    // 清理所有pending计时器
    this.pendingTimers.forEach(id => clearTimeout(id));
    this.pendingTimers.length = 0;

    // 触发stop回调，通知Shader
    this.onStop(now);

    // 延长每个纹理的duration，确保活到淡出结束
    this.textures.forEach(tex => {
      const elapsed = now - tex.startedAt;
      const outDur = Math.max(0.1, tex.fadeOutEnd - tex.fadeOutStart);
      const newFadeOutEnd = elapsed + outDur;
      tex.duration = Math.max(tex.duration, newFadeOutEnd + 0.02); // 增加0.02秒缓冲
    });

    if (DEBUG) {
      console.log('Stop triggered at', now);
    }
  }

  update (delta: number, volume: number, now: number) {
    // 先检查停止条件：在Input阶段且音量低于阈值且未激活停止
    if (this.currentStage === MainStage.Input && volume < this.volumeThreshold && !this.stopActive) {
      this.stopActive = true;
      this.stop();
      if (DEBUG) {
        console.log('音量低于阈值，提前结束输入阶段');
      }
    }

    // 更新所有纹理状态，仅在未停止时检查触发点
    this.textures.forEach(tex => {
      const elapsed = now - tex.startedAt;

      // 精确时间点检测，仅在未停止时进行
      if (!this.stopActive) {
        this.checkTriggerPoints(tex, elapsed, volume, now);
      }
    });

    // 清理结束的纹理
    this.textures = this.textures.filter(
      tex => (now - tex.startedAt) < tex.duration
    );
    // layer自动重排：移除后剩余纹理layer重新编号为0~N
    this.textures.forEach((tex, idx) => {
      tex.layer = idx;
    });
    this.nextLayer = this.textures.length;

    // 2.75秒处理逻辑，仅在未停止时进行
    if (!this.stopActive &&
        this.currentStage === MainStage.Listening &&
        this.pendingTriggerTime > 0
    ) {
      const elapsedSinceTrigger = now - this.pendingTriggerTime;
      const groupElapsed = now - this.groupStartedAt;

      if (groupElapsed >= 2.75) {
        this.enterInputStage(now);
        this.pendingTriggerTime = 0; // 重置触发时间
      }
    }

    // 3.4s阶段转换点 - 使用组时间检测，仅在未停止时进行
    if (!this.stopActive &&
        this.currentStage === MainStage.Listening &&
        this.pendingInputStage &&
        now - this.groupStartedAt >= this.groupDuration) {
      this.enterInputStage(now);
    }

    if (this.currentStage === MainStage.Stop && this.textures.length === 0) {
      this.onStage(MainStage.Stop);
      return; // 停止更新
    }

  }

  /**
   * 捕获当前所有纹理的状态快照
   * @returns 包含所有纹理关键数据的数组
   */
  captureSnapshot (): {
    id: number,
    x: number,
    y: number,
    alpha: number,
    initialU: number,
    initialV: number,
    type: 'listening' | 'input',
    textureType: 'blue' | 'green' | 'input',
    isSecondTexture?: boolean,
  }[] {
    return this.textures.map(tex => {
      // 对于listening类型纹理，从firstStageParams获取初始UV
      let initialU = tex.initialOffsetU || 0;
      let initialV = tex.initialOffsetV || 0;

      if (tex.type === 'listening') {
        const params = tex.textureType === 'blue'
          ? this.firstStageParams.blue
          : this.firstStageParams.green;

        initialU = params.initialOffsetU;
        initialV = params.initialOffsetV;
      }

      return {
        id: tex.id,
        x: tex.x,
        y: tex.y,
        alpha: tex.alpha,
        initialU,
        initialV,
        type: tex.type,
        textureType: tex.textureType,
        isSecondTexture: tex.isSecondTexture,
      };
    });
  }

  /**
   * 手动捕获快照并输出到控制台
   */
  captureManualSnapshot () {
    const snapshots = this.captureSnapshot();
    const jsonData = JSON.stringify(snapshots, null, 2);

    console.log('手动捕获快照:', jsonData);

    // 创建Blob对象并触发下载
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `snapshot-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();

    // 清理资源
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    return snapshots;
  }

  checkTriggerPoints (tex: TexState, elapsed: number, volume: number, now: number) {
    // 监听阶段组生命周期检测 - 基于纹理结束时间
    let groupEnded = false;

    if (
      this.currentStage === MainStage.Listening &&
      !this.pendingInputStage
    ) {
      // 获取组内最晚结束的纹理
      const groupTextures = this.textures.filter(t => t.groupId === this.listeningGroupId);
      const lastEndTime = Math.max(...groupTextures.map(t => t.startedAt + t.duration));

      groupEnded = now >= lastEndTime ;

      if (groupEnded) {
        if (volume > this.volumeThreshold) {
          this.pendingInputStage = true;
          this.pendingTriggerTime = now; // 记录触发时间点
          if (DEBUG) {
            console.log(`[组${this.listeningGroupId}] 音量${volume}超阈值，将在3.4s进入第二阶段`);
          }
        } else {
          // 创建新纹理组
          this.resetToListening(now);
          if (DEBUG) {
            console.log(`[组${this.listeningGroupId}] 音量${volume}未超阈值，生成新监听纹理组`);
          }
        }
      }
    }

    // 监听阶段fadeOut区间持续检测 - 确保与组检测协调
    if (
      tex.type === 'listening' &&
      tex.textureType === 'green' &&
      elapsed >= this.listeningFadeOutStart &&
      elapsed < this.listeningFadeOutEnd &&
      !tex.triggered
    ) {
      // 如果组生命周期尚未结束，则保留原有逻辑
      if (!groupEnded) {
        if (volume > this.volumeThreshold && !this.pendingInputStage) {
          this.pendingInputStage = true;
          this.pendingTriggerTime = now; // 记录触发时间点
          tex.triggered = true;
          if (DEBUG) {
            console.log(`[精确检测] 音量${volume}超阈值，将在2.75s进入第二阶段`);
          }
        }
      }
    }

    // 输入阶段触发检测：在显示阶段后期（75%进度）开始检测
    // 只有在当前阶段是Input且未停止时才允许触发，防止链式生成
    if (this.stopActive || this.currentStage !== MainStage.Input) {
      return; // 不允许再生成
    }
    
    // 输入阶段触发检测：仅当允许链式生成时才启用
    if (this.allowInputChaining &&
        tex.type === 'input' && tex.batchId === this.inputBatchId && tex.isSecondTexture) {
      // 计算触发开始时间：显示阶段结束前25%时间
      const triggerStart = tex.fadeOutStart - (tex.fadeOutStart - tex.fadeIn) * 0.50;

      if (elapsed >= triggerStart && elapsed < tex.fadeOutEnd) {
        // 查找当前批次所有纹理
        const batchTextures = this.textures.filter(t => t.batchId === this.inputBatchId);
        // 只有当前批次所有纹理都未触发过，才允许触发
        const batchAlreadyTriggered = batchTextures.some(t => t.batchTriggered);

        if (!batchAlreadyTriggered && volume > this.volumeThreshold) {
          this.enterInputStage(now);
          batchTextures.forEach(t => t.batchTriggered = true);
          if (DEBUG) {
            console.log(`[精确检测] 音量${volume}超阈值，生成新输入纹理组`);
          }
        }
      }
    }
  }
}
