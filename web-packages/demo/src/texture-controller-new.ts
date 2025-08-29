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
  profile: 0 | 1 | 2 | 3;      // 模板类型: 0=listeningBlue, 1=listeningGreen, 2=inputA, 3=inputB
  batchId?: number;             // 所属批次ID
  color?: [number, number, number, number]; // 颜色值[r,g,b,a]
}

  // 参数模板定义（保留用于参考，实际参数已移至shader）
  // 所有模板参数现在在shader的getProfileParams函数中硬编码

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

  // 模板持续时间常量（与shader中的getProfileParams保持一致）
  private readonly PROFILE_DURATION = [3.417, 3.458, 3.7, 3.7]; // LB, LG, IA, IB

  // InputB 模板参数（用于链式触发窗口精确计算）
  private readonly INPUTB_FADE_IN = 0.7417;
  private readonly INPUTB_FADE_OUT_START = 2.2003;
  private readonly INPUTB_FADE_OUT_END = 2.9253;

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

  // 模板到profile的映射
  private templateToProfile(name: string): 0 | 1 | 2 | 3 {
    switch (name) {
      case 'listeningBlue': return 0;
      case 'listeningGreen': return 1;
      case 'inputA': return 2;
      case 'inputB': return 3;
      default: return 0;
    }
  }

  private createFromTemplate(name: string, start: number): TexState {
    const profile = this.templateToProfile(name);
    return {
      id: this.nextId++,
      startedAt: start,
      profile: profile,
      batchId: name.startsWith('input') ? this.batchId : undefined,
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

    // 使用PROFILE_DURATION计算组结束时间
    const groupEnd = this.groupStart + Math.max(this.PROFILE_DURATION[0], this.PROFILE_DURATION[1]); // 3.458
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

  // 提前熄灭：使用shader的_StopSignal和_StopTime机制
  stop() {
    if (this.phase !== Phase.Input || this.stopActive) return;
    const now = performance.now() / 1000;
    this.stopActive = true;

    // 进入 Stop 阶段
    this.phase = Phase.Stop;

    // 清掉当前批次待生成的 B
    this.events = this.events.filter(e => !(e.type === EventType.SPAWN_B && e.payload?.batchId === this.batchId));

    // 不再手动修改纹理参数，让shader处理快速熄灭
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
      if (t.profile === 0) { // listeningBlue
        t.color = this.firstStageBlueColor;
      } else if (t.profile === 1) { // listeningGreen
        t.color = this.firstStageGreenColor;
      }
    }
  }

  setSecondStageColors(primary?: [number, number, number, number], secondary?: [number, number, number, number]) {
    if (primary) this.secondStagePrimaryColor = primary;
    if (secondary) this.secondStageSecondaryColor = secondary;
    for (const t of this.textures) {
      if (t.profile === 2) { // inputA
        t.color = this.secondStagePrimaryColor;
      } else if (t.profile === 3) { // inputB
        t.color = this.secondStageSecondaryColor;
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

    // 输入阶段：链式触发窗口 - 基于B纹理的时序常量精确计算
    if (this.phase === Phase.Input && this.chainArmed && !this.stopActive) {
      // 查找当前批次的B纹理
      const B = this.textures.find(t => t.profile === 3 && t.batchId === this.batchId);
      if (B) {
        // 精确计算触发窗口：基于B纹理的fade参数
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

    // 清理过期纹理 - 使用PROFILE_DURATION
    this.textures = this.textures.filter(t => {
      const elapsed = now - t.startedAt;
      return elapsed < this.PROFILE_DURATION[t.profile];
    });

    // 批次耗尽后的处理 - 检查是否有输入阶段的纹理（profile 2或3）
    const hasInput = this.textures.some(t => t.profile === 2 || t.profile === 3);
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
      x: 0, // 这些值现在由shader计算，不再需要
      y: 0,
      alpha: 1,
      initialU: 0,
      initialV: 0,
      type: t.profile < 2 ? 'listening' : 'input', // 根据profile推断类型
      textureType: t.profile === 0 ? 'blue' : t.profile === 1 ? 'green' : 'input',
      isSecondTexture: t.profile === 3 // 只有inputB是第二阶段纹理
    }));
  }
}
