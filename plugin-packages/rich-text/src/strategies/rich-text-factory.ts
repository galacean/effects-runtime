import type { spec } from '@galacean/effects';
import type {
  RichSizeStrategy,
  RichWarpStrategy,
  RichOverflowStrategy,
  RichHorizontalAlignStrategy,
  RichVerticalAlignStrategy,
} from './rich-text-interfaces';
import { RichAutoWidthStrategy } from './size/rich-auto-width';
import { RichWarpDisabledStrategy } from './warp/rich-warp-disabled';
import { RichDisplayOverflowStrategy } from './overflow/rich-display-overflow';
import { RichHorizontalAlignStrategyImpl } from './align/rich-horizontal-align';
import { RichVerticalAlignStrategyImpl } from './align/rich-vertical-align';

/**
 * 富文本策略工厂
 * 负责创建各种策略实例，保持与现有Modern路径行为一致
 */
export class RichTextStrategyFactory {
  /**
   * 创建尺寸策略
   * 当前仅支持AutoWidth模式（与现有Modern路径一致）
   */
  static createSizeStrategy (): RichSizeStrategy {
    return new RichAutoWidthStrategy();
  }

  /**
   * 创建换行策略
   * 当前仅支持Warp Disabled模式（仅基于\n换行）
   */
  static createWarpStrategy (): RichWarpStrategy {
    return new RichWarpDisabledStrategy();
  }

  /**
   * 创建溢出策略
   * 当前仅支持Display模式（对应Fit）
   */
  static createOverflowStrategy (overflow: spec.TextOverflow): RichOverflowStrategy {
    // 当前Modern路径仅支持display模式
    return new RichDisplayOverflowStrategy();
  }

  /**
   * 创建水平对齐策略
   */
  static createHorizontalAlignStrategy (): RichHorizontalAlignStrategy {
    return new RichHorizontalAlignStrategyImpl();
  }

  /**
   * 创建垂直对齐策略
   */
  static createVerticalAlignStrategy (): RichVerticalAlignStrategy {
    return new RichVerticalAlignStrategyImpl();
  }
}
