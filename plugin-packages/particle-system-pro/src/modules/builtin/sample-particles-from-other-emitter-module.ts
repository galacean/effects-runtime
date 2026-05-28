import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProEmitterInstance } from '../../simulation/emitter-instance';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';

export interface ProSampleParticlesFromOtherEmitterModuleProps extends ProModuleProps {
  sourceEmitterName: string,
}

const tmpCurrPos: [number, number, number] = [0, 0, 0];
const tmpPrevPos: [number, number, number] = [0, 0, 0];

/**
 * 「每条 source 粒子轨迹生成一条独立 trail」的 spawn 端模块（ParticleSpawn 阶段）。
 *
 * 与 UE Niagara `Sample Particles From Other Emitter` 对齐：
 * - 如果当前 spawn batch 直接携带了 `sourceAssignment`，就按它给整批
 *   trail 粒子定位 source 和 batch 内偏移；
 * - 位置在 source 的 previousPosition→position 之间按 (k+0.5)/count 插值
 *   ——把同一帧 spawn 的 N 个粒子均匀分布在 source 本帧路径上，避免
 *   "全堆在 currPos" 引起的退化短段 / 三角形重叠；
 * - RibbonID = source.UniqueID。Ribbon Renderer 自动按 RibbonID 分组成
 *   独立 ribbon。
 *
 * 当前 batch 没带 `sourceAssignment`，或 assignment.count 与本批大小不一致时，
 * 视为配置/调度错误：显式报错并跳过本批，不再退回 round-robin 生成错误 ribbon。
 *
 * 调度前提：source emitter 必须先于 trail emitter 在 system 内 addEmitter。
 */
export class ProSampleParticlesFromOtherEmitterModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  sourceEmitterName = '';

  private trailAccessors: ProStandardAccessors | null = null;
  private trailLayout: unknown = null;
  private sourceAccessors: ProStandardAccessors | null = null;
  private sourceLayout: unknown = null;
  private resolvedSource: ProEmitterInstance | null = null;
  private resolvedSourceName = '';
  private missingSourceAssignmentLogged = false;
  private mismatchedSourceAssignmentLogged = false;

  override toJSON (): ProSampleParticlesFromOtherEmitterModuleProps {
    return { sourceEmitterName: this.sourceEmitterName };
  }

  override fromJSON (data: ProSampleParticlesFromOtherEmitterModuleProps): void {
    if (typeof data.sourceEmitterName === 'string') {
      this.sourceEmitterName = data.sourceEmitterName;
    }
  }

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.Position, T.Vec3), access: 'write' },
      { variable: createProVariable(V.PreviousPosition, T.Vec3), access: 'write' },
      { variable: createProVariable(V.RibbonID, T.Int32), access: 'write' },
      { variable: createProVariable(V.RibbonUVDistance, T.Float), access: 'write' },
    ];
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, emitterInstance, systemInstance } = ctx;

    if (!dataBuffer || firstInstance >= lastInstance) {
      return;
    }
    if (!this.sourceEmitterName) {
      return;
    }
    const trailLayout = emitterInstance.particleDataSet?.layout ?? null;

    if (!trailLayout) {
      return;
    }

    // 解析 source emitter — 名字变了或没缓存时重查
    if (this.resolvedSource === null || this.resolvedSourceName !== this.sourceEmitterName) {
      this.resolvedSource = systemInstance.getEmitterByName(this.sourceEmitterName);
      this.resolvedSourceName = this.sourceEmitterName;
      this.sourceLayout = null;
      // 拓扑检查：source 必须排在 trail 之前，否则本帧读到的是上一帧 source 状态
      if (this.resolvedSource) {
        const emitters = systemInstance.emitters;
        const srcIdx = emitters.indexOf(this.resolvedSource);
        const selfIdx = emitters.indexOf(emitterInstance);

        if (srcIdx > selfIdx) {
          console.warn(`[ProSampleParticlesFromOtherEmitter] source emitter "${this.sourceEmitterName}" is added after trail emitter; trail will read stale (previous-frame) source state. Add source first.`);
        }
      }
    }
    const source = this.resolvedSource;

    if (!source || source === emitterInstance) {
      return;
    }
    const sourceBuffer = source.particleDataSet?.getCurrentData() ?? null;
    const numSrc = sourceBuffer?.numInstances ?? 0;

    if (!sourceBuffer || numSrc === 0) {
      return;
    }

    if (this.trailLayout !== trailLayout) {
      this.trailAccessors = new ProStandardAccessors(trailLayout);
      this.trailLayout = trailLayout;
    }
    if (this.sourceLayout !== source.particleDataSet?.layout) {
      this.sourceAccessors = new ProStandardAccessors(source.particleDataSet!.layout);
      this.sourceLayout = source.particleDataSet!.layout;
    }
    const tA = this.trailAccessors!;
    const sA = this.sourceAccessors!;
    const totalToFill = lastInstance - firstInstance;
    const currentSrc = ctx.spawnBatch?.sourceAssignment ?? null;

    // —— 路径 A：当前 spawn batch 直接携带了 per-source assignment ——
    if (currentSrc && currentSrc.count === totalToFill) {
      this.missingSourceAssignmentLogged = false;
      this.mismatchedSourceAssignmentLogged = false;
      sA.position.get(sourceBuffer, currentSrc.srcIdx, tmpCurrPos);
      sA.previousPosition.get(sourceBuffer, currentSrc.srcIdx, tmpPrevPos);

      let kInBatch = 0;

      for (let i = firstInstance; i < lastInstance; i++) {
        // (k+0.5)/count：把粒子放在 [0, 1] 内 N 个等分中点上。
        // 选这个分布而非 k/(N-1) 或 (k+1)/(N+1) 的理由：跨帧粒子间距与
        // 帧内粒子间距完全一致（source 等速时），ribbon 沿源轨迹间隔均匀，
        // 不会在帧边界出现节奏感的突变。
        const t = (kInBatch + 0.5) / currentSrc.count;
        const px = tmpPrevPos[0] + (tmpCurrPos[0] - tmpPrevPos[0]) * t;
        const py = tmpPrevPos[1] + (tmpCurrPos[1] - tmpPrevPos[1]) * t;
        const pz = tmpPrevPos[2] + (tmpCurrPos[2] - tmpPrevPos[2]) * t;

        tA.position.set(dataBuffer, i, px, py, pz);
        // previousPosition 同步设成 spawn 位置，让首帧 CalculateAccurateVelocity
        // 反算速度 = 0（trail 粒子默认静止），避免任何依赖 prevPos 的模块读到
        // InitializeParticle 留下的 positionOrigin（与实际 spawn 位置不一致）。
        tA.previousPosition.set(dataBuffer, i, px, py, pz);
        tA.ribbonId.set(dataBuffer, i, currentSrc.uniqueID);
        // RibbonUVDistance 沿 source 路径单调推进：本帧粒子按 (k+0.5)/N
        // 分布在 [distAtFrameStart, distAtFrameStart + frameSegLen] 内
        const uvDist = currentSrc.distAtFrameStart + currentSrc.frameSegLen * t;

        tA.ribbonUVDistance.set(dataBuffer, i, uvDist);

        kInBatch++;
      }

      return;
    }

    // —— 路径 B：缺失 assignment / count 不匹配 —— 显式报错并跳过本批 ——
    if (!currentSrc) {
      if (!this.missingSourceAssignmentLogged) {
        console.error(`[ProSampleParticlesFromOtherEmitter] missing sourceAssignment for emitter "${emitterInstance.name || '<anonymous>'}" sampling source emitter "${this.sourceEmitterName}". Add and pair ProSpawnPerSourceParticleModule, otherwise this module cannot assign source particles correctly.`);
        this.missingSourceAssignmentLogged = true;
      }
      this.mismatchedSourceAssignmentLogged = false;

      return;
    }

    if (!this.mismatchedSourceAssignmentLogged) {
      console.error(`[ProSampleParticlesFromOtherEmitter] sourceAssignment.count (${currentSrc.count}) does not match spawn batch size (${totalToFill}) for emitter "${emitterInstance.name || '<anonymous>'}" sampling source emitter "${this.sourceEmitterName}". Skipping this spawn batch to avoid generating invalid ribbons.`);
      this.mismatchedSourceAssignmentLogged = true;
    }
    this.missingSourceAssignmentLogged = false;

    return;
  }
}
