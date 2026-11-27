import { Geometry, math, type Engine, type GeometryDrawMode, type spec } from '@galacean/effects';
const { Vector3 } = math;

export enum PrimitiveType { Box, Sphere, Cylinder, Cone, Torus, Plane }

export interface PrimitiveGeometryOptions {
  width?: number, height?: number, depth?: number, radius?: number, tube?: number,
  widthSegments?: number, heightSegments?: number, radialSegments?: number, tubularSegments?: number, arc?: number,
}

interface GeometryData { points: number[], normals: number[], uvs: number[], indices: number[] }

/**
 * 创建几何体对象
 * @param type - 几何体类型
 * @param size - 几何体尺寸
 * @param renderMode - 绘制模式：`gl.TRIANGLES`、`gl.LINES`
 * @returns
 */
export function createPrimitiveGeometry (engine: Engine, type: PrimitiveType, size: PrimitiveGeometryOptions, renderMode?: GeometryDrawMode): Geometry {
  let geometryData: GeometryData;

  switch (type) {
    case PrimitiveType.Sphere:
      geometryData = createSphereData(size.radius, size.widthSegments, size.heightSegments);

      break;
    case PrimitiveType.Cylinder:
      geometryData = createCylinderData(size.radius, size.radius, size.height, size.radialSegments, size.heightSegments);

      break;
    case PrimitiveType.Cone:
      geometryData = createCylinderData(0, size.radius, size.height);

      break;
    case PrimitiveType.Torus:
      geometryData = createTorusData(size.radius, size.tube, size.radialSegments, size.tubularSegments, size.arc);

      break;
    case PrimitiveType.Plane:
      geometryData = createPlaneData(size.width, size.height);

      break;
    default:
      geometryData = createBoxData(size.width, size.height, size.depth);

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

function createBoxData (width = 1, height = 1, depth = 1): GeometryData {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  let numberOfVertices = 0;

  buildPlane(2, 1, 0, - 1, - 1, depth, height, width, data.points, data.uvs, data.normals, data.indices); // px
  buildPlane(2, 1, 0, 1, - 1, depth, height, - width, data.points, data.uvs, data.normals, data.indices); // nx
  buildPlane(0, 2, 1, 1, 1, width, depth, height, data.points, data.uvs, data.normals, data.indices); // py
  buildPlane(0, 2, 1, 1, - 1, width, depth, - height, data.points, data.uvs, data.normals, data.indices); // ny
  buildPlane(0, 1, 2, 1, - 1, width, height, depth, data.points, data.uvs, data.normals, data.indices); // pz
  buildPlane(0, 1, 2, - 1, - 1, width, height, - depth, data.points, data.uvs, data.normals, data.indices); // nz

  function buildPlane (u: number, v: number, w: number, uDir: number,
    vDir: number, width: number, height: number, depth: number,
    points: number[], uvs: number[], normals: number[], indices: number[]) {

    const widthHalf = width / 2;
    const heightHalf = height / 2;
    const depthHalf = depth / 2;
    const point: spec.vec3 = [0, 0, 0];
    let vertexCounter = 0;

    for (let iy = 0; iy < 2; iy++) {
      const y = iy * height - heightHalf;

      for (let ix = 0; ix < 2; ix++) {
        const x = ix * width - widthHalf;

        point[u] = x * uDir;
        point[v] = y * vDir;
        point[w] = depthHalf;

        points.push(...point);

        point[u] = 0;
        point[v] = 0;
        point[w] = depth > 0 ? 1 : - 1;

        normals.push(...point);

        uvs.push(ix);
        uvs.push(1 - iy);

        vertexCounter += 1;
      }
    }

    for (let iy = 0; iy < 1; iy++) {
      for (let ix = 0; ix < 1; ix++) {
        const a = numberOfVertices + ix + 2 * iy;
        const b = numberOfVertices + ix + 2 * (iy + 1);
        const c = numberOfVertices + (ix + 1) + 2 * (iy + 1);
        const d = numberOfVertices + (ix + 1) + 2 * iy;

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    numberOfVertices += vertexCounter;
  }

  return data;
}

function createSphereData (radius = 1, widthSegments = 8, heightSegments = 6, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI): GeometryData {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  // 限制至少需要分为六块以保持形状
  widthSegments = Math.max(3, Math.floor(widthSegments));
  heightSegments = Math.max(2, Math.floor(heightSegments));

  const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);
  const grid = [];
  let index = 0;

  for (let iy = 0; iy <= heightSegments; iy++) {
    const verticesRow = [];
    const v = iy / heightSegments;

    let uOffset = 0;

    if (iy == 0 && thetaStart == 0) {
      uOffset = 0.5 / widthSegments;
    } else if (iy == heightSegments && thetaEnd == Math.PI) {
      uOffset = - 0.5 / widthSegments;
    }

    for (let ix = 0; ix <= widthSegments; ix++) {
      const u = ix / widthSegments;

      // point
      const x = - radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
      const y = radius * Math.cos(thetaStart + v * thetaLength);
      const z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);

      data.points.push(x, y, z);

      // normal
      const normal = new Vector3(x, y, z).normalize();

      data.normals.push(...normal.toArray());

      // uv
      data.uvs.push(u + uOffset, 1 - v);

      verticesRow.push(index++);
    }

    grid.push(verticesRow);
  }

  // indices
  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < widthSegments; ix++) {
      const a = grid[iy][ix + 1];
      const b = grid[iy][ix];
      const c = grid[iy + 1][ix];
      const d = grid[iy + 1][ix + 1];

      if (iy !== 0 || thetaStart > 0) { data.indices.push(a, b, d); }
      if (iy !== heightSegments - 1 || thetaEnd < Math.PI) { data.indices.push(b, c, d); }
    }
  }

  return data;
}

function createCylinderData (radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 8, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2): GeometryData {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  radialSegments = Math.floor(radialSegments);
  heightSegments = Math.floor(heightSegments);

  let index = 0;
  const indexArray: number[][] = [];
  const halfHeight = height / 2;

  generateTorso(data.points, data.uvs, data.normals, data.indices);

  if (openEnded === false) {
    if (radiusTop > 0) { generateCap(true, data.points, data.uvs, data.normals, data.indices); }
    if (radiusBottom > 0) { generateCap(false, data.points, data.uvs, data.normals, data.indices); }
  }

  function generateTorso (points: number[], uvs: number[], normals: number[], indices: number[]) {
    // this will be used to calculate the normal
    const slope = (radiusBottom - radiusTop) / height;

    for (let y = 0; y <= heightSegments; y++) {
      const indexRow = [];
      const v = y / heightSegments;

      const radius = v * (radiusBottom - radiusTop) + radiusTop;

      for (let x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments;
        const theta = u * thetaLength + thetaStart;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const px = radius * sinTheta;
        const py = - v * height + halfHeight;
        const pz = radius * cosTheta;

        points.push(px, py, pz);

        const normal = new Vector3(sinTheta, slope, cosTheta).normalize();

        normals.push(...normal.toArray());

        uvs.push(u, 1 - v);

        indexRow.push(index++);
      }
      indexArray.push(indexRow);
    }

    for (let x = 0; x < radialSegments; x++) {
      for (let y = 0; y < heightSegments; y++) {
        const a = indexArray[y][x];
        const b = indexArray[y + 1][x];
        const c = indexArray[y + 1][x + 1];
        const d = indexArray[y][x + 1];

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  function generateCap (top: boolean, points: number[], uvs: number[], normals: number[], indices: number[]) {
    const centerIndexStart = index;

    const radius = (top === true) ? radiusTop : radiusBottom;
    const sign = (top === true) ? 1 : - 1;

    for (let x = 1; x <= radialSegments; x++) {
      points.push(0, halfHeight * sign, 0);
      normals.push(0, sign, 0);
      uvs.push(0.5, 0.5);

      index++;
    }

    const centerIndexEnd = index;

    for (let x = 0; x <= radialSegments; x++) {

      const u = x / radialSegments;
      const theta = u * thetaLength + thetaStart;

      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      const px = radius * sinTheta;
      const py = halfHeight * sign;
      const pz = radius * cosTheta;

      points.push(px, py, pz);

      normals.push(0, sign, 0);

      const uvU = (cosTheta * 0.5) + 0.5;
      const uvV = (sinTheta * 0.5 * sign) + 0.5;

      uvs.push(uvU, uvV);

      index++;
    }

    for (let x = 0; x < radialSegments; x++) {
      const c = centerIndexStart + x;
      const i = centerIndexEnd + x;

      if (top === true) {
        indices.push(i, i + 1, c);
      } else {
        indices.push(i + 1, i, c);
      }
    }
  }

  return data;
}

function createPlaneData (width = 1, height = 1, widthSegments = 1, heightSegments = 1): GeometryData {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  const widthHalf = width / 2;
  const heightHalf = height / 2;

  const gridX = Math.floor(widthSegments);
  const gridY = Math.floor(heightSegments);

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;

  const segmentWidth = width / gridX;
  const segmentHeight = height / gridY;

  for (let iy = 0; iy < gridY1; iy++) {
    const y = iy * segmentHeight - heightHalf;

    for (let ix = 0; ix < gridX1; ix++) {
      const x = ix * segmentWidth - widthHalf;

      data.points.push(x, - y, 0);
      data.normals.push(0, 0, 1);
      data.uvs.push(ix / gridX);
      data.uvs.push(1 - (iy / gridY));
    }
  }
  for (let iy = 0; iy < gridY; iy++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = ix + gridX1 * iy;
      const b = ix + gridX1 * (iy + 1);
      const c = (ix + 1) + gridX1 * (iy + 1);
      const d = (ix + 1) + gridX1 * iy;

      data.indices.push(a, b, d);
      data.indices.push(b, c, d);
    }
  }

  return data;
}

function createTorusData (radius = 1, tube = 0.4, radialSegments = 64, tubularSegments = 64, arc = Math.PI * 2): GeometryData {
  const data: GeometryData = { points: [], normals: [], uvs: [], indices: [] };

  radialSegments = Math.floor(radialSegments);
  tubularSegments = Math.floor(tubularSegments);

  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= tubularSegments; i++) {

      const u = i / tubularSegments * arc;
      const v = j / radialSegments * Math.PI * 2;

      const px = (radius + tube * Math.cos(v)) * Math.cos(u);
      const py = (radius + tube * Math.cos(v)) * Math.sin(u);
      const pz = tube * Math.sin(v);

      data.points.push(px, py, pz);

      const cx = radius * Math.cos(u);
      const cy = radius * Math.sin(u);
      const p = new Vector3(px, py, pz);
      const c = new Vector3(cx, cy, 0);
      const normal = p.subtract(c).normalize();

      data.normals.push(...normal.toArray());

      data.uvs.push(i / tubularSegments);
      data.uvs.push(j / radialSegments);
    }
  }

  for (let j = 1; j <= radialSegments; j++) {
    for (let i = 1; i <= tubularSegments; i++) {
      const a = (tubularSegments + 1) * j + i - 1;
      const b = (tubularSegments + 1) * (j - 1) + i - 1;
      const c = (tubularSegments + 1) * (j - 1) + i;
      const d = (tubularSegments + 1) * j + i;

      data.indices.push(a, b, d);
      data.indices.push(b, c, d);
    }
  }

  return data;
}
