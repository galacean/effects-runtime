import { Color } from '@galacean/effects-math/es/core/color';
import * as spec from '@galacean/effects-specification';
import type { ColorPlayableAssetData } from '../../animation';
import { ColorPlayable } from '../../animation';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { TextureSourceType, type Texture2DSourceOptionsVideo } from '../../texture';
import type { FrameContext } from '../timeline';
import { Playable, PlayableAsset, TrackMixerPlayable, TrackAsset } from '../timeline';
import type { VFXItem } from '../../vfx-item';
import type { Geometry } from '../../render';
import { rotateVec2 } from '../../shape';
import { MaskableGraphic, EffectComponent } from '../../components';
import type { Sprite } from './sprite';
import { SpriteRotation } from './sprite';

/**
 * 图层元素基础属性, 经过处理后的 spec.SpriteContent.options
 */
export type SpriteItemOptions = {
  startColor: spec.vec4,
  renderLevel?: spec.RenderLevel,
};

/**
 * SpriteComponent 数据。扩展 spec.SpriteComponentData，新增可选 sprite 资产引用。
 * spec 包不可改，故本地扩展。
 */
interface SpriteComponentDataEx extends spec.SpriteComponentData {
  /** 引用的 Sprite 资产（新版数据流）；老数据经 version37Migration 迁移而来 */
  sprite?: spec.DataPath,
}

let seed = 0;

@effectsClass(spec.DataType.SpriteColorPlayableAsset)
export class SpriteColorPlayableAsset extends PlayableAsset {
  data: ColorPlayableAssetData;

  override createPlayable (): Playable {
    const spriteColorPlayable = new ColorPlayable();

    spriteColorPlayable.create(this.data);

    return spriteColorPlayable;
  }

  override fromData (data: ColorPlayableAssetData): void {
    this.data = data;
  }
}

export class ComponentTimeTrack extends TrackAsset {
  override createTrackMixer (): TrackMixerPlayable {
    return new TrackMixerPlayable();
  }
}

export class SpriteComponentTimeTrack extends ComponentTimeTrack {
  override updateAnimatedObject (boundObject: object): object {

    return (boundObject as VFXItem).getComponent(SpriteComponent);
  }
}

export class EffectComponentTimeTrack extends ComponentTimeTrack {
  override updateAnimatedObject (boundObject: object): object {
    return (boundObject as VFXItem).getComponent(EffectComponent);
  }
}

export class ComponentTimePlayableAsset extends PlayableAsset {
  override createPlayable (): Playable {
    const componentTimePlayable = new ComponentTimePlayable();

    return componentTimePlayable;
  }
}

export class ComponentTimePlayable extends Playable {
  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!('time' in boundObject)) {
      return;
    }

    boundObject.time = this.time;
  }
}

/**
 * Sprite component class
 */
@effectsClass(spec.DataType.SpriteComponent)
export class SpriteComponent extends MaskableGraphic {
  time = 0;
  duration = 1;

  protected textureSheetAnimation?: spec.TextureSheetAnimation;

  /**
   * 引用的 Sprite 资产（纹理 + 归一化 UV 矩形 + flipUv），渲染唯一数据源。
   */
  protected _sprite: Sprite;

  /**
   * 当前 Sprite 资产。设置时同步纹理、重绑 _MainTex 并重建几何体 UV。
   * @since 2.10.0
   */
  get sprite (): Sprite {
    return this._sprite;
  }

  set sprite (sprite: Sprite) {
    this.applySpriteToRenderer(sprite);
    this.updateGeometry(this.geometry);
  }

  constructor (engine: Engine, props?: SpriteComponentDataEx) {
    super(engine);

    this.name = 'MSprite' + seed++;
    if (props) {
      this.fromData(props);
    }
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    let time = this.time;
    const duration = this.duration;
    const textureAnimation = this.textureSheetAnimation;
    const loop = textureAnimation?.loop ?? true;

    if (time > duration && loop) {
      time = time % duration;
    }

    const life = Math.min(Math.max(time / duration, 0.0), 1.0);
    const { video } = this.renderer.texture.source as Texture2DSourceOptionsVideo;

    if (video) {
      if (time === 0) {
        video.pause();
      } else {
        video.play().catch(e => { this.engine.renderErrors.add(e); });
      }
      this.renderer.texture.uploadCurrentVideoFrame();
    }
    if (textureAnimation) {
      const total = textureAnimation.total || (textureAnimation.row * textureAnimation.col);
      // 帧动画不与多 split（splits.length>1）同时存在，故此处仅读 sprite 单 rect。
      // sprite 缺省时按整图 [0,0,1,1] 不旋转处理。
      const sprite = this.sprite;
      const rect = sprite?.rect ?? [0, 0, 1, 1];
      const flip = sprite?.flipUv ?? SpriteRotation.None;
      const isRotate90 = flip === SpriteRotation.Rotate90;

      // rect 在纹理上的归一化矩形 [x, y, w, h]；旋转 90° 时宽高互换。
      const rectX = rect[0];
      const rectY = rect[1];
      const rectW = isRotate90 ? rect[3] : rect[2];
      const rectH = isRotate90 ? rect[2] : rect[3];

      // 每帧在 rect 内的偏移步长；旋转 90° 时 row/col 对调。
      const dx = isRotate90
        ? 1 / textureAnimation.row * rectW
        : 1 / textureAnimation.col * rectW;
      const dy = isRotate90
        ? 1 / textureAnimation.col * rectH
        : 1 / textureAnimation.row * rectH;

      let texOffset;

      if (textureAnimation.animate) {
        const frameIndex = Math.round(life * (total - 1));
        const yIndex = Math.floor(frameIndex / textureAnimation.col);
        const xIndex = frameIndex - yIndex * textureAnimation.col;

        texOffset = isRotate90
          ? [dx * yIndex, dy * (textureAnimation.col - xIndex)]
          : [dx * xIndex, dy * (1 + yIndex)];
      } else {
        texOffset = [0, dy];
      }
      this.material.getVector4('_TexOffset')?.setFromArray([
        rectX + texOffset[0],
        rectH + rectY - texOffset[1],
        dx, dy,
      ]);
    }

    this.time = time + dt / 1000;
  }

  override onDisable (): void {
    super.onDisable();
    this.time = 0;
  }

  override onDestroy (): void {
    const texture = this.renderer.texture;
    const source = texture.source;

    if (source.sourceType === TextureSourceType.video && source?.video) {
      source.video.pause();
      source.video.src = '';
      source.video.load();
    }
  }

  protected updateGeometry (geometry: Geometry) {
    const sprite = this.sprite;
    // sprite 缺省时按整图 [0,0,1,1] 不旋转处理，等价旧默认 splits=[[0,0,1,1,0]]。
    const flip = sprite?.flipUv ?? SpriteRotation.None;
    const rect = sprite?.rect ?? [0, 0, 1, 1];
    const [x, y, w, h] = this.textureSheetAnimation
      ? [0, 0, 1, 1]
      : [rect[0], rect[1], rect[2], rect[3]];
    const isRotate90 = flip === SpriteRotation.Rotate90;
    const width = isRotate90 ? h : w;
    const height = isRotate90 ? w : h;
    const angle = isRotate90 ? -Math.PI / 2 : 0;

    const aUV = geometry.getAttributeData('aUV');
    const aPos = geometry.getAttributeData('aPos');
    const indices = geometry.getIndexData();

    const tempPosition: spec.vec2 = [0, 0];

    if (aUV && aPos && indices) {
      const vertexCount = aUV.length / 2;

      for (let i = 0; i < vertexCount; i++) {
        const positionOffset = i * 3;
        const uvOffset = i * 2;
        const positionX = aPos[positionOffset];
        const positionY = aPos[positionOffset + 1];

        tempPosition[0] = positionX;
        tempPosition[1] = positionY;
        rotateVec2(tempPosition, tempPosition, angle);

        aUV[uvOffset] = (tempPosition[0] + 0.5) * width + x;
        aUV[uvOffset + 1] = (tempPosition[1] + 0.5) * height + y;
      }

      this.geometry.setAttributeData('aPos', aPos.slice());
      this.geometry.setAttributeData('aUV', aUV.slice());
      this.geometry.setIndexData(indices.slice());
      this.geometry.setDrawCount(indices.length);
    }

    this.geometry.subMeshes.length = 0;
    for (const subMesh of geometry.subMeshes) {
      this.geometry.subMeshes.push({
        offset: subMesh.offset,
        indexCount: subMesh.indexCount,
        vertexCount: subMesh.vertexCount,
      });
    }
  }

  override fromData (data: SpriteComponentDataEx): void {
    super.fromData(data);  // MaskableGraphic: 设 renderer.texture（whiteTexture 或 data.renderer.texture）、_MainTex、_Color

    // 单 split / 新数据流：引用 Sprite 资产，渲染读 this.sprite
    if (data.sprite) {
      const sprite = this.engine.findObject<Sprite>(data.sprite);

      if (sprite) {
        this.applySpriteToRenderer(sprite);
      }
    }

    this.textureSheetAnimation = data.textureSheetAnimation;

    const geometry = data.geometry ? this.engine.findObject<Geometry>(data.geometry) : this.defaultGeometry;
    const splits = data.splits;

    if (splits && splits.length > 1) {
      // 原有打包纹理拆分逻辑（多 split，2x2 纹理打包），保留向后兼容；
      // 不依赖组件 splits 字段，直接用 data.splits。
      this.updateGeometryFromMultiSplit(splits);
    } else {
      this.updateGeometry(geometry);
    }

    this.interaction = data.interaction;

    const startColor = data.options.startColor || [1, 1, 1, 1];

    this.material.setColor('_Color', new Color().setFromArray(startColor));

    //@ts-expect-error
    this.duration = data.duration ?? this.item.duration;
  }

  /**
   * 应用 Sprite 资产到渲染器：同步纹理并重绑 _MainTex。不重建几何体。
   * fromData（后续自行 updateGeometry）与 sprite setter（随后 updateGeometry）共用。
   * 直接写 _sprite，避免经 setter 触发 updateGeometry。
   */
  protected applySpriteToRenderer (sprite: Sprite): void {
    this._sprite = sprite;
    this.renderer.texture = sprite.texture;
    this.material.setTexture('_MainTex', sprite.texture);
  }

  /**
   * @deprecated
   * 原有打包纹理拆分逻辑，仅在老数据 splits.length>1（2x2 纹理打包）时使用，保留向后兼容。
   * 不依赖组件状态，splits 由参数传入（同时存在帧动画与多 split 的数据不存在）。
   */
  protected updateGeometryFromMultiSplit (splits: spec.SplitParameter[]) {
    const sx = 1, sy = 1;
    const geometry = this.defaultGeometry;

    const originData = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];
    const aUV = [];
    const index = [];
    const position = [];
    const col = 2;
    const row = 2;

    for (let x = 0; x < col; x++) {
      for (let y = 0; y < row; y++) {
        const base = (y * 2 + x) * 4;
        const split: number[] = splits[y * 2 + x] as number[];

        const texOffset = split[4] ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];
        const dw = ((x + x + 1) / col - 1) / 2;
        const dh = ((y + y + 1) / row - 1) / 2;
        const tox = split[0];
        const toy = split[1];
        const tsx = split[4] ? split[3] : split[2];
        const tsy = split[4] ? split[2] : split[3];
        const origin = [
          originData[0] / col + dw,
          originData[1] / row + dh,
          originData[2] / col + dw,
          originData[3] / row + dh,
          originData[4] / col + dw,
          originData[5] / row + dh,
          originData[6] / col + dw,
          originData[7] / row + dh,
        ];

        aUV.push(
          texOffset[0] * tsx + tox, texOffset[1] * tsy + toy,
          texOffset[2] * tsx + tox, texOffset[3] * tsy + toy,
          texOffset[4] * tsx + tox, texOffset[5] * tsy + toy,
          texOffset[6] * tsx + tox, texOffset[7] * tsy + toy,
        );
        position.push((origin[0]) * sx, (origin[1]) * sy, 0.0,
          (origin[2]) * sx, (origin[3]) * sy, 0.0,
          (origin[4]) * sx, (origin[5]) * sy, 0.0,
          (origin[6]) * sx, (origin[7]) * sy, 0.0);
        index.push(base, 1 + base, 2 + base, 2 + base, 1 + base, 3 + base);
      }
    }
    geometry.setAttributeData('aPos', new Float32Array(position));
    geometry.setIndexData(new Uint16Array(index));
    geometry.setAttributeData('aUV', new Float32Array(aUV));
    geometry.setDrawCount(index.length);
  }
}
