import { SceneServer } from '@galacean/effects';
import { MouseButton, MouseButtonMask, type InputEventMouseButton, type InputEventMouseMotion, spec, Texture } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import { GizmoType } from '../gizmo-type';
import { GestureCursorType, type GestureCursorResult } from '../cursor';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../math';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';
import type { IconConfig } from '../configs/types';
import { iconConfig } from '../configs/builtin-configs';
import type { ConfigChange } from '../configs/config-definition';
import { getPlayerItemById, getItemViewBox, isGeneratorPlayerItem, isVideoGeneratorPlayerItem } from '../items';

/** 辅助渲染 Icon 类型。 */
export enum IconType {
  /** 视频播放 Icon */
  VIDEO_PLAY = 'video-play',
  /** 视频生成器 Icon */
  VIDEO_GENERATOR = 'video-generator',
  /** 图片生成器 Icon */
  IMAGE_GENERATOR = 'image-generator',
}

/** 元素辅助 Icon 结果。 */
export type IconResult = {
  /** 选中元素 Id */
  id: string,
  /** Icon 类型 */
  type: IconType,
  /** 包围盒信息 */
  box: Box2,
};

/** 元素辅助 Icon 交互参数。 */
export type IconInteractionParam = {
  /** 鼠标悬停的视频元素 ID */
  hoverVideoId?: string,
};

/** 渲染元素辅助 Icon（视频播放按钮、生成器图标等）。 */
export class IconGizmo extends Gizmo {
  type = GizmoType.ICON;

  results: IconResult[] = [];

  interactionParam: IconInteractionParam = {};

  /** 光标结果（GestureCursorResult） */
  cursorResult: GestureCursorResult = {
    type: GestureCursorType.NORMAL,
    angle: 0,
  };
  private configOff?: () => void;

  /** 图标纹理缓存，按 IconType 懒加载。 */
  private iconTextures = new Map<IconType, Texture>();
  /** 图标纹理加载中的 Promise，避免重复发起加载。 */
  private iconTexturePromises = new Map<IconType, Promise<Texture>>();

  /**
   * 创建元素辅助图标 Gizmo。
   * @param owner Gizmo 宿主。
   */
  constructor (owner: GizmoOwner) {
    super(owner);
    this.configOff = owner.getConfigManager().onChange(
      iconConfig,
      change => {
        this.onConfigChange(change);
      },
    );
  }

  /** 当前图标配置。 */
  get config (): Readonly<IconConfig> {
    return this._owner.getConfigManager().get(iconConfig);
  }

  /**
   * 更新视频播放图标的悬停状态与光标。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    const hover = this._owner.getMousePosition();

    this.interactionParam.hoverVideoId = this.computeHoverVideoId(hover);
    const videoPlayResult = this.results.find(result => result.type === IconType.VIDEO_PLAY);
    const hit = !!videoPlayResult?.box.containsPoint(hover);

    this.cursorResult = hit
      ? { type: GestureCursorType.POINTER, angle: 0 }
      : { type: GestureCursorType.NORMAL, angle: 0 };
    this._owner.setCursor(this.cursorResult);
    if (event.buttonMask === MouseButtonMask.None && hit) {
      event.accept();
    }
  }

  /** 清除离开交互层后的图标悬停状态。 */
  override onMouseLeave (): void {
    this.interactionParam.hoverVideoId = undefined;
    this.cursorResult = { type: GestureCursorType.NORMAL, angle: 0 };
    this._owner.setCursor(this.cursorResult);
  }

  /**
   * 点击视频播放图标时发送播放事件。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this.refreshVideoIconId(new Vector2(event.position.x, event.position.y));
    const videoPlayResult = this.results.find(result => result.type === IconType.VIDEO_PLAY);

    if (!videoPlayResult?.box.containsPoint(new Vector2(event.position.x, event.position.y))) {
      return;
    }
    if (videoPlayResult) {
      const playerItem = getPlayerItemById(this._owner.getEngine().getServer(SceneServer).compositions[0], videoPlayResult.id);
      let time = 0;

      if (playerItem?.type === spec.ItemType.video) {
        const videoComponent = playerItem.getComponent(VideoComponent);

        time = videoComponent?.getCurrentTime() ?? 0;
      }
      this._owner.emit('videoplay', {
        source: this,
        id: videoPlayResult.id,
        time,
      });
      this.refreshCursorResult();
      this._owner.setCursor(this.cursorResult);
    }

    event.accept();
  }

  /** 根据当前指针与图标结果刷新光标。 */
  refreshCursorResult (): void {
    const hover = this._owner.getMousePosition();
    const videoPlayResult = this.results.find(result => result.type === IconType.VIDEO_PLAY);
    const isPreSelected = !!hover && !!videoPlayResult?.box.containsPoint(hover);

    this.cursorResult = isPreSelected
      ? { type: GestureCursorType.POINTER, angle: 0 }
      : { type: GestureCursorType.NORMAL, angle: 0 };
  }

  /**
   * 更新悬停视频 ID 与图标结果。
   * @param mouse 鼠标位置。
   */
  refreshVideoIconId (mouse: Vector2) {
    this.interactionParam.hoverVideoId = this.computeHoverVideoId(mouse);
    this.refreshResults();
  }

  /** 刷新所有待绘制的元素辅助图标。 */
  override onUpdate (): void {
    this.refreshResults();
  }

  /**
   * 绘制视频播放与生成器图标。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    if (!this.results.length) {
      return;
    }

    this.results.forEach(result => {
      const texture = this.getIconTexture(result.type, control.engine);

      if (!texture || texture.isDestroyed) {
        return;
      }
      const center = result.box.getCenter();
      const size = result.box.getSize();

      control.drawTexture(center.x - size.x / 2, center.y - size.y / 2, size.x, size.y, texture);
    });
  }

  /** 释放配置监听器。 */
  override dispose (): void {
    this.configOff?.();
    this.configOff = undefined;
    super.dispose();
  }

  /**
   * 在图标 URL 变化时清除对应纹理缓存。
   * @param change 图标配置变更。
   */
  private onConfigChange (change: ConfigChange<IconConfig>): void {
    const checks: { type: IconType, key: keyof IconConfig }[] = [
      { type: IconType.VIDEO_PLAY, key: 'videoPlayUrl' },
      { type: IconType.IMAGE_GENERATOR, key: 'imageGeneratorUrl' },
      { type: IconType.VIDEO_GENERATOR, key: 'videoGeneratorUrl' },
    ];

    for (const { type, key } of checks) {
      if (change.previous[key] !== change.current[key]) {
        const texture = this.iconTextures.get(type);

        if (texture && !texture.isDestroyed) {
          texture.offloadData();
        }
        this.iconTextures.delete(type);
        this.iconTexturePromises.delete(type);
      }
    }
  }

  /** 刷新视频播放与生成器图标的绘制结果。 */
  private refreshResults (): void {
    // 步骤 1：获取当前合成并重置绘制结果。
    const playerComposition = this._owner.getEngine().getServer(SceneServer).compositions[0];

    if (!playerComposition) {
      return;
    }

    this.results = [];

    const { videoPlayWidth, videoPlayHeight, videoPlayShift, generatorWidth, generatorHeight } = this.config;

    // 步骤 2：为当前悬停视频生成播放图标。
    const hoverVideoId = this.interactionParam.hoverVideoId;

    if (hoverVideoId) {
      const playerItem = getPlayerItemById(this._owner.getEngine().getServer(SceneServer).compositions[0], hoverVideoId);

      if (playerItem) {
        const itemViewBox = getItemViewBox(
          playerItem,
          GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!),
        );
        const size = itemViewBox.getSize();

        if (!(size.x < 50 || size.y < 100)) {
          const { max } = itemViewBox;

          const position = new Vector2(max.x - videoPlayShift[0], max.y - videoPlayShift[1]);
          const boxSize = new Vector2(videoPlayWidth, videoPlayHeight);

          this.results.push({
            id: hoverVideoId,
            type: IconType.VIDEO_PLAY,
            box: new Box2().setFromCenterAndSize(position, boxSize),
          });
        }
      }
    }

    // 步骤 3：为生成器对象生成类型图标。
    const generatorItems = playerComposition.items.filter(item => isGeneratorPlayerItem(item));

    generatorItems.forEach(item => {
      const itemViewBox = getItemViewBox(
        item,
        GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!),
      );
      const position = itemViewBox.getCenter();
      const size = new Vector2(generatorWidth, generatorHeight).multiply(GizmoViewportUtils.getViewScale(this._owner.getEngine()));

      this.results.push({
        id: item.getInstanceId(),
        type: isVideoGeneratorPlayerItem(item) ? IconType.VIDEO_GENERATOR : IconType.IMAGE_GENERATOR,
        box: new Box2().setFromCenterAndSize(position, size),
      });
    });
  }

  /**
   * 按 IconType 取得图标 URL。
   * @param type 图标类型
   * @returns 对应图标 URL，无匹配时返回空字符串
   */
  private getIconUrl (type: IconType): string {
    const { videoPlayUrl, imageGeneratorUrl, videoGeneratorUrl } = this.config;

    switch (type) {
      case IconType.VIDEO_PLAY: return videoPlayUrl;
      case IconType.IMAGE_GENERATOR: return imageGeneratorUrl;
      case IconType.VIDEO_GENERATOR: return videoGeneratorUrl;
      default: return '';
    }
  }

  /**
   * 获取图标纹理（懒加载）。命中且未销毁则直接返回；否则发起一次异步加载并返回
   * undefined（本帧跳过该图标，加载完成后由持续渲染循环自动重绘）。
   * @param type 图标类型
   * @param engine effects 引擎实例（取自 control）
   * @returns 命中且未销毁的缓存纹理；未命中且发起异步加载时返回 undefined
   */
  private getIconTexture (type: IconType, engine: Control['engine']): Texture | undefined {
    const cached = this.iconTextures.get(type);

    if (cached && !cached.isDestroyed) {
      return cached;
    }
    if (!this.iconTexturePromises.has(type)) {
      const url = this.getIconUrl(type);

      if (!url) {
        return undefined;
      }
      const promise = Texture.fromImage(url, engine).then(texture => {
        this.iconTextures.set(type, texture);

        return texture;
      });

      this.iconTexturePromises.set(type, promise);
    }

    return undefined;
  }

  /**
   * 查找鼠标命中的最上层视频对象。
   * @param mouse 鼠标位置。
   * @returns 命中视频对象的 ID。
   */
  private computeHoverVideoId (mouse: Vector2): string | undefined {
    const playerComposition = this._owner.getEngine().getServer(SceneServer).compositions[0];

    if (!playerComposition) {
      return undefined;
    }
    const videoItems = playerComposition.items.filter(item => item.type === spec.ItemType.video).reverse();

    for (const item of videoItems) {
      const itemViewBox = getItemViewBox(
        item,
        GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!),
      );

      if (itemViewBox.containsPoint(mouse)) {
        return item.getInstanceId();
      }
    }

    return undefined;
  }
}
