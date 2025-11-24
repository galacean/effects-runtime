/**
 * 路径段接口
 */
export interface PathSegment {
  command: string,
  points: number[],
  start: { x: number, y: number },
  pathLength: number,
}

/**
 * 曲线文本工具类
 * 提供路径解析和点计算功能
 */
export class CurvedTextUtils {
  /**
   * 计算SVG路径的总长度
   * @param path SVG路径字符串
   * @returns 路径总长度
   */
  static calculatePathLength (path: string): number {
    if (!path) {return 0;}

    const segments = this.parsePathData(path);

    return segments.reduce((sum, segment) => sum + segment.pathLength, 0);
  }

  /**
   * 获取路径上指定长度位置的点和角度
   * @param path SVG路径字符串
   * @param targetLength 目标长度
   * @returns 点的坐标和角度信息
   */
  static getPointAtLength (path: string, targetLength: number): { x: number, y: number, angle: number } | null {
    if (!path || targetLength < 0) {return null;}

    const segments = this.parsePathData(path);
    let currentLength = 0;

    for (const segment of segments) {
      if (targetLength <= currentLength + segment.pathLength) {
        const localLength = targetLength - currentLength;

        return this.getPointOnSegment(segment, localLength);
      }
      currentLength += segment.pathLength;
    }

    // 如果超出路径长度，返回终点
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      const points = lastSegment.points;

      if (points.length >= 2) {
        return {
          x: points[points.length - 2],
          y: points[points.length - 1],
          angle: this.getSegmentEndAngle(lastSegment),
        };
      }
    }

    return null;
  }

  /**
   * 解析SVG路径数据
   * @param path SVG路径字符串
   * @returns 路径段数组
   */
  static parsePathData (path: string): PathSegment[] {
    if (!path) {return [];}

    const segments: PathSegment[] = [];
    const commands = path.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;

    for (const cmd of commands) {
      const type = cmd[0];
      const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number);

      switch (type.toUpperCase()) {
        case 'M':
          currentX = coords[0];
          currentY = coords[1];
          startX = currentX;
          startY = currentY;
          segments.push({
            command: 'M',
            points: [currentX, currentY],
            start: { x: currentX, y: currentY },
            pathLength: 0,
          });

          break;
        case 'L':
          {
            const length = Math.sqrt(
              Math.pow(coords[0] - currentX, 2) +
              Math.pow(coords[1] - currentY, 2)
            );

            segments.push({
              command: 'L',
              points: [coords[0], coords[1]],
              start: { x: currentX, y: currentY },
              pathLength: length,
            });
            currentX = coords[0];
            currentY = coords[1];
          }

          break;
        case 'H':
          {
            const length = Math.abs(coords[0] - currentX);

            segments.push({
              command: 'L',
              points: [coords[0], currentY],
              start: { x: currentX, y: currentY },
              pathLength: length,
            });
            currentX = coords[0];
          }

          break;
        case 'V':
          {
            const length = Math.abs(coords[0] - currentY);

            segments.push({
              command: 'L',
              points: [currentX, coords[0]],
              start: { x: currentX, y: currentY },
              pathLength: length,
            });
            currentY = coords[0];
          }

          break;
        case 'C':
          {
            // 三次贝塞尔曲线近似长度计算
            let length = 0;
            const steps = 100;
            let prevX = currentX;
            let prevY = currentY;

            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const x = Math.pow(1 - t, 3) * currentX +
                       3 * Math.pow(1 - t, 2) * t * coords[0] +
                       3 * (1 - t) * Math.pow(t, 2) * coords[2] +
                       Math.pow(t, 3) * coords[4];
              const y = Math.pow(1 - t, 3) * currentY +
                       3 * Math.pow(1 - t, 2) * t * coords[1] +
                       3 * (1 - t) * Math.pow(t, 2) * coords[3] +
                       Math.pow(t, 3) * coords[5];

              length += Math.sqrt(Math.pow(x - prevX, 2) + Math.pow(y - prevY, 2));
              prevX = x;
              prevY = y;
            }

            segments.push({
              command: 'C',
              points: [...coords],
              start: { x: currentX, y: currentY },
              pathLength: length,
            });
            currentX = coords[4];
            currentY = coords[5];
          }

          break;
        case 'Z':
          {
            const length = Math.sqrt(
              Math.pow(startX - currentX, 2) +
              Math.pow(startY - currentY, 2)
            );

            segments.push({
              command: 'Z',
              points: [startX, startY],
              start: { x: currentX, y: currentY },
              pathLength: length,
            });
            currentX = startX;
            currentY = startY;
          }

          break;
      }
    }

    return segments;
  }

  /**
   * 获取路径段上指定长度位置的点和角度
   * @param segment 路径段
   * @param length 段内长度
   * @returns 点的坐标和角度信息
   */
  private static getPointOnSegment (segment: PathSegment, length: number): { x: number, y: number, angle: number } | null {
    switch (segment.command) {
      case 'L':
      {
        const dx = segment.points[0] - segment.start.x;
        const dy = segment.points[1] - segment.start.y;
        const totalLength = segment.pathLength;

        if (totalLength === 0) {
          return {
            x: segment.start.x,
            y: segment.start.y,
            angle: 0,
          };
        }

        const ratio = length / totalLength;
        const x = segment.start.x + dx * ratio;
        const y = segment.start.y + dy * ratio;
        const angle = Math.atan2(dy, dx);

        return { x, y, angle };
      }
      case 'C':
      {
        // 三次贝塞尔曲线
        const steps = 100;
        let currentLength = 0;
        let prevX = segment.start.x;
        let prevY = segment.start.y;

        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = Math.pow(1 - t, 3) * segment.start.x +
                     3 * Math.pow(1 - t, 2) * t * segment.points[0] +
                     3 * (1 - t) * Math.pow(t, 2) * segment.points[2] +
                     Math.pow(t, 3) * segment.points[4];
          const y = Math.pow(1 - t, 3) * segment.start.y +
                     3 * Math.pow(1 - t, 2) * t * segment.points[1] +
                     3 * (1 - t) * Math.pow(t, 2) * segment.points[3] +
                     Math.pow(t, 3) * segment.points[5];

          const segmentLength = Math.sqrt(Math.pow(x - prevX, 2) + Math.pow(y - prevY, 2));

          if (currentLength + segmentLength >= length) {
            const localRatio = (length - currentLength) / segmentLength;
            const finalX = prevX + (x - prevX) * localRatio;
            const finalY = prevY + (y - prevY) * localRatio;

            // 计算切线角度
            const dx = 3 * Math.pow(1 - t, 2) * (segment.points[0] - segment.start.x) +
                        6 * (1 - t) * t * (segment.points[2] - segment.points[0]) +
                        3 * Math.pow(t, 2) * (segment.points[4] - segment.points[2]);
            const dy = 3 * Math.pow(1 - t, 2) * (segment.points[1] - segment.start.y) +
                        6 * (1 - t) * t * (segment.points[3] - segment.points[1]) +
                        3 * Math.pow(t, 2) * (segment.points[5] - segment.points[3]);
            const angle = Math.atan2(dy, dx);

            return { x: finalX, y: finalY, angle };
          }

          currentLength += segmentLength;
          prevX = x;
          prevY = y;
        }

        // 如果没找到，返回终点
        return {
          x: segment.points[4],
          y: segment.points[5],
          angle: this.getSegmentEndAngle(segment),
        };
      }
      case 'Z':
      {
        const dx = segment.points[0] - segment.start.x;
        const dy = segment.points[1] - segment.start.y;
        const totalLength = segment.pathLength;

        if (totalLength === 0) {
          return {
            x: segment.start.x,
            y: segment.start.y,
            angle: 0,
          };
        }

        const ratio = length / totalLength;
        const x = segment.start.x + dx * ratio;
        const y = segment.start.y + dy * ratio;
        const angle = Math.atan2(dy, dx);

        return { x, y, angle };
      }
    }

    return null;
  }

  /**
   * 获取路径段终点的角度
   * @param segment 路径段
   * @returns 角度（弧度）
   */
  private static getSegmentEndAngle (segment: PathSegment): number {
    switch (segment.command) {
      case 'L':
      case 'Z':
      {
        const dx = segment.points[segment.points.length - 2] - segment.start.x;
        const dy = segment.points[segment.points.length - 1] - segment.start.y;

        return Math.atan2(dy, dx);
      }
      case 'C':
      {
        // 三次贝塞尔曲线终点切线
        const dx = segment.points[4] - segment.points[2];
        const dy = segment.points[5] - segment.points[3];

        return Math.atan2(dy, dx);
      }
    }

    return 0;
  }
}
