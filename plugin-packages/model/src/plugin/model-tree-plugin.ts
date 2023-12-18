import { AbstractPlugin } from '@galacean/effects';

export class ModelTreePlugin extends AbstractPlugin {
  override name = 'tree';

  override order = 2;  // 高优先级更新
}

