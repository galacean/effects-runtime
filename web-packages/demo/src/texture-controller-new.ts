/* eslint-disable no-console */
const DEBUG = true;

// 状态机阶段
enum Phase { Listening, Input, Stop }

// 事件类型
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
  profile: 0 | 1 | 2 | 3;      // 模板类型: 0=listeningBlue, 1=listeningGreen, 2=inputA, 3=inputB
  batchId?: number;             // 所属批次ID
  color?: [number, number, number, number]; // 颜色值[r,g,b,a]
}

export class TextureControllerNew {
  // 状态管理
  phase = Phase.Listening;
  groupStart = 0;
  enterAt: number | null = null;
  batchId = 0;
  chainArmed = false;
  stopActive = false;
  volumeThreshold = 0.1;
  lastVolume = 0;

  // 模板持续时间常量（与shader保持一致）
  private readonly PROFILE_DURATION = [3.417, 3.458, 3.7, 3.7]; // LB, LG, IA, IB

  // InputB 模板参数（用于链式触发窗口计算）
  private readonly INPUTB_FADE_IN = 0.7417;
  private readonly INPUTB_FADE_OUT_START = 2.2003;
  private readonly INPUTB_FADE_OUT_END = 2.9253;

  // 事件队列
  events: Event[] = [];

  // 纹理列表
  textures: TexState[] = [];

  // 回调函数
  onStage: (stage: Phase) => void = () => {};
  onUpdate: (textures: TexState[]) => void = () => {};
  onStop: (now: number) => void = () => {};
  onReset: () => void = () => {};

  private nextId = 1;

  constructor(initialVolumeThreshold?: number) {
    if (typeof initialVolumeThreshold === 'number') {
      this.volumeThreshold = initialVolumeThreshold;
    }
    this.resetToListening(performance.now() / 1000);
  }

  setVolumeThreshold(v: number) { this.volumeThreshold = v; }

  // 模板名称到profile索引映射
  private templateToProfile(name: string): 0 | 1 | 2 | 3 {
    switch (name) {
      case 'listeningBlue': return 0;
      case 'listeningGreen': return 1;
      case 'inputA': return 2;
      case 'inputB': return 3;
      default: return 0;
    }
  }

  // 根据模板创建纹理状态
  private createFromTemplate(name: string, start: number): TexState {
    const profile = this.templateToProfile(name);
    return {
      id: this.nextId++,
      startedAt: start,
      profile: profile,
      batchId: name.startsWith('input') ? this.batchId : undefined,
    };
  }

  // 调度事件（按时间排序）
  private schedule(time: number, type: EventType, payload?: any) {
    this.events.push({ time, type, payload });
    this.events.sort((a, b) => a.time - b.time);
  }

  // 处理到期事件
  private processEvents(now: number) {
    while (this.events.length && this.events[0].time <= now) {
      const e = this.events.shift()!;
      this.handle(e, now);
    }
  }

  // 重置到监听状态
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
    const green = this.createFromTemplate('listeningGreen', now);
    this.textures = [blue, green];

    // 计算组结束时间
    const groupEnd = this.groupStart + Math.max(this.PROFILE_DURATION[0], this.PROFILE_DURATION[1]); // 3.458
    this.schedule(groupEnd, EventType.GROUP_TIMEOUT);

    this.onStage?.(Phase.Listening);
    if (DEBUG) console.log('[Listening] start at', this.groupStart, 'groupEnd@', groupEnd);
  }

  // 进入输入状态
  private enterInput(now: number) {
    this.phase = Phase.Input;
    this.batchId += 1;
    this.enterAt = null;
    this.chainArmed = true;
    this.stopActive = false;

    // 生成InputA纹理
    const A = this.createFromTemplate('inputA', now);
    this.textures.push(A);

    // 延迟生成InputB纹理
    this.schedule(now + 0.733, EventType.SPAWN_B, { batchId: this.batchId });

    this.onStage?.(Phase.Input);
    if (DEBUG) console.log('[Input] enter batch', this.batchId);
  }

  // 停止输入状态（提前熄灭）
  stop() {
    if (this.phase !== Phase.Input || this.stopActive) return;
    const now = performance.now() / 1000;
    this.stopActive = true;

    this.phase = Phase.Stop;

    // 清除待生成的B纹理事件
    this.events = this.events.filter(e => !(e.type === EventType.SPAWN_B && e.payload?.batchId === this.batchId));

    this.chainArmed = false;
    this.onStop?.(now);
    if (DEBUG) console.log('[Stop] early fade, batch', this.batchId);
  }

  // 事件处理器
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
          // 组结束时根据音量决定进入输入状态或重置
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
          this.textures.push(B);
          if (DEBUG) console.log('[Input] spawn B for batch', this.batchId);
        }
        break;
      }

      case EventType.CHAIN_TRY:
        if (this.phase === Phase.Input && this.chainArmed && !this.stopActive) {
          this.chainArmed = false;
          this.enterInput(now);
        }
        break;

      case EventType.INPUT_DRAINED:
        if (this.phase === Phase.Input) this.resetToListening(now);
        break;
    }
  }


  // 主更新循环
  update(delta: number, volume: number, now: number) {
    this.lastVolume = volume;

    this.processEvents(now);

    // 监听阶段：音量超过阈值时安排进入输入状态
    if (this.phase === Phase.Listening && this.enterAt == null && volume >= this.volumeThreshold) {
      this.handle({ time: now, type: EventType.VOLUME_ABOVE }, now);
    }

    // 输入阶段：音量低于阈值时停止
    if (this.phase === Phase.Input && !this.stopActive && volume < this.volumeThreshold) {
      this.stop();
    }

    // 输入阶段：链式触发窗口检查
    if (this.phase === Phase.Input && this.chainArmed && !this.stopActive) {
      const B = this.textures.find(t => t.profile === 3 && t.batchId === this.batchId);
      if (B) {
        // 基于B纹理的fade参数计算触发窗口
        const fadeOutStart = this.INPUTB_FADE_OUT_START; // 2.2003
        const fadeIn = this.INPUTB_FADE_IN; // 0.7417
        const halfDisplay = (fadeOutStart - fadeIn) * 0.5; // 后半显示段开始偏移量
        const absStart = B.startedAt + fadeOutStart - halfDisplay; // B.startedAt + 1.471
        const absEnd = B.startedAt + this.INPUTB_FADE_OUT_END; // B.startedAt + 2.9253
        
        if (now >= absStart && now < absEnd && volume >= this.volumeThreshold) {
          this.handle({ time: now, type: EventType.CHAIN_TRY }, now);
        }
      }
    }

    // 清理过期纹理
    this.textures = this.textures.filter(t => {
      const elapsed = now - t.startedAt;
      return elapsed < this.PROFILE_DURATION[t.profile];
    });

    // 检查批次是否耗尽
    const hasInput = this.textures.some(t => t.profile === 2 || t.profile === 3);
    const hasPendingB = this.events.some(e => e.type === EventType.SPAWN_B && e.payload?.batchId === this.batchId);

    if (!hasInput && !hasPendingB) {
      if (this.phase === Phase.Input) {
        // 没有stop时自动返回监听状态
        if (!this.stopActive) {
          this.handle({ time: now, type: EventType.INPUT_DRAINED }, now);
        }
      } else if (this.phase === Phase.Stop) {
        // 保持在Stop状态，不自动重启
      }
    }

    this.onUpdate?.(this.textures);
  }
}
