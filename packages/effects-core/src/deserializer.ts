import type * as spec from '@galacean/effects-specification';
import type { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { Material } from './material';
import type { VFXItemProps } from './vfx-item';
import { Geometry } from './render';

/**
 * @since 2.0.0
 * @internal
 */
export class Deserializer {
  private objectInstance: Record<string, EffectsObject> = {};

  private static constructorMap: Record<number, new (engine: Engine) => EffectsObject> = {};

  constructor (
    private engine: Engine,
  ) { }

  static addConstructor (constructor: new (engine: Engine) => EffectsObject, type: number) {
    Deserializer.constructorMap[type] = constructor;
  }

  deserialize (dataPath: DataPath, sceneData: SceneData) {
    if (this.objectInstance[dataPath.id]) {
      return this.objectInstance[dataPath.id];
    }
    let effectsObject: any;
    const effectsObjectData = this.findData(dataPath, sceneData);

    switch (effectsObjectData.dataType) {
      case DataType.Material:
        effectsObject = Material.create(this.engine);

        break;
      case DataType.Geometry:
        effectsObject = Geometry.create(this.engine);

        break;
      default:
        effectsObject = new Deserializer.constructorMap[effectsObjectData.dataType](this.engine);
    }
    this.addInstance(dataPath.id, effectsObject);
    effectsObject.fromData(effectsObjectData, this, sceneData);

    return effectsObject;
  }

  findData (dataPath: DataPath, sceneData: SceneData): any {
    const data = sceneData.effectsObjects[dataPath.id];

    return data;
  }

  addInstance (id: string, effectsObject: EffectsObject) {
    this.objectInstance[id] = effectsObject;
  }
}

export enum DataType {
  VFXItemData = 0,
  EffectComponent,
  Material,
  Shader,
  SpriteComponent,
  ParticleSystem,
  InteractComponent,
  CameraController,
  Geometry,

  // FIXME: 先完成ECS的场景转换，后面移到spec中
  MeshComponent = 10000,
  SkyboxComponent,
  LightComponent,
  CameraComponent,
  ModelPluginComponent,
  TreeComponent,
}

export interface DataPath {
  id: string,
}

export interface EffectsObjectData {
  dataType: DataType,
  id: string,
}

export interface MaterialData extends EffectsObjectData {
  shader: DataPath,
  floats: Record<string, number>,
  ints: Record<string, number>,
  vector2s?: Record<string, spec.vec2>,
  vector3s?: Record<string, spec.vec3>,
  vector4s: Record<string, spec.vec4>,
  matrices?: Record<string, spec.mat4>,
  matrice3s?: Record<string, spec.mat3>,
  textures?: Record<string, DataPath>,
  floatArrays?: Record<string, number[]>,
  vector4Arrays?: Record<string, number[]>,
  matrixArrays?: Record<string, number[]>,
}

export interface GeometryData extends EffectsObjectData {
  vertices?: number[],
  uv?: number[],
  normals?: number[],
  indices?: number[],
}

export interface ShaderData extends EffectsObjectData {
  vertex: string,
  fragment: string,
}

export interface EffectComponentData extends EffectsObjectData {
  _priority: number,
  item: DataPath,
  materials: DataPath[],
  geometry: DataPath,
}

export type VFXItemData = VFXItemProps & { dataType: DataType, components: DataPath[] };

export interface SceneData {
  effectsObjects: Record<string, EffectsObjectData>,
}
