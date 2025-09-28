import { spec } from '@galacean/effects';
import type {
  RichSizeStrategy,
  RichWrapStrategy, // 更新接口名
  RichOverflowStrategy,
  RichHorizontalAlignStrategy,
  RichVerticalAlignStrategy,
} from './rich-text-interfaces';
import { RichAutoWidthStrategy } from './size/rich-auto-width';
import { RichWrapDisabledStrategy } from './wrap/rich-wrap-disabled'; // 确保导入正确
import { RichDisplayOverflowStrategy } from './overflow/rich-display-overflow';
import { RichClippedOverflowStrategy } from './overflow/rich-clipped-overflow';
import { RichVisibleOverflowStrategy } from './overflow/rich-visible-overflow';
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
  static createSizeStrategy (sizeMode?: spec.TextSizeMode): RichSizeStrategy {
    // 目前仅支持AutoWidth模式
    // @ts-expect-error
    if (sizeMode && sizeMode !== spec.TextSizeMode.autoWidth) {
      console.warn(`[RichText] Size mode '${sizeMode}' is not supported, using 'autoWidth' as fallback.`);
    }

    return new RichAutoWidthStrategy();
  }

  /**
   * 创建换行策略
   * 当前仅支持Wrap Disabled模式（仅基于\n换行）
   */
  static createWrapStrategy (wrapEnabled?: boolean): RichWrapStrategy { // 更新返回接口
    // 目前仅支持Wrap Disabled模式
    if (wrapEnabled) {
      console.warn('[RichText] Wrap mode is not supported, using \'disabled\' as fallback.');
    }

    return new RichWrapDisabledStrategy();
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
