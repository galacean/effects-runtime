import * as spec from '@galacean/effects-specification';
import { Vector3 } from '@galacean/effects-math/es/core/index';
import { Camera } from '../camera';
import type { Composition } from '../composition';
import type { FilterDefine, FilterShaderDefine } from '../filter';
import { glContext } from '../gl';
import { cameraMoveVert, copyFrag } from '../shader';
import { TextureLoadAction } from '../texture';
import { CopyPass } from './gaussian';
import { createValueGetter } from '../math';

export function createCameraMoveShader (): FilterShaderDefine[] {
  return [
    {
      vertex: cameraMoveVert,
      fragment: copyFrag,
      shaderCacheId: 'camera-move',
    },
  ];
}

export function registerCameraMoveFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {
  const { position = [0, 0, 0] } = filter as spec.CameraMoveFilterParams;
  let params = position as spec.FixedVec3Expression;

  if (Number.isFinite(position[0]) && Number.isFinite(position[1])) {
    params = [spec.ValueType.CONSTANT_VEC3, position as spec.vec3];
  }
  const pos = createValueGetter(params);
  const camera = new Camera('camera_move');
  const cameraPos = new Vector3();
  const renderer = composition.renderer;
  const textureFilter = renderer.engine.gpuCapability.level === 2 ? glContext.LINEAR : glContext.NEAREST;
  const cameraPass = new CopyPass(renderer, {
    name: 'cameraCopyPass',
    attachments: [{ texture: { format: glContext.RGBA, minFilter: textureFilter, magFilter: textureFilter } }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  return {
    mesh: {
      vertex: cameraMoveVert,
      fragment: copyFrag,
      shaderCacheId: 'camera-move',
      materialStates: {
        blending: false,
        depthTest: false,
        culling: false,
      },
      variables: {
        uMoveCameraViewPro (p) {
          camera.copy(composition.camera);
          const trans = pos.getValue(p);

          cameraPos.addVectors(
            composition.camera.position,
            new Vector3(-trans[0], -trans[1], -trans[2])
          );
          camera.position = cameraPos;

          return camera.getViewProjectionMatrix().toArray() as spec.mat4;
        },
      },
    },
    passSplitOptions: {
      attachments: [{ texture: { format: glContext.RGBA } }],
      prePasses: [cameraPass],
    },
  };
}
