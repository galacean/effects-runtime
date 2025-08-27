import * as spec from '@galacean/effects-specification';
import type { SizeStrategy, OverflowStrategy } from './text-strategy-interfaces';
import { AutoWidthStrategy } from './auto-width-strategy';
import { FixedSizeStrategy } from './fixed-size-strategy';
import { DisplayOverflowStrategy } from './display-overflow-strategy';
import { VisibleOverflowStrategy } from './visible-overflow-strategy';

/**
 * 文本策略工厂
 * 负责创建尺寸策略和溢出策略实例
 */
export class TextStrategyFactory {
  /**
   * 创建尺寸策略
   * @param autoWidth - 是否自适应宽度
   * @returns 尺寸策略实例
   */
  static createSizeStrategy (autoWidth: boolean): SizeStrategy {
    if (autoWidth) {
      return new AutoWidthStrategy();
    } else {
      return new FixedSizeStrategy();
    }
  }

  /**
   * 创建溢出策略
   * @param overflow - 溢出模式
   * @returns 溢出策略实例
   */
  static createOverflowStrategy (overflow: spec.TextOverflow): OverflowStrategy {
    if (overflow === spec.TextOverflow.display) {
      return new DisplayOverflowStrategy();
    } else {
      return new VisibleOverflowStrategy();
    }
  }
}