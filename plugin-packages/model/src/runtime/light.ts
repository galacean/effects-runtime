import type { ModelItemLight } from '../index';
import { Vector2, Vector3 } from './math';
import { PObjectType, PLightType } from './common';
import { PEntity } from './object';
import { PluginHelper } from '../utility/plugin-helper';
import type { ModelVFXItem } from '../plugin/model-vfx-item';

/**
 * 灯光类，支持 3D 场景中的灯光功能
 */
export class PLight extends PEntity {
  /**
   * 方向，仅用于方向光和聚光灯
   */
  direction: Vector3 = new Vector3(0, 0, 1);
  /**
   * 范围，仅用于点光源和聚光灯
   */
  range = 0;
  /**
   * 颜色
   */
  color: Vector3 = new Vector3(1, 1, 1);
  /**
   * 强度
   */
  intensity = 0;
  /**
   * 聚光灯外径
   */
  outerConeAngle = 0;
  /**
   * 聚光灯内径
   */
  innerConeAngle = 0;
  /**
   * 类型
   */
  lightType = PLightType.ambient;
  /**
   * 填充
   */
  padding: Vector2 = new Vector2(0, 0);

  /**
   * 创建灯光对象
   * @param light 灯光参数
   * @param ownerItem 所属 VFX 元素
   */
  constructor (light: ModelItemLight, ownerItem?: ModelVFXItem) {
    super();
    this.name = light.name;
    this.type = PObjectType.light;
    this.visible = false;
    this.ownerItem = ownerItem;
    if (ownerItem !== undefined) {
      this.transform.fromEffectsTransform(ownerItem.transform);
    }

    this.direction = new Vector3(0, 0, -1);
    this.range = 0;
    this.outerConeAngle = 0;
    this.innerConeAngle = 0;
    //
    const options = light.content.options;
    const pluginColor = PluginHelper.toPluginColor4(options.color);

    this.color = new Vector3(
      pluginColor[0],
      pluginColor[1],
      pluginColor[2],
    );
    this.intensity = options.intensity;
    if (options.lightType === 'point') {
      this.lightType = PLightType.point;
      this.range = options.range;
    } else if (options.lightType === 'spot') {
      this.lightType = PLightType.spot;
      this.range = options.range;
      this.outerConeAngle = options.outerConeAngle;
      this.innerConeAngle = options.innerConeAngle;
    } else if (options.lightType === 'directional') {
      this.lightType = PLightType.directional;
    } else {
      this.lightType = PLightType.ambient;
    }
  }

  /**
   * 更新灯光变换
   * @param deltaSeconds 更新间隔
   */
  override tick (deltaSeconds: number) {
    if (this.ownerItem !== undefined) {
      this.transform.fromEffectsTransform(this.ownerItem.transform);
    }
  }

  /**
   * 是否方向光
   * @returns
   */
  isDirectional (): boolean {
    return this.lightType === PLightType.directional;
  }

  /**
   * 是否点光源
   * @returns
   */
  isPoint (): boolean {
    return this.lightType === PLightType.point;
  }

  /**
   * 是否聚光灯
   * @returns
   */
  isSpot (): boolean {
    return this.lightType === PLightType.spot;
  }

  /**
   * 是否环境光
   * @returns
   */
  isAmbient (): boolean {
    return this.lightType === PLightType.ambient;
  }

  /**
   * 获取位置
   */
  override get position (): Vector3 {
    return this.translation;
  }

  /**
   * 获取世界坐标中的位置
   * @returns
   */
  getWorldPosition (): Vector3 {
    return this.translation;
  }

  /**
   * 获取世界坐标中的方向
   * @returns
   */
  getWorldDirection (): Vector3 {
    return this.matrix.transformNormal(this.direction, new Vector3());
  }
}

/**
 * 灯光管理类，负责 3D 场景灯光的管理
 */
export class PLightManager {
  /**
   * 灯光数组
   */
  lightList: PLight[] = [];

  constructor () {

  }

  /**
   * 更新灯光数组
   * @param deltaSeconds 更新间隔
   */
  tick (deltaSeconds: number) {
    this.lightList.forEach(light => {
      light.tick(deltaSeconds);
    });
  }

  /**
   * 通过灯光参数，创建灯光对象，并保存到灯光数组中
   * @param inLight 灯光参数
   * @param ownerItem 所属 VFX 元素
   * @returns 插入的灯光对象
   */
  insertItem (inLight: ModelItemLight, ownerItem?: ModelVFXItem): PLight {
    const light = new PLight(inLight, ownerItem);

    this.lightList.push(light);

    return light;
  }

  /**
   * 插入灯光对象
   * @param inLight 灯光对象
   * @returns 插入的灯光对象
   */
  insertLight (inLight: PLight): PLight {
    this.lightList.push(inLight);

    return inLight;
  }

  /**
   * 删除灯光对象，从灯光数组中查找改对象并进行删除，如果没有找到就忽略
   * @param inLight 删除的灯光对象
   */
  remove (inLight: PLight) {
    const findResult = this.lightList.findIndex(item => {
      return item === inLight;
    });

    if (findResult !== -1) {
      this.lightList.splice(findResult, 1);
    }
  }

  /**
   * 销毁
   */
  dispose () {
    this.lightList = [];
  }

  /**
   * 灯光数目
   */
  get lightCount (): number {
    return this.lightList.length;
  }

}
