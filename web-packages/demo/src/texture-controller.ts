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
  isSecondTexture?: boolean;    // 标识是否为第二阶段纹理
}

export class TextureController {
  textures: TexState[] = [];
  nextId = 1;
  nextLayer = 0;
  currentStage: MainStage = MainStage.Listening;
  volumeThreshold = 0.1;
  pendingInputStage = false;    // 标记是否在3.4s触发第二阶段
  stageStartTime = 0;           // 当前阶段开始时间
  listeningTextureColor: 'blue' | 'green' = 'blue'; // 监听阶段纹理颜色控制

  // 第一阶段参数配置
  firstStageParams = {
    // 蓝色光参数
    blue: {
      fadeInStart: 0.000,     // 淡入开始
      fadeInEnd: 0.625,       // 淡入结束
      move1Start: 0.625,      // 第一段移动开始
      move1End: 2.375,        // 第一段移动结束
      move2Start: 2.375,      // 第二段移动开始
      move2End: 3.458,        // 第二段移动结束
      fadeOutStart: 2.375,    // 淡出开始
      fadeOutEnd: 3.417,      // 淡出结束
      initialOffsetU: 0.50,    // 初始U偏移量 (可调整)
      initialOffsetV: 0.50,    // 初始V偏移量 (可调整)
      move1TargetU: -0.1198,  // 第一段移动u偏移量 (从初始偏移量开始)
      move1TargetV: 0.0112,   // 第一段移动v偏移量
      move2TargetU: -0.2382,  // 第二段移动u偏移量 (从第一阶段结束位置开始)
      move2TargetV: 0.0141,   // 第二段移动v偏移量
      fadeInDeltaV: -0.0413,  // 淡入阶段v偏移量
    },
    
    // 绿色光参数
    green: {
      fadeInStart: 0.500,     // 淡入开始
      fadeInEnd: 1.292,       // 淡入结束
      moveStart: 1.292,       // 移动开始
      moveEnd: 2.875,         // 移动结束
      fadeOutStart: 2.375,    // 淡出开始
      fadeOutEnd: 3.458,      // 淡出结束
      initialOffsetU: 0.0,    // 初始U偏移量 (可调整)
      initialOffsetV: 0.0,    // 初始V偏移量 (可调整)
      moveTargetU: -0.2669,   // 移动u偏移量
      moveTargetV: 0.0542,    // 移动v偏移量
      fadeInDeltaV: -0.0333,  // 淡入阶段v偏移量
    }
  };

  // 参数配置
  listeningDuration = 3.4;
  listeningFadeIn = 0.6;
  listeningFadeOutStart = 2.4;
  listeningFadeOutEnd = 3.4;
  listeningDistance = 0.5; // 对应UV偏移0.5

  inputDuration = 3.0;
  inputFadeIn1 = 0.333;
  inputFadeIn2 = 0.5417; // 第二纹理的渐显时间

  inputFadeOutStart = 1.8333;
  InputFadeOutEnd = 2.4167;
  inputDistance1 = 0.6315; // 对应UV偏移1.0（蓝色纹理）
  inputDistance2 = 0.8164; // 对应UV偏移1.5（绿色纹理）
  textureInterval = 583;        // 纹理B生成延迟(毫秒)

  onStage: (stage: MainStage) => void = () => {};
  onUpdate: (textures: TexState[]) => void = () => {};

  // 纹理组管理
  listeningGroupId = 0; // 监听阶段纹理组ID
  groupStartedAt = 0; // 当前组开始时间
  groupDuration = 3.458; // 组完整生命周期（取蓝绿光最长时间）
  inputStageTriggered = false; // 当前input批次是否已触发
  inputBatchId = 0; // 当前input批次ID

  // 第一阶段颜色配置
  firstStageBlueColor: [number, number, number, number] = [0, 0, 1, 1]; // 默认蓝色
  firstStageGreenColor: [number, number, number, number] = [0, 1, 0, 1]; // 默认绿色
  
  // 第二阶段颜色配置
  secondStagePrimaryColor: [number, number, number, number] = [0, 0, 1, 1]; // 默认蓝色
  secondStageSecondaryColor: [number, number, number, number] = [0, 1, 0, 1]; // 默认绿色

  constructor () {
    this.resetToListening(performance.now() / 1000);
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

      if (type === 'listening') {
        // 根据纹理类型选择参数
        const params = textureType === 'blue' 
          ? this.firstStageParams.blue 
          : this.firstStageParams.green;
          
        // 应用初始偏移量
        tex.x = params.initialOffsetU;
        tex.y = params.initialOffsetV;
      
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

    // 0.5s后创建纹理B
    setTimeout(() => {
      const texB = this.createTexture('input', performance.now() / 1000);
      texB.isSecondTexture = true; // 标记为第二阶段纹理

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

    this.onStage(MainStage.Input);
    if (DEBUG) {
      console.log('进入第二阶段');
    }
  }

  stop () {
    this.currentStage = MainStage.Stop;
    const now = performance.now() / 1000;

    this.textures.forEach(tex => {
      // 如果还没进入渐隐阶段，则强制进入渐隐
      if (tex.stage !== TexFadeStage.FadingOut && tex.stage !== TexFadeStage.Hidden) {
        const elapsed = now - tex.startedAt;
        // 使用相对时间设置渐隐参数
        tex.fadeOutStart = elapsed;
        // 确保渐隐时长至少0.1秒
        const fadeOutDuration = Math.max(0.1, tex.fadeOutEnd - tex.fadeOutStart);
        tex.fadeOutEnd = elapsed + fadeOutDuration;
        tex.stage = TexFadeStage.FadingOut;
      }
    });
  }

  update (delta: number, volume: number, now: number) {

    // 更新所有纹理状态
    this.textures.forEach(tex => {
      const elapsed = now - tex.startedAt;
      
      // ===== 第一阶段特殊处理 =====
      // 第一阶段纹理：只执行第一阶段的位置和透明度计算
      if (tex.type === 'listening') {
        if (tex.textureType === 'blue') {
          const params = this.firstStageParams.blue;
          
          // 蓝色光处理逻辑 - 基于相对时间
          if (elapsed < params.fadeInEnd) {
            const progress = elapsed / params.fadeInEnd;
            tex.alpha = progress;
            // 应用初始偏移 + 淡入阶段垂直移动
            tex.y = params.initialOffsetV + params.fadeInDeltaV * progress;
          }
          else if (elapsed < params.move1End) {
            const progress = (elapsed - params.fadeInEnd) / 
                            (params.move1End - params.fadeInEnd);
            // 第一段移动 (同时改变U和V)
            tex.x = params.initialOffsetU + params.move1TargetU * progress;
            tex.y = params.initialOffsetV + params.fadeInDeltaV + params.move1TargetV * progress;
          }
          else if (elapsed < params.move2End) {
            const progress = (elapsed - params.move1End) / 
                            (params.move2End - params.move1End);
            // 第二段移动 (同时改变U和V)
            tex.x = params.initialOffsetU + params.move1TargetU + 
                    (params.move2TargetU - params.move1TargetU) * progress;
            tex.y = params.initialOffsetV + params.fadeInDeltaV + params.move1TargetV + 
                    (params.move2TargetV - params.move1TargetV) * progress;
          }
          
          // 透明度处理 (独立于位置变化)
          if (elapsed < params.fadeInEnd) {
            tex.alpha = elapsed / params.fadeInEnd;
          } else if (elapsed >= params.fadeOutStart) {
            if (elapsed < params.fadeOutEnd) {
              tex.alpha = 1 - (elapsed - params.fadeOutStart) / 
                         (params.fadeOutEnd - params.fadeOutStart);
            } else {
              tex.alpha = 0;
            }
          } else {
            tex.alpha = 1;
          }
        }
        else if (tex.textureType === 'green') {
          const params = this.firstStageParams.green;
          
          // 绿色光处理逻辑 - 基于相对时间
          if (elapsed < params.fadeInEnd) {
            const progress = elapsed / params.fadeInEnd;
            tex.alpha = progress;
            // 应用初始偏移 + 淡入阶段垂直移动
            tex.y = params.initialOffsetV + params.fadeInDeltaV * progress;
          }
          else if (elapsed < params.moveEnd) {
            const progress = (elapsed - params.fadeInEnd) / 
                            (params.moveEnd - params.fadeInEnd);
            // 移动阶段 (同时改变U和V)
            tex.x = params.initialOffsetU + params.moveTargetU * progress;
            tex.y = params.initialOffsetV + params.fadeInDeltaV + params.moveTargetV * progress;
          }
          
          // 透明度处理 (独立于位置变化)
          if (elapsed < params.fadeInEnd) {
            tex.alpha = elapsed / params.fadeInEnd;
          } else if (elapsed >= params.fadeOutStart) {
            if (elapsed < params.fadeOutEnd) {
              tex.alpha = 1 - (elapsed - params.fadeOutStart) / 
                         (params.fadeOutEnd - params.fadeOutStart);
            } else {
              tex.alpha = 0;
            }
          } else {
            tex.alpha = 1;
          }
        }
      }
      // 第二阶段纹理：只执行第二阶段的位置和透明度计算
      else {
        const lifeProgress = elapsed / tex.duration;

        // 更新位置 (x和y)
        tex.x = tex.distance * lifeProgress;
        tex.y = 0; // 暂时设置为0，后续根据需求添加y轴运动
        
        // 为第二阶段纹理添加额外偏移
        if (tex.isSecondTexture) {
          tex.x -= 0.185;
        }

        // 更新透明度
        if (elapsed < tex.fadeIn) {
          tex.alpha = elapsed / tex.fadeIn;
          tex.stage = TexFadeStage.FadingIn;
        } else if (elapsed < tex.fadeOutStart) {
          tex.alpha = 1;
          tex.stage = TexFadeStage.Showing;
        } else if (elapsed < tex.fadeOutEnd) {
          tex.alpha = Math.max(1 - (elapsed - tex.fadeOutStart) /
                     (tex.fadeOutEnd - tex.fadeOutStart), 0);
          tex.stage = TexFadeStage.FadingOut;
        } else {
          tex.alpha = 0;
          tex.stage = TexFadeStage.Hidden;
        }
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
          colorA[3] + (colorB[3] - colorA[3]) * lerpT,
        ];
      }

      // 精确时间点检测
      this.checkTriggerPoints(tex, elapsed, volume, now);
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

    if (
      this.currentStage === MainStage.Input &&
      volume < this.volumeThreshold
    ) {
      this.stop();
      if (DEBUG) {
        console.log('音量低于阈值，提前结束输入阶段');
      }

    }

    // 3.4s阶段转换点 - 使用组时间检测
    if (this.currentStage === MainStage.Listening &&
        this.pendingInputStage &&
        now - this.groupStartedAt >= this.groupDuration) {
      this.enterInputStage(now);
    }

    if (
      this.currentStage === MainStage.Stop &&
    this.textures.every(tex => tex.stage === TexFadeStage.Hidden || tex.alpha === 0)
    ) {
      this.textures = [];
      this.onStage(MainStage.Stop);

      return; // 停止更新
    }

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
      groupEnded = now >= lastEndTime;
      
      if (groupEnded) {
        if (volume > this.volumeThreshold) {
          this.pendingInputStage = true;
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
      elapsed >= this.listeningFadeOutStart &&
      elapsed < this.listeningFadeOutEnd &&
      !tex.triggered
    ) {
      // 如果组生命周期尚未结束，则保留原有逻辑
      if (!groupEnded) {
        if (volume > this.volumeThreshold && !this.pendingInputStage) {
          this.pendingInputStage = true;
          tex.triggered = true;
          if (DEBUG) {
            console.log(`[精确检测] 音量${volume}超阈值，将在3.4s进入第二阶段`);
          }
        }
      }
    }

    // 输入阶段触发检测：在显示阶段后期（75%进度）开始检测
    if (tex.type === 'input' && tex.batchId === this.inputBatchId) {
      // 计算触发开始时间：显示阶段结束前25%时间
      const triggerStart = tex.fadeOutStart - (tex.fadeOutStart - tex.fadeIn) * 0.20;
      
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
