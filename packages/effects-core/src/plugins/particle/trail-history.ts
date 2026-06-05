import { Vector3 } from '@galacean/effects-math/es/core/vector3';

const tempStartPos = new Vector3();

export class TrailHistory {
  readonly maxTrails: number;
  readonly maxPoints: number;

  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly posZ: Float32Array;
  readonly times: Float32Array;
  readonly colorR: Float32Array;
  readonly colorG: Float32Array;
  readonly colorB: Float32Array;
  readonly colorA: Float32Array;
  readonly widths: Float32Array;
  readonly lifetimes: Float32Array;
  readonly seeds: Float32Array;
  readonly cursors: Uint16Array;
  readonly pointCounts: Uint16Array;

  private minimumDistSq: number;
  private checkDistance: boolean;
  private startPosX: Float32Array;
  private startPosY: Float32Array;
  private startPosZ: Float32Array;
  private hasStartPos: Uint8Array;

  constructor (maxTrails: number, maxPoints: number, checkDistance: boolean, minimumDistSq: number) {
    this.maxTrails = maxTrails;
    this.maxPoints = maxPoints;
    this.checkDistance = checkDistance;
    this.minimumDistSq = minimumDistSq;

    const total = maxTrails * maxPoints;

    this.posX = new Float32Array(total);
    this.posY = new Float32Array(total);
    this.posZ = new Float32Array(total);
    this.times = new Float32Array(total);
    this.colorR = new Float32Array(total);
    this.colorG = new Float32Array(total);
    this.colorB = new Float32Array(total);
    this.colorA = new Float32Array(total);
    this.widths = new Float32Array(total);
    this.lifetimes = new Float32Array(total);
    this.seeds = new Float32Array(total);
    this.cursors = new Uint16Array(maxTrails);
    this.pointCounts = new Uint16Array(maxTrails);
    this.startPosX = new Float32Array(maxTrails);
    this.startPosY = new Float32Array(maxTrails);
    this.startPosZ = new Float32Array(maxTrails);
    this.hasStartPos = new Uint8Array(maxTrails);
  }

  addPoint (
    trailIndex: number,
    position: Vector3,
    time: number,
    color: number[],
    width: number,
    lifetime: number,
  ): void {
    const max = this.maxPoints;
    const base = trailIndex * max;
    const cursor = this.cursors[trailIndex];
    const count = this.pointCounts[trailIndex];

    if (this.checkDistance && count > 0) {
      const prevIdx = base + (cursor - 1 + max) % max;
      const dx = position.x - this.posX[prevIdx];
      const dy = position.y - this.posY[prevIdx];
      const dz = position.z - this.posZ[prevIdx];

      if (dx * dx + dy * dy + dz * dz < this.minimumDistSq) {
        return;
      }
    }

    const idx = base + cursor % max;

    this.posX[idx] = position.x;
    this.posY[idx] = position.y;
    this.posZ[idx] = position.z;
    this.times[idx] = time;
    this.colorR[idx] = color[0];
    this.colorG[idx] = color[1];
    this.colorB[idx] = color[2];
    this.colorA[idx] = color[3];
    this.widths[idx] = width;
    this.lifetimes[idx] = lifetime;
    this.seeds[idx] = Math.random();

    this.cursors[trailIndex] = (cursor + 1) % max;
    this.pointCounts[trailIndex] = Math.min(count + 1, max);
  }

  clear (trailIndex: number): void {
    this.cursors[trailIndex] = 0;
    this.pointCounts[trailIndex] = 0;
    this.hasStartPos[trailIndex] = 0;
  }

  clearAll (): void {
    this.cursors.fill(0);
    this.pointCounts.fill(0);
    this.hasStartPos.fill(0);
  }

  minusTime (duration: number): void {
    for (let i = 0; i < this.times.length; i++) {
      this.times[i] -= duration;
    }
  }

  getStartPosition (trailIndex: number): Vector3 | null {
    if (!this.hasStartPos[trailIndex]) {
      return null;
    }

    return tempStartPos.set(this.startPosX[trailIndex], this.startPosY[trailIndex], this.startPosZ[trailIndex]);
  }

  setStartPosition (trailIndex: number, x: number, y: number, z: number): void {
    this.startPosX[trailIndex] = x;
    this.startPosY[trailIndex] = y;
    this.startPosZ[trailIndex] = z;
    this.hasStartPos[trailIndex] = 1;
  }
}
