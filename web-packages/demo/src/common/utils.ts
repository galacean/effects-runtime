import type { Composition } from '@galacean/effects';
import { VFXItem, spec } from '@galacean/effects';

// TODO 不需要和 player 做效果对比时可以移除
export function compatibleCalculateItem (composition: Composition) {
  // 测试用的兼容 加载好后修改空节点结束行为，保持和player一致，在runtime上空节点结束为销毁改为冻结的效果
  composition.items.forEach(item => {
    if (VFXItem.isNull(item) && item.endBehavior === spec.EndBehavior.destroy) {
      item.endBehavior = spec.EndBehavior.freeze;
    }
  });
}
