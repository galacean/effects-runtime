import type { Engine, GeometryDrawMode, spec } from '@galacean/effects';
import { Geometry } from '@galacean/effects';
import { SphereGeometryData } from './sphere';
import { BoxGeometryData } from './box';
import type { GeometryData } from './geometry';
import { CylinderGeometryData } from './cylinder';
import { ConeGeometryData } from './cone';
import { TorusGeometryData } from './torus';
import { PlaneGeometryData } from './plane';
import { FrustumGeometryData } from './frustum';
import { DirectionLightData } from './direction-light';
import { PointLightData } from './point-light';
import { SpotLightData } from './spot-light';
import { FloorLineEdgeGeometryData } from './floor-line-edge';

/**
 * 几何体类型
 */
export enum GeometryType {
  Box,
  Sphere,
  Cylinder,
  Cone,
  Torus,
  Frustum,
  Sprite,
  Plane,
  DirectionLight,
  SpotLight,
  PointLight,
  FloorGrid,
}

/**
 * 几何体参数
 */
export interface MeshOption {
  size: any,
  color?: spec.vec3,
  renderMode: GeometryDrawMode,
  depthTest?: boolean,
  name?: string,
  alpha?: number,
}

/**
 * 合并多个几何体数据
 * @param geometries - 几何体数据数组
 * @returns 合并后的几何体数据
 */
// export function combineGeometries (geometries: GeometryData[]): GeometryData {
//   const points: number[] = [];
//   const indices: number[] = [];
//   const uvs: number[] = [];
//   const normals: number[] = [];

//   for (let i = 0, indicesBase = 0; i < geometries.length; i++) {
//     const geometryData = geometries[i];
//     if (geometryData) {
//       points.push(...geometryData.points);
//       uvs.push(...geometryData.uvs);
//       normals.push(...geometryData.normals);
//       geometryData.indices.forEach(index => indices.push(index + indicesBase));
//       indicesBase += geometryData.points.length;
//     }
//   }

//   return {
//     points,
//     indices,
//     uvs,
//     normals,
//   };
// }

/**
 * 创建几何体对象
 * @param type - 几何体类型
 * @param size - 几何体尺寸
 * @param renderMode - 绘制模式：`gl.TRIANGLES`、`gl.LINES`
 * @returns
 */
export function createGeometry (engine: Engine, type: GeometryType, size: Record<string, any>, renderMode?: GeometryDrawMode): Geometry {
  let geometryData: GeometryData;

  switch (type) {
    case GeometryType.Sphere:
      geometryData = new SphereGeometryData(size.radius, size.widthSegments, size.heightSegments);

      break;
    case GeometryType.Cylinder:
      geometryData = new CylinderGeometryData(size.radius, size.radius, size.height);

      break;
    case GeometryType.Cone:
      geometryData = new ConeGeometryData(size.radius, size.height);

      break;
    case GeometryType.Torus:
      geometryData = new TorusGeometryData(size.radius, size.tube, size.radialSegments, size.tubularSegments, size.arc);

      break;
    case GeometryType.Sprite:
    case GeometryType.Plane:
      geometryData = new PlaneGeometryData(size.width, size.height);

      break;
    case GeometryType.Frustum:
      geometryData = new FrustumGeometryData(size.position, size.rotation, size.fov, size.aspect, size.near, size.far);

      break;
    case GeometryType.DirectionLight:
      geometryData = new DirectionLightData(size.radius, size.length, size.segments4, size.linesNumber, size.thetaStart, size.thetaLength);

      break;
    case GeometryType.PointLight:
      geometryData = new PointLightData(size.range, size.segments, size.thetaStart, size.thetaLength);

      break;
    case GeometryType.SpotLight:
      geometryData = new SpotLightData(size.range, size.spotAngle, size.segments, size.thetaStart, size.thetaLength);

      break;
    case GeometryType.FloorGrid:
      geometryData = new FloorLineEdgeGeometryData(size.sideLength, size.parts);

      break;
    default:
      geometryData = new BoxGeometryData(size.width, size.height, size.depth);

      break;
  }
  const result = Geometry.create(
    engine,
    {
      attributes: {
        a_Position: {
          size: 3,
          data: new Float32Array(geometryData.points),
        },
        a_Normal: {
          size: 3,
          data: new Float32Array(geometryData.normals),
        },
        a_UV1: {
          size: 2,
          data: new Float32Array(geometryData.uvs),
        },
      },
      indices: {
        data: new Uint16Array(geometryData.indices),
      },
      mode: renderMode,
      drawCount: geometryData.indices.length,
    });

  return result;
}
