import type { ModelItemLight, ModelLightOptions } from '../index';
import { Vector2, Vector3 } from './math';
import { PObjectType, PLightType } from './common';
import { PEntity } from './object';
import { PluginHelper } from '../utility/plugin-helper';
import type { ModelLightComponent } from '../plugin/model-item';

export class PLight extends PEntity {
  owner?: ModelLightComponent;
  direction: Vector3 = new Vector3(0, 0, 1);
  range = 0;
  color: Vector3 = new Vector3(1, 1, 1);
  intensity = 0;
  outerConeAngle = 0;
  innerConeAngle = 0;
  lightType = PLightType.ambient;
  padding: Vector2 = new Vector2(0, 0);

  constructor (name: string, options: ModelLightOptions, owner?: ModelLightComponent) {
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
    this.update();
  }

  override update () {
    if (this.owner !== undefined) {
      this.transform.fromEffectsTransform(this.owner.transform);
    }
  }

  isDirectional (): boolean {
    return this.lightType === PLightType.directional;
  }

  isPoint (): boolean {
    return this.lightType === PLightType.point;
  }

  isSpot (): boolean {
    return this.lightType === PLightType.spot;
  }

  isAmbient (): boolean {
    return this.lightType === PLightType.ambient;
  }

  override get position (): Vector3 {
    return this.translation;
  }

  getWorldPosition (): Vector3 {
    return this.translation;
  }

  getWorldDirection (): Vector3 {
    return this.matrix.transformNormal(this.direction, new Vector3());
  }
}

export class PLightManager {
  lightList: PLight[] = [];

  constructor () {

  }

  insertItem (name: string, inLight: ModelLightOptions, owner?: ModelLightComponent): PLight {
    const light = new PLight(name, inLight, owner);

    this.lightList.push(light);

    return light;
  }

  insertLight (inLight: PLight): PLight {
    this.lightList.push(inLight);

    return inLight;
  }

  remove (inLight: PLight) {
    const findResult = this.lightList.findIndex(item => {
      return item === inLight;
    });

    if (findResult !== -1) {
      this.lightList.splice(findResult, 1);
    }
  }

  dispose () {
    this.lightList = [];
  }

  get lightCount (): number {
    return this.lightList.length;
  }

}

