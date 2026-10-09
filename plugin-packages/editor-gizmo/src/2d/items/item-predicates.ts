import { FrameComponent, spec, type VFXItem } from '@galacean/effects';

/**
 * 判断播放器元素是否为画板元素。
 * @param item 播放器元素
 * @returns 是否为画板元素
 */
export function isFramePlayerItem (item: VFXItem) {
  return item.type === spec.ItemType.null && item.getComponent(FrameComponent) !== undefined && item.name === '画板';
}

/**
 * 判断播放器元素是否为特效元素。
 * @param item 播放器元素
 * @returns 是否为特效元素
 */
export function isEffectsPlayerItem (item: VFXItem) {
  return item.type === spec.ItemType.null && item.getComponent(FrameComponent) !== undefined && item.name === '特效';
}

/**
 * 判断播放器元素是否为生成器元素。
 * @param item 播放器元素
 * @returns 是否为生成器元素
 */
export function isGeneratorPlayerItem (item: VFXItem) {
  if (item.type !== spec.ItemType.sprite) {
    return false;
  }
  const content = item.definition?.content as Record<string, unknown> | undefined;

  return item.name.includes('生成器')
    || content?.generatorType === 'image'
    || content?.generatorType === 'video'
    || content?.isVideoGenerator === true;
}

/**
 * 判断播放器生成器元素是否为视频生成器。
 * @param item 播放器元素
 * @returns 是否为视频生成器
 */
export function isVideoGeneratorPlayerItem (item: VFXItem) {
  if (!isGeneratorPlayerItem(item)) {
    return false;
  }
  const content = item.definition?.content as Record<string, unknown> | undefined;

  return content?.generatorType === 'video'
    || content?.isVideoGenerator === true
    || item.name.includes('视频');
}

/**
 * 判断播放器元素是否为组元素。
 * @param item 播放器元素
 * @returns 是否为组元素
 */
export function isGroupPlayerItem (item: VFXItem) {
  return item.type === spec.ItemType.null && !item.getComponent(FrameComponent);
}
