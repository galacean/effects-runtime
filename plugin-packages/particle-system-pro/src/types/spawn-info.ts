/**
 * 一次 spawn 请求的描述。
 *
 * - count：本次要生成的粒子数
 * - interpStartDt：第一颗粒子相对本帧起点的子帧偏移
 * - intervalDt：粒子之间的子帧间隔
 * - sourceAssignment：当前 batch 直接绑定的 per-source source 信息
 *
 * 与 Niagara 的 FNiagaraSpawnInfo 一一对应。
 */
export type ProPerSourceSpawnAssignment = {
  /** 在本帧 source.particleDataSet.getCurrentData() 中的下标，用来取 position / prevPosition */
  srcIdx: number,
  /** 本帧该 source 应 spawn 的 trail 粒子数 */
  count: number,
  /** source 的 UniqueID — trail.RibbonID 直接用这个值 */
  uniqueID: number,
  /**
   * 本帧开始时该 source 的累计移动距离（世界单位）。
   * Sample 用 `distAtFrameStart + frameSegLen * (k+0.5)/count` 计算
   * 每个新 trail 粒子的 RibbonUVDistance。
   */
  distAtFrameStart: number,
  /** 本帧 source 的移动距离 |position - previousPosition| */
  frameSegLen: number,
};

export interface ProSpawnInfo {
  count: number,
  interpStartDt: number,
  intervalDt: number,
  sourceAssignment?: ProPerSourceSpawnAssignment | null,
}

export function createProSpawnInfo (
  count = 0,
  interpStartDt = 0,
  intervalDt = 1,
  sourceAssignment: ProPerSourceSpawnAssignment | null = null,
): ProSpawnInfo {
  return { count, interpStartDt, intervalDt, sourceAssignment };
}
