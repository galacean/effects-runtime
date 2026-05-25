/**
 * 一次 spawn 请求的描述。
 *
 * - count：本次要生成的粒子数
 * - interpStartDt：第一颗粒子相对本帧起点的子帧偏移
 * - intervalDt：粒子之间的子帧间隔
 * - spawnGroup：组标识，用于区分多个 spawn 模块
 *
 * 与 Niagara 的 FNiagaraSpawnInfo 一一对应。
 */
export interface ProSpawnInfo {
  count: number,
  interpStartDt: number,
  intervalDt: number,
  spawnGroup: number,
}

export function createProSpawnInfo (
  count = 0,
  interpStartDt = 0,
  intervalDt = 1,
  spawnGroup = 0,
): ProSpawnInfo {
  return { count, interpStartDt, intervalDt, spawnGroup };
}
