import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichLine, OverflowResult, SizeResult } from '../rich-text-interfaces';
import type { RichOverflowStrategy } from '../rich-text-interfaces';

/**
 * 富文本Display溢出策略（对应Fit模式）
 * 完全基于现有Modern路径的实现逻辑：按行级缩放适配canvas宽度
 */
export class RichDisplayOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: TextLayout,
    style: TextStyle,
  ): OverflowResult {
    const { canvasWidth } = sizeResult;
    const lineScales: number[] = [];

    // 完全复制现有Modern路径的display模式缩放逻辑
    lines.forEach(line => {
      const { width } = line;

      // 如果行宽超过canvas宽度，则进行缩放（复制现有逻辑）
      if (width > canvasWidth) {
        const canvasScale = canvasWidth / width;

        lineScales.push(canvasScale);

        // 应用缩放到行数据（复制现有逻辑）
        line.width *= canvasScale;
        line.offsetX = line.offsetX.map(x => x * canvasScale);

        // 逐字缩放（复制现有逻辑）
        line.chars.forEach(charArr => {
          charArr.forEach(charDetail => {
            charDetail.x *= canvasScale;
            charDetail.width *= canvasScale;
          });
        });
      } else {
        lineScales.push(1); // 不需要缩放
      }
    });

    return {
      lineScales,
      globalScale: 1, // 当前实现没有全局缩放
    };
  }
}
