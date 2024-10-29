import { buildAdaptiveBezier } from './build-adaptive-bezier';
import { ShapePrimitive } from './shape-primitive';
import { triangulate } from './triangulate';

export enum StarType {
  Star,
  Polygon
}

export class PolyStar extends ShapePrimitive {
  /**
   * 多边形顶点数量
   */
  pointCount = 0;
  /**
   * 外半径大小
   */
  outerRadius = 0;
  /**
   * 内半径大小
   */
  innerRadius = 0;
  /**
   * 外顶点圆滑度百分比
   */
  outerRoundness = 0;
  /**
   * 内顶点圆滑度百分比
   */
  innerRoundness = 0;
  /**
   * PolyStar 类型
   */
  starType = StarType.Polygon;
  /**
   * bezier 顶点
   */
  private v: number[] = [];
  /**
   * bezier 缓入点
   */
  private in: number[] = [];
  /**
   * bezier 缓出点
   */
  private out: number[] = [];

  constructor (pointCount = 0, outerRadius = 0, innerRadius = 0, outerRoundness = 0, innerRoundness = 0, starType = StarType.Star) {
    super();
    this.pointCount = pointCount;
    this.outerRadius = outerRadius;
    this.innerRadius = innerRadius;
    this.outerRoundness = outerRoundness;
    this.innerRoundness = innerRoundness;
    this.starType = starType;
  }

  override clone (): ShapePrimitive {
    const polyStar = new PolyStar(
      this.pointCount,
      this.outerRadius,
      this.innerRadius,
      this.outerRoundness,
      this.innerRoundness,
      this.starType
    );

    return polyStar;
  }

  override copyFrom (source: PolyStar): void {
    this.pointCount = source.pointCount;
    this.outerRadius = source.outerRadius;
    this.innerRadius = source.innerRadius;
    this.outerRoundness = source.outerRoundness;
    this.innerRoundness = source.innerRoundness;
    this.starType = source.starType;
  }

  override copyTo (destination: PolyStar): void {
    destination.pointCount = this.pointCount;
    destination.outerRadius = this.outerRadius;
    destination.innerRadius = this.innerRadius;
    destination.outerRoundness = this.outerRoundness;
    destination.innerRoundness = this.innerRoundness;
    destination.starType = this.starType;
  }

  override build (points: number[]): void {

    switch (this.starType) {
      case StarType.Star:{
        this.buildStarPath();

        break;
      }
      case StarType.Polygon:{
        this.buildPolygonPath();

        break;
      }
    }

    const smoothness = 1;

    for (let i = 0;i < this.v.length - 2;i += 2) {
      buildAdaptiveBezier(
        points,
        this.v[i], this.v[i + 1],
        this.out[i], this.out[i + 1], this.in[i + 2], this.in[i + 3], this.v[i + 2], this.v[i + 3],
        smoothness
      );
    }

    // draw last curve
    const lastIndex = this.v.length - 1;

    buildAdaptiveBezier(
      points,
      this.v[lastIndex - 1], this.v[lastIndex],
      this.out[lastIndex - 1], this.out[lastIndex], this.in[0], this.in[1], this.v[0], this.v[1],
      smoothness
    );

  }
  override triangulate (points: number[], vertices: number[], verticesOffset: number, indices: number[], indicesOffset: number): void {
    const triangles = triangulate([points]);

    for (let i = 0; i < triangles.length; i++) {
      vertices[verticesOffset + i] = triangles[i];
    }

    const vertexCount = triangles.length / 2;

    for (let i = 0; i < vertexCount; i++) {
      indices[indicesOffset + i] = i;
    }
  }

  private buildStarPath () {
    this.v = [];
    this.in = [];
    this.out = [];

    const numPts = Math.floor(this.pointCount) * 2;
    const angle = (Math.PI * 2) / numPts;
    let longFlag = true;
    const longRad = this.outerRadius;
    const shortRad = this.innerRadius;
    const longRound = this.outerRoundness / 100;
    const shortRound = this.innerRoundness / 100;
    const longPerimSegment = (2 * Math.PI * longRad) / (numPts * 2);
    const shortPerimSegment = (2 * Math.PI * shortRad) / (numPts * 2);
    let i;
    let rad;
    let roundness;
    let perimSegment;
    let currentAng = -Math.PI / 2;

    const dir = 1;

    for (i = 0; i < numPts; i ++) {
      rad = longFlag ? longRad : shortRad;
      roundness = longFlag ? longRound : shortRound;
      perimSegment = longFlag ? longPerimSegment : shortPerimSegment;
      const x = rad * Math.cos(currentAng);
      const y = rad * Math.sin(currentAng);
      const ox = x === 0 && y === 0 ? 0 : y / Math.sqrt(x * x + y * y);
      const oy = x === 0 && y === 0 ? 0 : -x / Math.sqrt(x * x + y * y);
      const offset = i * 2;

      this.v[offset] = x;
      this.v[offset + 1] = y;
      this.in[offset] = x + ox * perimSegment * roundness * dir;
      this.in[offset + 1] = y + oy * perimSegment * roundness * dir;
      this.out[offset] = x - ox * perimSegment * roundness * dir;
      this.out[offset + 1] = y - oy * perimSegment * roundness * dir;
      longFlag = !longFlag;
      currentAng += angle * dir;
    }
  }

  private buildPolygonPath () {
    this.v = [];
    this.in = [];
    this.out = [];

    const numPts = Math.floor(this.pointCount);
    const angle = (Math.PI * 2) / numPts;
    const rad = this.outerRadius;
    const roundness = this.outerRoundness / 100;
    const perimSegment = (2 * Math.PI * rad) / (numPts * 4);
    let i;
    let currentAng = -Math.PI * 0.5;
    const dir = 1;

    for (i = 0; i < numPts; i ++) {
      const x = rad * Math.cos(currentAng);
      const y = rad * Math.sin(currentAng);
      const ox = x === 0 && y === 0 ? 0 : y / Math.sqrt(x * x + y * y);
      const oy = x === 0 && y === 0 ? 0 : -x / Math.sqrt(x * x + y * y);

      const offset = i * 2;

      this.v[offset] = x;
      this.v[offset + 1] = y;
      this.in[offset] = x + ox * perimSegment * roundness * dir;
      this.in[offset + 1] = y + oy * perimSegment * roundness * dir;
      this.out[offset] = x - ox * perimSegment * roundness * dir;
      this.out[offset + 1] = y - oy * perimSegment * roundness * dir;
      currentAng += angle * dir;
    }
  }
}