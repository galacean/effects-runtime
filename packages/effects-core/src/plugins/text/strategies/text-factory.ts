import * as spec from '@galacean/effects-specification';
import type { SizeStrategy, OverflowStrategy, WarpStrategy } from './text-interfaces';
import { AutoWidthStrategy } from './size/auto-width';
import { FixedSizeStrategy } from './size/fixed-size';
import { DisplayOverflowStrategy } from './overflow/display-overflow';
import { VisibleOverflowStrategy } from './overflow/visible-overflow';
import { WarpEnabledStrategy } from './warp/warp-enabled';
import { WarpDisabledStrategy } from './warp/warp-disabled';

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

  /**
   * 创建包裹策略
   * @param warp - 是否启用自动换行
   * @returns 包裹策略实例
   */
  static createWarpStrategy (warp: boolean): WarpStrategy {
    if (warp) {
      return new WarpEnabledStrategy();
    } else {
      return new WarpDisabledStrategy();
    }
  }
}
