import type * as spec from '@galacean/effects-specification';
import { Matrix4, Quaternion, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import { glContext } from '../../gl';
import type { MaterialProps } from '../../material';
import { createShaderWithMarcos, Material, ShaderType } from '../../material';
import type { MeshRendererOptions } from '../../render';
import { Geometry, GLSLVersion, Mesh } from '../../render';
import type { Transform } from '../../transform';
import type { Engine } from '../../engine';
import { createValueGetter } from '../../math';

const vertex = `
precision highp float;

attribute vec2 aPoint;
uniform vec4 uPos;
uniform vec2 uSize;
uniform vec4 uQuat;
uniform vec4 uColor;
uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_MatrixVP;
varying vec4 vColor;
#ifdef ENV_EDITOR
  uniform vec4 uEditorTransform;
#endif

vec3 rotateByQuat(vec3 a, vec4 quat){
  vec3 qvec = quat.xyz;
  vec3 uv = cross(qvec, a);
  vec3 uuv = cross(qvec, uv) * 2.;
  return a +(uv * 2. * quat.w + uuv);
}

void main() {
  vec4 _pos = uPos;
  vec3 point = rotateByQuat(vec3(aPoint.xy * uSize, 0.),uQuat);
  vec4 pos = vec4(_pos.xyz, 1.0);
  pos = effects_ObjectToWorld * pos;
  pos.xyz += effects_MatrixInvV[0].xyz * point.x+ effects_MatrixInvV[1].xyz * point.y;
  gl_Position = effects_MatrixVP * pos;
  vColor = uColor;
  #ifdef ENV_EDITOR
    gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w, gl_Position.zw);
  #endif
}
`;
const fragment = `
precision highp float;

#define fragColor gl_FragColor

varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}
`;

let seed = 1;

export class InteractMesh {
  mesh: Mesh;
  private readonly color: spec.RGBAColor | spec.RGBAColorValue;

  constructor (
    props: spec.InteractContent,
    rendererOptions: MeshRendererOptions,
    private readonly transform: Transform,
    private readonly engine: Engine,
  ) {
    this.color = (props.options as spec.ClickInteractOption).previewColor;
    const material = this.createMaterial(rendererOptions);
    const geometry = this.createGeometry();

    this.mesh = this.createMesh(geometry, material);
    this.updateMesh();
  }

  updateMesh () {
    const { material } = this.mesh;
    const uSize = material.getVector2('uSize')!.clone();
    const uPos = material.getVector4('uPos')!.clone();

    const tempPos = new Vector3();
    const tempQuat = new Quaternion();
    const tempScale = this.transform.scale.clone();

    this.transform.assignWorldTRS(tempPos, tempQuat, tempScale);

    uSize.x = tempScale.x;
    uSize.y = tempScale.y;
    uPos.x = tempPos.x;
    uPos.y = tempPos.y;
    uPos.z = tempPos.z;

    material.setVector2('uSize', uSize);
    material.setVector4('uPos', uPos);
    material.setQuaternion('uQuat', tempQuat);
  }

  private createMaterial (rendererOptions: MeshRendererOptions): Material {
    const marcos: [key: string, value: boolean | number][] = [
      ['ENV_EDITOR', this.engine.renderer?.env === PLAYER_OPTIONS_ENV_EDITOR],
    ];
    const color = createValueGetter(this.color).getValue(0);
    const { level } = this.engine.gpuCapability;

    const materialProps: MaterialProps = {
      shader: {
        vertex: createShaderWithMarcos(marcos, vertex, ShaderType.vertex, level),
        fragment: createShaderWithMarcos(marcos, fragment, ShaderType.fragment, level),
        glslVersion: GLSLVersion.GLSL1,
        cacheId: `${rendererOptions.cachePrefix}_effects_interact`,
      },
      uniformSemantics: {
        effects_MatrixVP: 'VIEWPROJECTION',
        effects_MatrixInvV: 'VIEWINVERSE',
        effects_ObjectToWorld: 'MODEL',
        uEditorTransform: 'EDITOR_TRANSFORM',
      },
    };

    const material = Material.create(this.engine, materialProps);

    material.depthTest = false;
    material.setVector4('uPos', new Vector4(0, 0, 0, 0));
    material.setVector2('uSize', new Vector2(1, 1));
    material.setVector4('uColor', new Vector4(color[0] / 255, color[1] / 255, color[2] / 255, color[3]));
    material.setQuaternion('uQuat', new Quaternion(0, 0, 0, 0));

    return material;
  }

  private createGeometry () {
    const indexData = new Uint8Array([0, 1, 1, 2, 2, 3, 3, 0]);

    return Geometry.create(
      this.engine,
      {
        attributes: {
          aPoint: {
            size: 2,
            offset: 0,
            stride: 2 * Float32Array.BYTES_PER_ELEMENT,
            data: new Float32Array([
              -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, -0.5,
            ]),
          },
        },
        drawCount: indexData.length,
        indices: { data: indexData },
        mode: glContext.LINES,
        maxVertex: 4,
      });
  }

  private createMesh (geometry: Geometry, material: Material) {
    return Mesh.create(
      this.engine,
      {
        name: 'Interact_preview' + seed++,
        priority: 0,
        worldMatrix: Matrix4.fromIdentity(),
        geometry,
        material,
      });
  }
}
