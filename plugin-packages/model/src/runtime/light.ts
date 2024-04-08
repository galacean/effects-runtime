import type { ModelItemLight, ModelLightOptions, ModelLightComponentData } from '../index';
import { Vector2, Vector3 } from './math';
import { PObjectType, PLightType } from './common';
import { PEntity } from './object';
import { PluginHelper } from '../utility/plugin-helper';
import type { ModelLightComponent } from '../plugin/model-item';

/**
 * 灯光类，支持 3D 场景中的灯光功能
 */
export class PLight extends PEntity {
  /**
   * 所属的灯光组件
   */
  owner?: ModelLightComponent;
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
  padding: Vector2 = new Vector2(0, 0);

  /**
   * 创建灯光对象
   * @param light - 灯光参数
   * @param ownerI - 所属灯光组件
   */
  constructor (name: string, data: ModelLightComponentData, owner?: ModelLightComponent) {
    super();
    this.name = name;
    this.type = PObjectType.light;
    this.visible = false;
    this.owner = owner;
    this.direction = new Vector3(0, 0, -1);
    this.range = 0;
    this.outerConeAngle = 0;
    this.innerConeAngle = 0;
    //
    const { color } = data;

    this.color = new Vector3(
      color.r,
      color.g,
      color.b,
    );
    this.intensity = data.intensity;
    if (data.lightType === 'point') {
      this.lightType = PLightType.point;
      this.range = data.range ?? -1;
    } else if (data.lightType === 'spot') {
      this.lightType = PLightType.spot;
      this.range = data.range ?? -1;
      this.outerConeAngle = data.outerConeAngle ?? Math.PI;
      this.innerConeAngle = data.innerConeAngle ?? 0;
    } else if (data.lightType === 'directional') {
      this.lightType = PLightType.directional;
    } else {
      this.lightType = PLightType.ambient;
    }
    this.update();
  }

  /**
   * 更新灯光变换
   */
  override update () {
    if (this.owner !== undefined) {
      this.transform.fromEffectsTransform(this.owner.transform);
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
   * 通过灯光参数，创建灯光对象，并保存到灯光数组中
   * @param inLight - 灯光参数
   * @param owner - 所属灯光组件
   * @returns 插入的灯光对象
   */
  insertItem (name: string, inLight: ModelLightComponentData, owner?: ModelLightComponent): PLight {
    const light = new PLight(name, inLight, owner);

    this.lightList.push(light);

    return light;
  }

  /**
   * 插入灯光对象
   * @param inLight - 灯光对象
   * @returns 插入的灯光对象
   */
  insertLight (inLight: PLight): PLight {
    this.lightList.push(inLight);

    return inLight;
  }

  /**
   * 删除灯光对象，从灯光数组中查找对象并进行删除，如果没有找到就忽略
   * @param inLight - 删除的灯光对象
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

