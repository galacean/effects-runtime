import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { FrameComponent, spec, TextComponent, type VFXItem } from '@galacean/effects';

/**
 * 判断播放器元素是否为画板元素。
 * @param item 播放器元素
 * @returns 是否为画板元素
 */
export function isFramePlayerItem (item: VFXItem) {
  // 画板的 name 也是标题，允许用户重命名；排除复用 FrameComponent 的特殊容器。
  return item.type === spec.ItemType.null
    && item.getComponent(FrameComponent) !== undefined
    && item.name !== '动效'
    && item.name !== '主合成蒙版';
}

/**
 * 判断播放器元素是否为动效元素。
 * @param item 播放器元素
 * @returns 是否为动效元素
 */
export function isEffectsPlayerItem (item: VFXItem) {
  return item.type === spec.ItemType.null && item.getComponent(FrameComponent) !== undefined && item.name === '动效';
}

/**
 * 判断播放器元素是否为文本元素。
 * @param item 播放器元素
 * @returns 是否为文本元素
 */
export function isTextPlayerItem (item: VFXItem) {
  return item.type === spec.ItemType.text && item.getComponent(TextComponent) !== undefined;
}

/**
 * 判断播放器元素是否为富文本元素。
 * @param item 播放器元素
 * @returns 是否为富文本元素
 */
export function isRichTextPlayerItem (item: VFXItem) {
  return item.type === spec.ItemType.richtext && item.getComponent(RichTextComponent) !== undefined;
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

/** 获取文本组件，供检查器和文本相关 Gizmo 读取。 */
export function getEditableTextComponent (item: VFXItem | undefined): TextComponent | RichTextComponent | undefined {
  if (item?.type === spec.ItemType.text) {
    return item.getComponent(TextComponent);
  }
  if (item?.type === spec.ItemType.richtext) {
    return item.getComponent(RichTextComponent);
  }
}

/** 普通文本及使用新排版管线的富文本支持内联编辑。 */
export function isEditableTextItem (item: VFXItem | undefined): boolean {
  const component = getEditableTextComponent(item);

  return !!component && (!(component instanceof RichTextComponent) || !component.textLayout.useLegacyRichText);
}
