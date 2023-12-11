import type { ModelItemLight } from '../index';
import { Vector2, Vector3 } from './math';
import { PObjectType, PLightType } from './common';
import { PEntity } from './object';
import { PluginHelper } from '../utility/plugin-helper';
import type { ModelVFXItem } from '../plugin/model-vfx-item';

export class PLight extends PEntity {
  direction: Vector3 = new Vector3(0, 0, 1);
  range = 0;
  color: Vector3 = new Vector3(1, 1, 1);
  intensity = 0;
  outerConeAngle = 0;
  innerConeAngle = 0;
  lightType = PLightType.ambient;
  padding: Vector2 = new Vector2(0, 0);

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

  override tick (deltaSeconds: number) {
    if (this.ownerItem !== undefined) {
      this.transform.fromEffectsTransform(this.ownerItem.transform);
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

  tick (deltaSeconds: number) {
    this.lightList.forEach(light => {
      light.tick(deltaSeconds);
    });
  }

  insertItem (inLight: ModelItemLight, ownerItem?: ModelVFXItem): PLight {
    const light = new PLight(inLight, ownerItem);

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

