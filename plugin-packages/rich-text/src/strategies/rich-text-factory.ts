import { spec } from '@galacean/effects';
import type { RichTextLayout } from '../rich-text-layout';
import type {
  RichWrapStrategy, RichOverflowStrategy, RichHorizontalAlignStrategy,
  RichVerticalAlignStrategy,
} from './rich-text-interfaces';
import { RichWrapDisabledStrategy } from './wrap/rich-wrap-disabled';
import { RichWrapEnabledStrategy } from './wrap/rich-wrap-enabled';
import { RichWrapOnPathStrategy } from './wrap/rich-wrap-on-path';
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
   *
   * 路径文本模式（isPathText 或 curveGraphicsPath 启用）走 RichWrapOnPathStrategy，
   * 沿路径排版；否则按 wrapEnabled 在普通换行/禁用间二选一。
   * layout 缺省（构造期 textLayout 未建）时返回禁用换行兜底，fromData/updateWithOptions 后会重选。
   */
  static createWrapStrategy (layout?: RichTextLayout): RichWrapStrategy {
    // 路径文本模式最高优先：强制走 OnPath（无 curvePath 则用默认闭合圆兜底）
    // isPathText 为唯一开关（setCurvedPath 设曲线时自动置 isPathText=true）
    if (layout && layout.isPathText) {
      return new RichWrapOnPathStrategy();
    }

    return layout?.wrapEnabled
      ? new RichWrapEnabledStrategy()
      : new RichWrapDisabledStrategy();
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
