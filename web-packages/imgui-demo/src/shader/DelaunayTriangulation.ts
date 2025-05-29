// Point 类表示二维平面上的一个点
export class Point {
  constructor (public x: number, public y: number) {}

  // 判断两个点是否相等
  equals (other: Point): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

// Edge 类表示两点之间的边
export class Edge {
  constructor (public p1: Point, public p2: Point) {}

  // 判断两条边是否相同（不考虑方向）
  equals (other: Edge): boolean {
    return (
      (this.p1.equals(other.p1) && this.p2.equals(other.p2)) || (this.p1.equals(other.p2) && this.p2.equals(other.p1))
    );
  }
}

// Triangle 类表示一个由三个点组成的三角形
export class Triangle {
  public circumcircle: { center: Point, radius: number };

  constructor (public p1: Point, public p2: Point, public p3: Point) {
    this.circumcircle = this.calculateCircumcircle();
  }

  // 计算三角形的外接圆
  private calculateCircumcircle (): { center: Point, radius: number } {
    const A = this.p2.x - this.p1.x;
    const B = this.p2.y - this.p1.y;
    const C = this.p3.x - this.p1.x;
    const D = this.p3.y - this.p1.y;

    const E = A * (this.p1.x + this.p2.x) + B * (this.p1.y + this.p2.y);
    const F = C * (this.p1.x + this.p3.x) + D * (this.p1.y + this.p3.y);
    const G = 2 * (A * (this.p3.y - this.p2.y) - B * (this.p3.x - this.p2.x));

    if (G === 0) {
      // Colinear points; return a large circumcircle
      return { center: new Point(0, 0), radius: Number.POSITIVE_INFINITY };
    }

    const cx = (D * E - B * F) / G;
    const cy = (A * F - C * E) / G;
    const radius = Math.hypot(this.p1.x - cx, this.p1.y - cy);

    return { center: new Point(cx, cy), radius };
  }

  // 检查一个点是否在三角形的外接圆内
  containsPointInCircumcircle (p: Point): boolean {
    const dx = p.x - this.circumcircle.center.x;
    const dy = p.y - this.circumcircle.center.y;
    const dist = dx * dx + dy * dy;

    return dist <= this.circumcircle.radius * this.circumcircle.radius;
  }

  // 判断三角形是否包含某个顶点
  containsVertex (p: Point): boolean {
    return this.p1.equals(p) || this.p2.equals(p) || this.p3.equals(p);
  }
}

// DelaunayTriangulation 类实现了 Bowyer-Watson 算法
export class DelaunayTriangulation {
  private triangles: Triangle[] = [];

  constructor (points: Point[]) {
    this.generateTriangulation(points);
  }

  // 获取所有三角形
  getTriangles (): Triangle[] {
    return this.triangles;
  }

  // 生成 Delaunay 三角剖分
  private generateTriangulation (points: Point[]) {
    if (points.length < 3) {
      throw new Error('At least three points are required for triangulation.');
    }

    // 创建超级三角形
    const superTriangle = this.createSuperTriangle(points);

    this.triangles.push(superTriangle);

    // 插入点
    for (const point of points) {
      this.insertPoint(point);
    }

    // 移除包含超级三角形顶点的三角形
    this.removeSuperTriangles(superTriangle);
  }

  // 创建一个包含所有点的超级三角形
  private createSuperTriangle (points: Point[]): Triangle {
    // 找到所有点的边界
    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (const p of points) {
      if (p.x < minX) {minX = p.x;}
      if (p.y < minY) {minY = p.y;}
      if (p.x > maxX) {maxX = p.x;}
      if (p.y > maxY) {maxY = p.y;}
    }

    const dx = maxX - minX;
    const dy = maxY - minY;
    const deltaMax = Math.max(dx, dy) * 10;

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const p1 = new Point(midX - deltaMax, midY - deltaMax);
    const p2 = new Point(midX, midY + deltaMax);
    const p3 = new Point(midX + deltaMax, midY - deltaMax);

    return new Triangle(p1, p2, p3);
  }

  // 插入一个点到当前的三角剖分中
  private insertPoint (point: Point) {
    const badTriangles: Triangle[] = [];

    // 找到所有外接圆包含该点的三角形
    for (const triangle of this.triangles) {
      if (triangle.containsPointInCircumcircle(point)) {
        badTriangles.push(triangle);
      }
    }

    // 找到坏三角形的边
    const polygon: Edge[] = [];

    for (const triangle of badTriangles) {
      const edges = [
        new Edge(triangle.p1, triangle.p2),
        new Edge(triangle.p2, triangle.p3),
        new Edge(triangle.p3, triangle.p1),
      ];

      for (const edge of edges) {
        let isShared = false;

        for (const other of badTriangles) {
          if (triangle === other) {continue;}
          if (
            (other.p1.equals(edge.p1) || other.p2.equals(edge.p1) || other.p3.equals(edge.p1)) &&
            (other.p1.equals(edge.p2) || other.p2.equals(edge.p2) || other.p3.equals(edge.p2))
          ) {
            isShared = true;

            break;
          }
        }
        if (!isShared) {
          polygon.push(edge);
        }
      }
    }

    // 删除坏三角形
    this.triangles = this.triangles.filter(t => !badTriangles.includes(t));

    // 创建新的三角形
    for (const edge of polygon) {
      this.triangles.push(new Triangle(edge.p1, edge.p2, point));
    }
  }

  // 移除包含超级三角形顶点的三角形
  private removeSuperTriangles (superTriangle: Triangle) {
    this.triangles = this.triangles.filter(
      triangle =>
        !triangle.containsVertex(superTriangle.p1) &&
        !triangle.containsVertex(superTriangle.p2) &&
        !triangle.containsVertex(superTriangle.p3)
    );
  }
}

