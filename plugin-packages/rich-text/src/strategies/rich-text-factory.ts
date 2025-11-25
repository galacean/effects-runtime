import { spec } from '@galacean/effects';
import type {
  RichWrapStrategy, RichOverflowStrategy, RichHorizontalAlignStrategy, RichVerticalAlignStrategy,
} from './rich-text-interfaces';
import { RichWrapDisabledStrategy } from './wrap/rich-wrap-disabled';
import { RichWrapEnabledStrategy } from './wrap/rich-wrap-enabled';
import { RichDisplayOverflowStrategy } from './overflow/rich-display-overflow';
import { RichClippedOverflowStrategy } from './overflow/rich-clipped-overflow';
import { RichVisibleOverflowStrategy } from './overflow/rich-visible-overflow';
import { RichHorizontalAlignStrategyImpl } from './align/rich-horizontal-align';
import { RichVerticalAlignStrategyImpl } from './align/rich-vertical-align';

/**
 * 富文本策略工厂
 * 负责创建各种策略实例
 */
export class RichTextStrategyFactory {

  /**
   * 创建换行策略
   * 根据wrapEnabled参数决定使用哪种策略
   */
  static createWrapStrategy (wrapEnabled?: boolean): RichWrapStrategy {
    if (wrapEnabled) {
      return new RichWrapEnabledStrategy();
    } else {
      return new RichWrapDisabledStrategy();
    }
  }

  /**
   * 创建溢出策略
   * 支持三种模式：clip（裁切）、display（行级缩放）、visible（不缩放不裁剪）
   */
  static createOverflowStrategy (mode: spec.TextOverflow): RichOverflowStrategy {
    switch (mode) {
      case spec.TextOverflow.clip:
        return new RichClippedOverflowStrategy();
      case spec.TextOverflow.display:
        return new RichDisplayOverflowStrategy();
      case spec.TextOverflow.visible:
      default:
        return new RichVisibleOverflowStrategy();
    }
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
