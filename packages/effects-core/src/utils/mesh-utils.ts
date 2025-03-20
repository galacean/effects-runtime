import type * as spec from '@galacean/effects-specification';
import Delaunator from './delaunator';

// ========== 几何工具函数 ==========

/**
 * 判断点是否在 2D 多边形内（射线法）
 * @param point 2D或3D点
 * @param contour 多边形轮廓点
 * @returns 是否在多边形内
 */
export function pointInPolygon (
  point: [number, number] | [number, number, number],
  contour: Array<[number, number]> | Array<[number, number, number]>
): boolean {
  // 无论是2D还是3D点，我们只关心XY平面上的投影
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    // 只使用XY坐标进行射线法判断
    const xi = contour[i][0];
    const yi = contour[i][1];
    const xj = contour[j][0];
    const yj = contour[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-10) + xi;

    if (intersect) { inside = !inside; }
  }

  return inside;
}

/**
 * 获取点集的边界
 * @param points 点集合
 * @returns [minX, minY, maxX, maxY]
 */
export function getBounds (
  points: Array<[number, number]> | Array<[number, number, number]>
): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p[0] < minX) { minX = p[0]; }
    if (p[1] < minY) { minY = p[1]; }
    if (p[0] > maxX) { maxX = p[0]; }
    if (p[1] > maxY) { maxY = p[1]; }
  }

  return [minX, minY, maxX, maxY];
}

/**
 * 创建线框索引
 * @param triangleIndices 三角形索引数组
 * @returns 线框索引数组
 */
export function createWireframeIndices (triangleIndices: number[]): number[] {
  const wireIndices: number[] = [];

  for (let i = 0; i < triangleIndices.length; i += 3) {
    // 三角形的三条边
    wireIndices.push(triangleIndices[i], triangleIndices[i + 1]);
    wireIndices.push(triangleIndices[i + 1], triangleIndices[i + 2]);
    wireIndices.push(triangleIndices[i + 2], triangleIndices[i]);
  }

  return wireIndices;
}

// ========== 三角剖分工具 ==========

/**
 * 对点集进行Delaunay三角剖分
 * 注意：虽然输入点是3D的，但三角剖分只考虑XY平面的投影
 * @param points 3D点集
 * @returns 三角形索引数组
 */
export function delaunay2D (points: Array<[number, number, number]>): number[] {
  // 如果点太少，直接返回
  if (points.length < 3) {
    return [];
  }

  try {
    // 为 Delaunator 转换点格式为平坦数组 [x0, y0, x1, y1, ...]
    //! 注意：Delaunator 只使用 x, y 坐标进行三角剖分
    const flatCoords: number[] = [];

    for (const point of points) {
      flatCoords.push(point[0], point[1]);
    }

    // 使用 Delaunator 进行三角剖分
    const delaunator = new Delaunator(flatCoords);

    // 确保三角形数据存在
    if (!delaunator.triangles || delaunator.triangles.length === 0) {
      console.warn('Delaunator 没有生成任何三角形');

      return [];
    }

    // 这里我们直接使用 delaunator.triangles
    // 它已经是一个包含三角形顶点索引的数组，索引是按照三个一组表示一个三角形
    const indices: number[] = Array.from(delaunator.triangles);

    return indices;
  } catch (e) {
    console.error('Delaunay 三角剖分失败:', e);

    // 如果 Delaunator 失败了，返回空数组
    return [];
  }
}

// ========== 泊松采样工具 ==========

export interface PoissonSamplerOptions {
  subdivisionLevel: number,
  maxAttempts?: number,
  samplingK?: number,  // 每个点尝试的次数
}

/**
 * 生成泊松采样点
 * 在2D平面上生成均匀分布的点，并进行3D重建
 * @param originalPositions 原始顶点位置
 * @param options 采样配置
 * @returns 3D泊松采样点
 */
export function generatePoissonPoints (
  originalPositions: spec.TypedArray,
  options: PoissonSamplerOptions
): Array<[number, number, number]> {
  const subdivisionLevel = options.subdivisionLevel || 4;
  const maxAttempts = options.maxAttempts || 100;
  const samplingK = options.samplingK || 30;

  if (!originalPositions) {
    return [];
  }

  // 从原始几何体提取3D顶点
  const vertices: Array<[number, number, number]> = [];

  for (let i = 0; i < originalPositions.length; i += 3) {
    const x = originalPositions[i];
    const y = originalPositions[i + 1];
    const z = originalPositions[i + 2];

    vertices.push([x, y, z]);
  }

  // 如果顶点太少，返回空数组
  if (vertices.length < 3) {
    return [];
  }

  // 获取多边形的边界 (XY坐标)（定义 xy 平面采样空间）
  const [minX, minY, maxX, maxY] = getBounds(vertices);

  // 基于细分级别计算需要的点数和采样半径
  const numPoints = subdivisionLevel * subdivisionLevel * 3;
  const radius = Math.sqrt(((maxX - minX) * (maxY - minY)) / numPoints);
  const cellSize = radius / Math.sqrt(2);

  // 结果和活动点数组 - 现在存储3D点
  const points: Array<[number, number, number]> = [];
  // 活动点数组仍然是2D的，因为我们只在XY平面上进行泊松采样
  const active: Array<[number, number]> = [];

  // 计算网格维度
  const gridWidth = Math.ceil((maxX - minX) / cellSize);
  const gridHeight = Math.ceil((maxY - minY) / cellSize);
  const grid = new Array(gridWidth * gridHeight).fill(null);

  // 工具函数：将点映射到网格索引
  const getGridIndex = (p: [number, number]): number => {
    const i = Math.floor((p[0] - minX) / cellSize);
    const j = Math.floor((p[1] - minY) / cellSize);

    return i + j * gridWidth;
  };

  // 工具函数：检查点是否满足最小距离条件
  const isValidPoint = (p: [number, number]): boolean => {
    const [x, y] = p;
    const gridX = Math.floor((x - minX) / cellSize);
    const gridY = Math.floor((y - minY) / cellSize);

    // 检查周围邻近网格
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const neighborIndex = gridX + i + (gridY + j) * gridWidth;

        if (neighborIndex < 0 || neighborIndex >= grid.length) { continue; }
        const neighbor = grid[neighborIndex];

        if (neighbor) {
          const [nx, ny] = neighbor;
          const distanceSquared = (nx - x) ** 2 + (ny - y) ** 2;

          if (distanceSquared < radius * radius) { return false; }
        }
      }
    }

    return true;
  };

  // 工具函数：计算点的Z值（通过插值或最近点）
  const calculateZValue = (p: [number, number]): number => {
    // 找到最近的顶点
    let minDistance = Infinity;
    let zValue = 0;

    for (const vertex of vertices) {
      const distanceSquared = (vertex[0] - p[0]) ** 2 + (vertex[1] - p[1]) ** 2;

      if (distanceSquared < minDistance) {
        minDistance = distanceSquared;
        zValue = vertex[2];
      }
    }

    return zValue;
  };

  // 添加轮廓点（保持原始边界特征）
  const borderPoints: Array<[number, number, number]> = [];

  // 外轮廓细分 - 与内部点保持一致的密度
  for (let i = 0; i < vertices.length; i++) {
    const point1 = vertices[i];
    const point2 = vertices[(i + 1) % vertices.length];

    const dx = point2[0] - point1[0];
    const dy = point2[1] - point1[1];
    const dz = point2[2] - point1[2];

    const edgeLength = Math.sqrt(dx * dx + dy * dy);
    // 使用radius作为边上点的间距，确保与内部点密度一致
    const numSamples = Math.max(1, Math.ceil(edgeLength / radius));

    for (let j = 0; j <= numSamples; j++) {
      const t = j / numSamples;
      const x = point1[0] + t * dx;
      const y = point1[1] + t * dy;
      const z = point1[2] + t * dz; // 线性插值Z值

      borderPoints.push([x, y, z]);
    }
  }

  // 将边界点加入网格和结果
  borderPoints.forEach(point => {
    points.push(point);
    // 网格索引只使用x和y坐标
    const gridIndex = getGridIndex([point[0], point[1]]);

    // 网格中只存储2D点（辅助泊松采样）
    grid[gridIndex] = [point[0], point[1]];
  });

  // 添加初始点
  let firstPoint: [number, number];
  let attempts = 0;

  do {
    firstPoint = [
      Math.random() * (maxX - minX) + minX,
      Math.random() * (maxY - minY) + minY,
    ];
    attempts++;
    if (attempts > maxAttempts) {
      // 如果找不到合适的初始点，直接返回边界点
      return borderPoints;
    }
  } while (!pointInPolygon(firstPoint, vertices) || !isValidPoint(firstPoint));

  // 计算z值并添加到结果
  const zValue = calculateZValue(firstPoint);
  const firstPoint3D: [number, number, number] = [firstPoint[0], firstPoint[1], zValue];

  points.push(firstPoint3D);
  active.push(firstPoint);
  grid[getGridIndex(firstPoint)] = firstPoint;

  // 主循环：泊松盘采样内部点
  while (active.length > 0 && points.length < numPoints) {
    const activeIndex = Math.floor(Math.random() * active.length);
    const activePoint = active[activeIndex];
    let found = false;

    for (let i = 0; i < samplingK; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = radius * (Math.random() + 1); // 半径到2*半径之间随机
      const newPoint: [number, number] = [
        activePoint[0] + distance * Math.cos(angle),
        activePoint[1] + distance * Math.sin(angle),
      ];

      // 确保点在多边形内并满足最小距离条件
      if (
        newPoint[0] >= minX &&
        newPoint[0] <= maxX &&
        newPoint[1] >= minY &&
        newPoint[1] <= maxY &&
        pointInPolygon(newPoint, vertices) &&
        isValidPoint(newPoint)
      ) {
        // 计算z值
        const z = calculateZValue(newPoint);

        // 将3D点添加到结果
        points.push([newPoint[0], newPoint[1], z]);

        active.push(newPoint);
        grid[getGridIndex(newPoint)] = newPoint;
        found = true;

        break;
      }
    }
    // 如果未找到符合条件的新点，从活跃点列表中移除
    if (!found) {
      active.splice(activeIndex, 1);
    }
  }

  return points;
}