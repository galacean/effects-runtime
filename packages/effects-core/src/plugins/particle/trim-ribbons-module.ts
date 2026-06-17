import { ParticleModule, ParticleModuleStage } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { ParticleDataBuffer } from './particle-data-buffer';

export type TrimRibbonsModuleData = {
  pointCountPerTrail: number,
};

/**
 * Ribbon 长度裁剪模块。限制每条 ribbon（按 ribbonId 分组）保留的点数，
 * 超额的最旧点（ribbonLinkOrder 最小）标记为死亡（alive[i] = 0），由
 * emitter 的 compactDead 统一压缩移除。
 *
 * 背景：这是为每条 ribbon 设定一个「点数预算」（pointCountPerTrail）的硬上限，
 * 与按 lifetime 自然控制 trail 长度的方式不同 —— 即便点的 lifetime 未到期，
 * 一旦超出预算就裁掉最旧的点。保留此模块是为了与既有 trail 行为逐帧一致。
 *
 * 该模块对 emitter（模拟器）透明，仅作为 trail 模块链的一环存在；emitter 不
 * 感知自己是 trail 还是 sprite。
 *
 * 时序：仅在「主 particleUpdate」裁剪全量存活粒子，对应「spawn 之前、compactDead
 * 之前」的单次全量裁剪。首帧 batch（spawn 后、仅含当帧新生粒子）跳过 —— 新生
 * 粒子当帧不参与裁剪。
 */
export class TrimRibbonsModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  private pointCountPerTrail = 0;

  override fromJSON (data: TrimRibbonsModuleData): void {
    this.pointCountPerTrail = data.pointCountPerTrail;
  }

  override execute (ctx: ParticleModuleContext): void {
    // 首帧 batch 跳过：新生粒子当帧不参与裁剪。
    // 注意：trimRibbons 忽略 ctx.firstIndex/lastIndex、总是扫全量 buffer，所以这道
    // 跳过与「扫全量」是配套不变量 —— 若移除此 early-return，首帧 batch 会触发一次
    // 额外的全量裁剪，把当帧新点也算进预算，导致裁剪时机偏移。两者必须同时保留。
    if (ctx.isFirstFrameUpdate) {
      return;
    }
    this.trimRibbons(ctx.dataBuffer);
  }

  private trimRibbons (db: ParticleDataBuffer): void {
    const cap = this.pointCountPerTrail;
    const ribbonSlots = new Map<number, number[]>();

    for (let i = 0; i < db.numInstances; i++) {
      if (!db.alive[i]) { continue; }
      const rid = db.ribbonId[i];
      let arr = ribbonSlots.get(rid);

      if (!arr) {
        arr = [];
        ribbonSlots.set(rid, arr);
      }
      arr.push(i);
    }

    for (const slots of ribbonSlots.values()) {
      if (slots.length <= cap) { continue; }
      slots.sort((a, b) => db.ribbonLinkOrder[a] - db.ribbonLinkOrder[b]);
      const excess = slots.length - cap;

      for (let i = 0; i < excess; i++) {
        // 标记死亡，由 compactDead 压缩移除
        db.alive[slots[i]] = 0;
      }
    }
  }
}
