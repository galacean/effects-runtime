import { spec } from '@galacean/effects';
import type {
  RichWrapStrategy, RichOverflowStrategy, RichHorizontalAlignStrategy,
  RichVerticalAlignStrategy,
} from './rich-text-interfaces';
import { RichWrapDisabledStrategy } from './wrap/rich-wrap-disabled';
import { RichWrapEnabledStrategy } from './wrap/rich-wrap-enabled';
import { RichClippedOverflowStrategy } from './overflow/rich-clipped-overflow';
import { RichExpandingOverflowStrategy } from './overflow/rich-expanding-overflow';
import { RichHorizontalAlignStrategyImpl } from './align/rich-horizontal-align';
import { RichVerticalAlignStrategyImpl } from './align/rich-vertical-align';

/**
 * 富文本策略工厂
 * 负责创建各种策略实例
 *
 * 管线顺序：Wrap → scaleLinesToFit（display）→ Align → Overflow.resolveCanvas
 */
export class RichTextStrategyFactory {

  /**
   * 创建换行策略
   */
  static createWrapStrategy (wrapEnabled?: boolean): RichWrapStrategy {
    if (wrapEnabled) {
      return new RichWrapEnabledStrategy();
    } else {
      return new RichWrapDisabledStrategy();
    }
  }

  /**
   * 创建溢出策略（画布解析）
   * clip：画布=帧，超出裁切
   * display/visible：检测溢出并对称扩展画布
   */
  static createOverflowStrategy (mode: spec.TextOverflow): RichOverflowStrategy {
    switch (mode) {
      case spec.TextOverflow.clip:
        return new RichClippedOverflowStrategy();
      case spec.TextOverflow.display:
      case spec.TextOverflow.visible:
      default:
        return new RichExpandingOverflowStrategy();
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
