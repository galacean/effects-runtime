import type {
  GeometryMeshProps,
  GeometryProps,
  MaterialProps,
  TextureDataType,
  TextureSourceOptions,
  Engine,
} from '@galacean/effects-core';
import { Texture, Geometry, Material, Mesh, setMaxSpriteMeshItemCount, LOG_TYPE } from '@galacean/effects-core';
import { ThreeGeometry } from './three-geometry';
import { ThreeMesh } from './three-mesh';
import { ThreeTexture } from './three-texture';
import { ThreeMaterial } from './material';

export * from '@galacean/effects-core';
export * from './three-display-object';
export * from './three-texture';
export * from './material';
export * from './three-composition';

setMaxSpriteMeshItemCount(8);
/**
 * 图片的创建方法
 *
 * @param options - 图片创建参数
 * @returns THREE 中的抽象图片对象
 */
Texture.create = (engine: Engine, options: TextureSourceOptions) => {
  return new ThreeTexture(undefined, options) as Texture;
};

/**
 * 通过数据创建图片对象
 *
 * @param data - 图片数据
 * @param options - 图片创建参数
 * @returns THREE 中的抽象图片对象
 */
Texture.createWithData = (engine?: Engine, data?: TextureDataType, options?: Record<string, any>) => {
  return new ThreeTexture(data, options as TextureSourceOptions) as Texture;
};

/**
 * 材质球创建方法
 *
 * @param props - 材质球创建参数
 * @returns THREE 中的抽象材质球对象
 */
Material.create = (engine: Engine, props: MaterialProps) => {
  return new ThreeMaterial(engine, props);
};

/**
 * geometry 创建方法
 *
 * @param options - geometry 创建参数
 * @returns THREE 中的抽象 geometry 对象
 */
Geometry.create = (engine: Engine, options: GeometryProps) => {
  return new ThreeGeometry(engine, options);
};

/**
 * mesh 创建方法
 *
 * @param props - mesh 创建参数
 * @returns THREE 中的抽象 mesh 对象
 */
Mesh.create = (engine: Engine, props: GeometryMeshProps) => {
  return new ThreeMesh(engine, props);
};

export const version = __VERSION__;
console.info({
  content: '[Galacean Effects THREEJS] version: ' + __VERSION__,
  type: LOG_TYPE,
});
