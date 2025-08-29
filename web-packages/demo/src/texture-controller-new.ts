/* eslint-disable no-console */
const DEBUG = true;

// 状态定义 - 最小化状态机
enum Phase { Listening, Input, Stop }

// 事件类型定义
enum EventType {
  VOLUME_ABOVE = 'VOLUME_ABOVE',
  GROUP_TIMEOUT = 'GROUP_TIMEOUT',
  ENTER_INPUT = 'ENTER_INPUT',
  SPAWN_B = 'SPAWN_B',
  CHAIN_TRY = 'CHAIN_TRY',
  INPUT_DRAINED = 'INPUT_DRAINED',
  EARLY_FADE = 'EARLY_FADE'
}

interface Event {
  time: number;     // 事件触发时间（秒）
  type: EventType;  // 事件类型
  payload?: any;    // 事件负载
}

interface TexState {
  id: number;                   // 纹理唯一ID
  startedAt: number;            // 创建时间戳
  duration: number;             // 总持续时间
  fadeIn: number;               // 渐显时长
  fadeOutStart: number;         // 渐隐开始时间
  fadeOutEnd: number;           // 渐隐结束时间
  distance: number;             // 移动距离
  initialOffsetU?: number;      // 初始U偏移量
  initialOffsetV?: number;      // 初始V偏移量
  type: 'listening' | 'input';  // 纹理类型
  textureType: 'blue' | 'green' | 'input'; // 纹理类型标识
  isSecondTexture?: boolean;    // 标识是否为第二阶段纹理
  color?: [number, number, number, number]; // 颜色值[r,g,b,a]
  batchId?: number;             // 所属批次ID
}

  // 参数模板定义
  const TEMPLATES = {
    // 监听阶段蓝色纹理模板
    listeningBlue: {
      duration: 3.4,
      fadeIn: 0.6,
      fadeOutStart: 2.4,
      fadeOutEnd: 3.4,
      distance: 0.5,
      initialOffsetU: -0.30,
      initialOffsetV: 0.0,
      type: 'listening' as const,
      textureType: 'blue' as const,
      isSecondTexture: false
    },
    
    // 监听阶段绿色纹理模板
    listeningGreen: {
      duration: 3.4,
      fadeIn: 0.6,
      fadeOutStart: 2.4,
      fadeOutEnd: 3.4,
      distance: 0.5,
      initialOffsetU: -0.20,
      initialOffsetV: -0.0,
      type: 'listening' as const,
      textureType: 'green' as const,
      isSecondTexture: false
    },
    
    // 输入阶段纹理A模板
    inputA: {
      duration: 3.7,
      fadeIn: 0.533,
      fadeOutStart: 2.9333,
      fadeOutEnd: 3.6167,
      distance: 1.2315,
      initialOffsetU: -0.48,
      initialOffsetV: 0.0,
      type: 'input' as const,
      textureType: 'input' as const,
      isSecondTexture: false
    },
    
    // 输入阶段纹理B模板
    inputB: {
      duration: 3.7,
      fadeIn: 0.7417,
      fadeOutStart: 2.9333 - 0.733, // 调整淡出时间以匹配延迟
      fadeOutEnd: 3.6167 - 0.733 + 0.0416,
      distance: 1.4164,
      initialOffsetU: -0.48,
      initialOffsetV: -0.1, // 垂直偏移
      type: 'input' as const,
      textureType: 'input' as const,
      isSecondTexture: true
    }
  };

export class TextureControllerNew {
  // 最小状态
  phase = Phase.Listening;
  groupStart = 0;
  enterAt: number | null = null;
  batchId = 0;
  chainArmed = false;
  stopActive = false;
  volumeThreshold = 0.1;
  lastVolume = 0;

  // 事件
  events: Event[] = [];

  // 纹理
  textures: TexState[] = [];

  // 回调
  onStage: (stage: Phase) => void = () => {};
  onUpdate: (textures: TexState[]) => void = () => {};
  onStop: (now: number) => void = () => {};
  onReset: () => void = () => {};

  // 颜色
  firstStageBlueColor: [number, number, number, number] = [0, 0, 1, 1];
  firstStageGreenColor: [number, number, number, number] = [0, 1, 0, 1];
  secondStagePrimaryColor: [number, number, number, number] = [0, 0, 1, 1];
  secondStageSecondaryColor: [number, number, number, number] = [0, 1, 0, 1];

  private nextId = 1;

  constructor(initialVolumeThreshold?: number) {
    if (typeof initialVolumeThreshold === 'number') {
      this.volumeThreshold = initialVolumeThreshold;
    }
    this.resetToListening(performance.now() / 1000);
  }

  setVolumeThreshold(v: number) { this.volumeThreshold = v; }

  // 模板
  private T = TEMPLATES;

  private createFromTemplate(name: keyof typeof TEMPLATES, start: number): TexState {
    const t = this.T[name];
    return {
      id: this.nextId++,
      startedAt: start,
      duration: t.duration,
      fadeIn: t.fadeIn,
      fadeOutStart: t.fadeOutStart,
      fadeOutEnd: t.fadeOutEnd,
      distance: t.distance,
      initialOffsetU: t.initialOffsetU,
      initialOffsetV: t.initialOffsetV,
      type: t.type,
      textureType: t.textureType,
      isSecondTexture: t.isSecondTexture,
      batchId: t.type === 'input' ? this.batchId : undefined,
    };
  }

  private schedule(time: number, type: EventType, payload?: any) {
    this.events.push({ time, type, payload });
    this.events.sort((a, b) => a.time - b.time);
  }

  private processEvents(now: number) {
    while (this.events.length && this.events[0].time <= now) {
      const e = this.events.shift()!;
      this.handle(e, now);
    }
  }

  resetToListening(now: number) {
    this.phase = Phase.Listening;
    this.groupStart = now;
    this.enterAt = null;
    this.batchId = 0;
    this.chainArmed = false;
    this.stopActive = false;
    this.events.length = 0;

    this.onReset?.();

    const blue = this.createFromTemplate('listeningBlue', now);
    blue.color = this.firstStageBlueColor;
    const green = this.createFromTemplate('listeningGreen', now);
    green.color = this.firstStageGreenColor;
    this.textures = [blue, green];

    // 等价旧逻辑：以"监听纹理 duration 的最大值=3.4s"为组结束
    const groupEnd = this.groupStart + Math.max(blue.duration, green.duration); // 3.4
    this.schedule(groupEnd, EventType.GROUP_TIMEOUT);

    this.onStage?.(Phase.Listening);
    if (DEBUG) console.log('[Listening] start at', this.groupStart, 'groupEnd@', groupEnd);
  }

  private enterInput(now: number) {
    this.phase = Phase.Input;
    this.batchId += 1;
    this.enterAt = null;
    this.chainArmed = true;
    this.stopActive = false; // 新批次恢复可用

    // A 立即生成
    const A = this.createFromTemplate('inputA', now);
    A.color = this.secondStagePrimaryColor;
    this.textures.push(A);

    // B 延迟 0.733s（事件队列，无 setTimeout）
    this.schedule(now + 0.733, EventType.SPAWN_B, { batchId: this.batchId });

    this.onStage?.(Phase.Input);
    if (DEBUG) console.log('[Input] enter batch', this.batchId);
  }

  // 提前熄灭：等价旧 stop 行为（CPU 端快速淡出 + 清 pending 事件）
  stop() {
    if (this.phase !== Phase.Input || this.stopActive) return;
    const now = performance.now() / 1000;
    this.stopActive = true;

    // 进入 Stop 阶段，等价旧版
    this.phase = Phase.Stop;

    // 清掉当前批次待生成的 B
    this.events = this.events.filter(e => !(e.type === EventType.SPAWN_B && e.payload?.batchId === this.batchId));

    // 将当前批次 input 纹理改为从 now 起快速淡出（淡出时长不变）
    for (const tex of this.textures) {
      if (tex.type === 'input' && tex.batchId === this.batchId) {
        const elapsed = now - tex.startedAt;
        const outDur = Math.max(0.1, tex.fadeOutEnd - tex.fadeOutStart);
        tex.fadeOutStart = Math.max(tex.fadeIn + 0.001, elapsed);
        tex.fadeOutEnd = tex.fadeOutStart + outDur;
        tex.duration = Math.max(tex.duration, tex.fadeOutEnd + 0.02);
      }
    }

    this.chainArmed = false;
    this.onStop?.(now);
    if (DEBUG) console.log('[Stop] early fade, batch', this.batchId);
  }

  private handle(e: Event, now: number) {
    switch (e.type) {
      case EventType.VOLUME_ABOVE:
        if (this.phase === Phase.Listening && this.enterAt == null) {
          this.enterAt = Math.max(this.groupStart + 2.75, now);
          this.schedule(this.enterAt, EventType.ENTER_INPUT);
          if (DEBUG) console.log('[Listening] first above, enterAt@', this.enterAt);
        }
        break;

      case EventType.GROUP_TIMEOUT:
        if (this.phase === Phase.Listening && this.enterAt == null) {
          // 等价旧逻辑：组结束时，看当时音量决定进入或重启
          if (this.lastVolume >= this.volumeThreshold) {
            this.enterInput(now);
          } else {
            this.resetToListening(now);
          }
        }
        break;

      case EventType.ENTER_INPUT:
        if (this.phase === Phase.Listening) this.enterInput(now);
        break;

      case EventType.SPAWN_B: {
        const { batchId } = e.payload || {};
        if (this.phase === Phase.Input && batchId === this.batchId && !this.stopActive) {
          const B = this.createFromTemplate('inputB', now);
          B.color = this.secondStageSecondaryColor;
          this.textures.push(B);
          if (DEBUG) console.log('[Input] spawn B for batch', this.batchId);
        }
        break;
      }

      case EventType.CHAIN_TRY:
        if (this.phase === Phase.Input && this.chainArmed && !this.stopActive) {
          this.chainArmed = false; // 只允许一次
          this.enterInput(now);
        }
        break;

      case EventType.INPUT_DRAINED:
        if (this.phase === Phase.Input) this.resetToListening(now);
        break;
    }
  }

  setFirstStageColors(blue?: [number, number, number, number], green?: [number, number, number, number]) {
    if (blue) this.firstStageBlueColor = blue;
    if (green) this.firstStageGreenColor = green;
    for (const t of this.textures) {
      if (t.type === 'listening') {
        t.color = (t.textureType === 'blue') ? this.firstStageBlueColor : this.firstStageGreenColor;
      }
    }
  }

  setSecondStageColors(primary?: [number, number, number, number], secondary?: [number, number, number, number]) {
    if (primary) this.secondStagePrimaryColor = primary;
    if (secondary) this.secondStageSecondaryColor = secondary;
    for (const t of this.textures) {
      if (t.type === 'input') {
        t.color = t.isSecondTexture ? this.secondStageSecondaryColor : this.secondStagePrimaryColor;
      }
    }
  }

  update(delta: number, volume: number, now: number) {
    this.lastVolume = volume;

    // 处理到期事件
    this.processEvents(now);

    // 监听阶段：首次越阈值立即预约 enterAt（组起点+2.75 或现在）
    if (this.phase === Phase.Listening && this.enterAt == null && volume >= this.volumeThreshold) {
      this.handle({ time: now, type: EventType.VOLUME_ABOVE }, now);
    }

    // 输入阶段：音量跌破阈值 → 提前淡出（与旧 stop 等价）
    if (this.phase === Phase.Input && !this.stopActive && volume < this.volumeThreshold) {
      this.stop();
    }

    // 输入阶段：链式触发窗口（使用"第二张纹理B"的后半显示区间，与旧逻辑一致）
    if (this.phase === Phase.Input && this.chainArmed && !this.stopActive) {
      const B = this.textures.find(t => t.type === 'input' && t.batchId === this.batchId && t.isSecondTexture);
      if (B) {
        const absStart = B.startedAt + (B.fadeOutStart - (B.fadeOutStart - B.fadeIn) * 0.5); // 显示后半段开始
        const absEnd = B.startedAt + B.fadeOutEnd;
        if (now >= absStart && now < absEnd && volume >= this.volumeThreshold) {
          this.handle({ time: now, type: EventType.CHAIN_TRY }, now);
        }
      }
    }

    // 清理过期纹理
    this.textures = this.textures.filter(t => (now - t.startedAt) < t.duration);

    // 批次耗尽后的处理
    const hasInput = this.textures.some(t => t.type === 'input');
    const hasPendingB = this.events.some(e => e.type === EventType.SPAWN_B && e.payload?.batchId === this.batchId);

    if (!hasInput && !hasPendingB) {
      if (this.phase === Phase.Input) {
        // 仅当没有 stop 时才自动回监听
        if (!this.stopActive) {
          this.handle({ time: now, type: EventType.INPUT_DRAINED }, now); // resetToListening(now)
        }
      } else if (this.phase === Phase.Stop) {
        // 停在 Stop，不自动重启（与老版本一致）
        // 可在这里通知 UI：完全结束，可选
        // this.onStage?.(Phase.Stop);
      }
    }

    this.onUpdate?.(this.textures);
  }

  captureSnapshot() {
    return this.textures.map(t => ({
      id: t.id,
      x: t.initialOffsetU || 0,
      y: t.initialOffsetV || 0,
      alpha: 1,
      initialU: t.initialOffsetU || 0,
      initialV: t.initialOffsetV || 0,
      type: t.type,
      textureType: t.textureType,
      isSecondTexture: t.isSecondTexture
    }));
  }
}
