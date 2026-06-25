import type * as spec from '@galacean/effects-specification';
import { EffectsObject } from '../../effects-object';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { Texture } from '../../texture';

/**
 * Sprite UV 旋转方式。序列化为整数（兼容老 splits 的 flip 0/1）。
 * None 不旋转、Rotate90 将 UV 顺时针旋转 90°（width/height 互换）。
 */
export enum SpriteRotation {
  /** 不旋转 */
  None = 0,
  /** UV 旋转 90°（对应老 splits flip=1） */
  Rotate90 = 1,
}

/**
 * Sprite 资产数据
 */
export interface SpriteData extends spec.EffectsObjectData {
  /** 关联纹理（DataPath 引用） */
  texture?: spec.DataPath,
  /** 归一化 UV 矩形 [x, y, w, h]，默认整张纹理 */
  rect?: spec.vec4,
  /** UV 旋转方式（0=None, 1=Rotate90），对齐老 splits 的 flip 语义 */
  flipUv?: SpriteRotation,
}

/**
 * Sprite 资产：一张纹理 + 一个归一化 UV 矩形区域（不含 border/pivot）。
 * 被 SpriteComponent 引用，替代直接引用 Texture + 散落的 splits。
 *
 * 反序列化全部集中在 fromData 手动解析（与 SpriteComponent 风格一致），
 * 不使用 @serialize 装饰器，避免序列化/反序列化双路径带来的引用覆盖陷阱。
 */
@effectsClass('Sprite')
export class Sprite extends EffectsObject {
  /** 关联的纹理对象 */
  texture: Texture;
  /** 归一化 UV 矩形 [x, y, w, h]，默认整张纹理 */
  rect: spec.vec4 = [0, 0, 1, 1];
  /** UV 旋转方式（对应老 splits 的 flip 0/1） */
  flipUv: SpriteRotation = SpriteRotation.None;

  constructor (engine: Engine, props?: SpriteData) {
    super(engine);
    if (props) {
      this.fromData(props);
    }
  }

  override fromData (data: SpriteData): void {
    super.fromData(data);
    // findObject 对 Texture 实例原样返回，对 {id} 解析为 Texture 实例，
    // 兼容反序列化（data.texture 为 {id}）与手动构造（data.texture 为 Texture 实例）两条路径。
    this.texture = data.texture ? this.engine.findObject<Texture>(data.texture) : this.engine.whiteTexture;
    this.rect = data.rect ?? [0, 0, 1, 1];
    this.flipUv = data.flipUv ?? SpriteRotation.None;
  }

  // 注意：不在此释放 texture —— Texture 由 scene 资产系统统一管理生命周期，Sprite 仅引用。
}

