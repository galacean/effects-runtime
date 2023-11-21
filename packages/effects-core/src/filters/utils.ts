import type { MaterialProps } from '../material';
import type { ShaderWithSource } from '../render';
import { Mesh } from '../render';
import { spriteMeshShaderFromFilter } from '../plugins';
import type { Engine } from '../engine';

export function cloneMeshWithShader (engine: Engine, mesh: Mesh, shader: ShaderWithSource) {
  const mtlOptions: MaterialProps = { ...mesh.material.props, shader };
  const material = mesh.material.clone(mtlOptions);

  material.blending = false;
  material.depthTest = false;
  material.culling = false;
  const ret = Mesh.create(
    engine,
    {
      geometry: mesh.geometry,
      material,
    });

  return ret;
}

export function cloneSpriteMesh (
  engine: Engine,
  spriteMesh: Mesh,
  options: { fragment: string },
): Mesh {
  const shader = spriteMeshShaderFromFilter(
    engine.gpuCapability.level,
    { fragment: options.fragment },
    { ignoreBlend: true },
  );

  return cloneMeshWithShader(engine, spriteMesh, shader);
}
