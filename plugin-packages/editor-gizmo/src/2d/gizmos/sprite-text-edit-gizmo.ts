import type {
  spec } from '@galacean/effects';
import {
  MouseButton,
  type InputEventMouseButton,
  type InputEventMouseMotion,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import { GizmoType } from '../gizmo-type';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getNormalizeBoxByBoxes, getTransformedBoxCorners, setBoxFromPoints, transformedBoxContainsPoint } from '../math';
import type { SpriteTextEditConfig } from '../configs/types';
import { spriteTextEditConfig } from '../configs/builtin-configs';
import { getPlayerItemById, getItemViewBox, getItemViewTransform } from '../items';
import { toColor, drawCorners, drawWithBoxTransform, fillBoxByCorners, wrapText, measureTextWidth } from '../drawing';

/**
 * 图层文字信息
 */
export type SpriteTextInfo = {
  /**
   * 元素ID
   */
  id: string,
  /**
   * 文本框索引
   */
  index: number,
  /**
   * 文本包围盒
   */
  box: Box2,
  /**
   * 文本内容
   */
  text: string,
  /**
   * 是否被修改过
   */
  hasChanged: boolean,
  /**
   * 是否处于编辑态
   */
  isEditing: boolean,
};

/**
 * 精准改字功能初始化信息
 */
export type SpriteTextInitParam = {
  /**
   * 元素ID
   */
  id: string,
  /** 原始包围盒。 */
  originBox?: Box2,
  /**
   * 改字信息
   */
  info: SpriteTextInitInfo[],
};

/** 单个精准改字文本框的初始化信息。 */
export type SpriteTextInitInfo = {
  /**
   * 是否被修改过
   */
  hasChanged: boolean,
  /**
   * 文字内容
   */
  text: string,
  /**
   * 包围盒信息
   */
  box: [spec.vec2, spec.vec2, spec.vec2, spec.vec2],
};

/** 精准改字交互参数 */
type SpriteTextEditInteractionParam = {
  /** 已选中索引 */
  selected: number,
  /** 预选中索引 */
  preSelected: number,
};

/** 精准改字结果列表 */
type SpriteTextEditResult = SpriteTextInfo[];

/** 编辑文本字号 / 行高 / 字体 */
const EDIT_TEXT_FONT_SIZE = 14;
const EDIT_TEXT_LINE_HEIGHT = 16;
const EDIT_TEXT_FONT_FAMILY = 'sans-serif';

/** 在图层文本框上提供悬停、选择、编辑和绘制能力。 */
export class SpriteTextEditGizmo extends Gizmo {
  readonly type: GizmoType = GizmoType.SPRITE_TEXT_EDIT;

  result: SpriteTextEditResult = [];
  interactionParam: SpriteTextEditInteractionParam = { preSelected: -1, selected: -1 };

  /** onMouseMove 命中缓存（坐标未变则跳过 computePreSelected，避免每帧全 result 命中扫描）。 */
  private cachedCoords: Vector2 | null = null;

  /** 当前精准改字配置。 */
  get config (): Readonly<SpriteTextEditConfig> {
    return this._owner.getConfigManager().get(spriteTextEditConfig);
  }

  /**
   * 更新指针悬停的文本框。
   * @param _event 鼠标移动事件。
   */
  override onMouseMove (_event: InputEventMouseMotion): void {
    const hover = this._owner.getMousePosition();

    if (this.cachedCoords?.x !== hover.x || this.cachedCoords?.y !== hover.y) {
      this.interactionParam.preSelected = this.computePreSelected(hover);
      this.cachedCoords = hover.clone();
    }
  }

  /** 鼠标离开交互层：清预选中 + 失效缓存。 */
  override onMouseLeave (): void {
    this.interactionParam.preSelected = -1;
    this.cachedCoords = null;
  }

  /**
   * 将命中的文本框设为编辑态并发送点击事件。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left || event.doubleClick) {
      return;
    }
    this.interactionParam.preSelected = this.computePreSelected(new Vector2(event.position.x, event.position.y));
    const targetInfo = this.result[this.interactionParam.preSelected];

    this.result.forEach(info => {
      info.isEditing = info.id === targetInfo?.id && info.index === targetInfo.index;
    });

    this.interactionParam.preSelected = -1;
    const emitInfo = targetInfo ? { id: targetInfo.id, index: targetInfo.index, text: targetInfo.text } : undefined;

    this._owner.emit('spritetextclick', { source: this, info: emitInfo });
    event.accept();
  }

  /**
   * 以初始化参数列表填充 result，将原始角点转换为相对元素包围盒的归一化盒。
   * @param initParams 初始化参数列表
   */
  initResult (initParams: SpriteTextInitParam[]) {
    initParams.forEach(param => {
      const originBox = param.originBox ?? this.getItemOriginBox(param.id);

      if (!originBox) {
        return;
      }

      param.info.forEach((initInfo, index) => {
        const { text, box, hasChanged } = initInfo;
        const corners = box.map(corner => new Vector2(...corner).add(originBox.min));
        const targetBox = setBoxFromPoints(new Box2(), corners);

        const normalizeBox = getNormalizeBoxByBoxes(originBox, targetBox);

        this.result.push({
          id: param.id,
          index,
          hasChanged,
          text: text,
          box: normalizeBox,
          isEditing: false,
        });
      });
    });
  }

  /** 清空当前所有改字结果数据。 */
  clearResultData () {
    this.result = [];
  }

  /**
   * 设置当前选中文字框；找不到时告警。
   * @param id 元素 ID
   * @param index 文本框索引
   */
  setSelected (id: string, index: number) {
    const selected = this.result.findIndex(info => info.id === id && info.index === index);

    if (selected < 0) {
      console.warn(`item ${id} does not have index ${index} text info.`);

      return;
    } else {
      this.interactionParam.selected = selected;
    }
  }

  /**
   * 设置指定文字框的文本内容；找不到时告警。
   * @param id 元素 ID
   * @param index 文本框索引
   * @param text 文本内容
   */
  setText (id: string, index: number, text: string) {
    const targetInfo = this.result.find(info => info.id === id && info.index === index);

    if (!targetInfo) {
      console.warn(`item ${id} does not have index ${index} text info.`);

      return;
    }

    targetInfo.text = text;
  }

  /**
   * 设置指定文字框的"已改动"状态；找不到时告警。
   * @param id 元素 ID
   * @param index 文本框索引
   * @param hasChanged 是否已改动
   */
  setChangedState (id: string, index: number, hasChanged: boolean) {
    const targetInfo = this.result.find(info => info.id === id && info.index === index);

    if (!targetInfo) {
      console.warn(`item ${id} does not have index ${index} text info.`);

      return;
    }

    targetInfo.hasChanged = hasChanged;
  }

  /**
   * 设置指定文字框的编辑态；找不到时告警。
   * @param id 元素 ID
   * @param index 文本框索引
   * @param isEditing 是否处于编辑态
   */
  setEditState (id: string, index: number, isEditing: boolean) {
    const targetInfo = this.result.find(info => info.id === id && info.index === index);

    if (!targetInfo) {
      console.warn(`item ${id} does not have index ${index} text info.`);

      return;
    }

    targetInfo.isEditing = isEditing;
  }

  /**
   * 绘制文本框状态与正在编辑的文本。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    // 步骤 1：读取配置并投影所有有效文本框。
    if (this.result.length === 0) {
      return;
    }

    const scale = GizmoViewportUtils.getViewScale(this._owner.getEngine());
    const {
      editBoxColor,
      editBoxAlpha,
      editBoxPreSelectedColor,
      editBoxPreSelectedAlpha,
      hasChangedEditBoxColor,
      hasChangedEditBoxAlpha,
      hasChangedEditBoxPreSelectedColor,
      hasChangedEditBoxPreSelectedAlpha,
      editBoxLineColor,
      editBoxLineAlpha,
      editBoxLinePreSelectedAlpha,
      editBoxLinePreSelectedColor,
      hasChangedEditBoxLineColor,
      hasChangedEditBoxLineAlpha,
      hasChangedEditBoxLinePreSelectedColor,
      hasChangedEditBoxLinePreSelectedAlpha,
      textColor,
    } = this.config;

    const currentPreSelected = this.interactionParam.preSelected;
    const entries = this.result
      .map((value, index) => {
        const playerItem = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], value.id);

        if (!playerItem) {
          return undefined;
        }
        const transform = getItemViewTransform(playerItem, GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!));

        if (!transform) {
          return undefined;
        }
        const viewCorners = getTransformedBoxCorners(transform, value.box);
        const isPreSelected = index === currentPreSelected;

        return { value, viewCorners, isPreSelected };
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry);

    // 步骤 2：创建单个文本框的绘制函数。
    /**
     * 绘制单个文本框。
     * @param viewCorners 文本框视口四角。
     * @param fill 填充色。
     * @param fillAlpha 填充透明度。
     * @param line 线框色。
     * @param lineAlpha 线框透明度。
     */
    const drawEntryBox = (viewCorners: Vector2[], fill: number, fillAlpha: number, line: number, lineAlpha: number) => {
      fillBoxByCorners(control, viewCorners, toColor(fill, fillAlpha));
      drawCorners(control, viewCorners, toColor(line, lineAlpha), 1);
    };

    // 步骤 3：按未修改、已修改的顺序绘制文本框。
    for (const changed of [false, true]) {
      entries
        .filter(entry => entry.value.hasChanged === changed)
        .forEach(({ viewCorners, isPreSelected }) => {
          if (changed) {
            drawEntryBox(
              viewCorners,
              isPreSelected ? hasChangedEditBoxPreSelectedColor : hasChangedEditBoxColor,
              isPreSelected ? hasChangedEditBoxPreSelectedAlpha : hasChangedEditBoxAlpha,
              isPreSelected ? hasChangedEditBoxLinePreSelectedColor : hasChangedEditBoxLineColor,
              isPreSelected ? hasChangedEditBoxLinePreSelectedAlpha : hasChangedEditBoxLineAlpha,
            );
          } else {
            drawEntryBox(
              viewCorners,
              isPreSelected ? editBoxPreSelectedColor : editBoxColor,
              isPreSelected ? editBoxPreSelectedAlpha : editBoxAlpha,
              isPreSelected ? editBoxLinePreSelectedColor : editBoxLineColor,
              isPreSelected ? editBoxLinePreSelectedAlpha : editBoxLineAlpha,
            );
          }
        });
    }

    // 步骤 4：在最上层绘制编辑态文本。
    const textFill = toColor(textColor, 1);
    const fontSize = EDIT_TEXT_FONT_SIZE * scale;
    const lineHeight = EDIT_TEXT_LINE_HEIGHT * scale;

    entries.forEach(({ value, viewCorners }) => {
      if (!value.isEditing) {
        return;
      }
      const [leftTop, rightTop, , leftBottom] = viewCorners;
      const width = leftTop.distance(rightTop);
      const height = leftTop.distance(leftBottom);
      const maxLines = Math.max(1, Math.floor(height / lineHeight));
      const lines = wrapText(value.text, width / scale, maxLines, EDIT_TEXT_FONT_SIZE, EDIT_TEXT_FONT_FAMILY);

      if (lines.length === 0) {
        return;
      }
      const blockHeight = lines.length * lineHeight;
      const xAxis = rightTop.clone().subtract(leftTop).normalize();
      const yAxis = leftBottom.clone().subtract(leftTop).normalize();

      drawWithBoxTransform(control, leftTop, xAxis, yAxis, () => {
        const topY = (height - blockHeight) / 2;

        lines.forEach((line, li) => {
          const lineWidth = measureTextWidth(line, fontSize, EDIT_TEXT_FONT_FAMILY);

          control.drawText((width - lineWidth) / 2, topY + li * lineHeight, line, fontSize, textFill, EDIT_TEXT_FONT_FAMILY);
        });
      });
    });
  }

  /**
   * 获取指定元素的视口包围盒。
   * @param id 元素 ID。
   * @returns 元素包围盒。
   */
  private getItemOriginBox (id: string): Box2 | undefined {
    const playerItem = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], id);

    if (!playerItem) {
      return undefined;
    }

    return getItemViewBox(
      playerItem,
      GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!),
    );
  }

  /**
   * 查找鼠标命中的文本框索引。
   * @param mouse 鼠标位置。
   * @returns 首个命中索引；未命中时返回 -1。
   */
  private computePreSelected (mouse: Vector2): number {
    for (let i = 0; i < this.result.length; i++) {
      const textInfo = this.result[i];
      const playerItem = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], textInfo.id);

      if (!playerItem) {
        continue;
      }
      const transform = getItemViewTransform(playerItem, GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!));

      if (transform && transformedBoxContainsPoint(transform, mouse, textInfo.box)) {
        return i;
      }
    }

    return -1;
  }
}
