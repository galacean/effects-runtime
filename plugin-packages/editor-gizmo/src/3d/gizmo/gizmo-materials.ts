import type { Engine, spec } from '@galacean/effects';
import { Material, Texture, glContext, math } from '@galacean/effects';
import { transformGizmoStyle } from './gizmo-settings';

type vec3 = spec.vec3;
type Vector3 = math.Vector3;
const { Vector2, Vector3, Matrix4 } = math;

/** Camera-facing ribbons keep handle lines independent of depth and axis orientation. */
export function createGizmoLineMaterial (
  engine: Engine, color: vec3, options: { depthTest?: boolean, frontOnly?: boolean },
): Material {
  const material = Material.create(engine, {
    shader: {
      shared: true,
      vertex: `
        precision highp float;
        attribute vec3 a_Position;
        attribute vec3 a_Other;
        attribute float a_Side;
        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;
        uniform vec4 effects_GizmoViewportSize;
        uniform float u_lineWidth;
        uniform vec3 u_cameraPos;
        uniform vec3 u_center;
        uniform float u_showFull;
        uniform float u_frontOnly;
        varying float v_back;

        void main() {
          vec4 world = u_model * vec4(a_Position, 1.0);
          vec4 position = _MatrixP * effects_MatrixV * world;
          vec4 other = _MatrixP * effects_MatrixV * u_model * vec4(a_Other, 1.0);
          vec2 viewport = effects_GizmoViewportSize.xy;
          vec2 direction = (other.xy / other.w - position.xy / position.w) * viewport;
          direction *= inversesqrt(max(dot(direction, direction), 0.000001));
          position.xy += vec2(-direction.y, direction.x) * a_Side * u_lineWidth / viewport * position.w;
          gl_Position = position;
          v_back = u_frontOnly > 0.5 && u_showFull < 0.5 ? -dot(world.xyz - u_center, u_cameraPos - u_center) : -1.0;
        }`,
      fragment: `
        precision mediump float;
        uniform vec3 u_color;
        uniform float u_alpha;
        varying float v_back;

        void main() {
          if (v_back > 0.0) { discard; }
          gl_FragColor = vec4(u_color, u_alpha);
        }`,
    },
  });

  material.setVector3('u_color', Vector3.fromArray(color));
  material.setFloat('u_alpha', 1);
  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.setFloat('u_lineWidth', transformGizmoStyle.lineWidth);
  material.setFloat('u_frontOnly', options.frontOnly ? 1 : 0);
  material.setFloat('u_showFull', 0);
  material.setVector3('u_cameraPos', Vector3.ZERO);
  material.setVector3('u_center', Vector3.ZERO);
  material.depthTest = options.depthTest ?? false;
  material.depthMask = options.depthTest ?? false;
  material.blending = false;
  material.culling = false;

  return material;
}

/**
 * 创建材质
 * @internal
 * @param color - 颜色
 * @param depthTest
 * @returns 纯色材质，无光照，无透明
 */
export function createGizmoMaterial (engine: Engine, color?: vec3, depthTest?: boolean): Material {
  const myColor = color ? Vector3.fromArray(color) : new Vector3(255, 255, 255);
  const myDepthTest = depthTest ? depthTest : false;

  const material = Material.create(
    engine,
    {
      uniformValues: {
        u_color: new Float32Array(myColor.toArray()),
        u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      },
      shader: {
        fragment: `
        precision mediump float;

        uniform vec3 u_color;

        void main(){
          gl_FragColor = vec4(u_color,1.0);
        }`,
        vertex: `
        precision highp float;

        attribute vec3 a_Position;

        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;

        void main(){
          gl_Position = _MatrixP * effects_MatrixV * u_model * vec4(a_Position,1.0);
        }`,
        shared: true,
      },
    });

  material.setVector3('u_color', myColor);
  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.depthTest = myDepthTest;
  material.stencilTest = false;
  material.blending = false;
  material.depthMask = true;

  return material;
}

/**
 *
 * @internal
 * @param color
 * @param depthTest
 * @returns
 */
export function createRotationRingMaterial (engine: Engine, color?: vec3, depthTest?: boolean): Material {
  const myColor = color ? Vector3.fromArray(color) : new Vector3(255, 255, 255);
  const myDepthTest = depthTest ? depthTest : false;

  const material = Material.create(
    engine,
    {
      uniformValues: {
        u_color: new Float32Array(myColor.toArray()),
        u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
        u_cameraPos: new Float32Array([0, 0, 0]),
        u_center: new Float32Array([0, 0, 0]),
        u_showFull: 0,
      },
      shader: {
        fragment: `
        precision mediump float;

        uniform vec3 u_color;

        varying float flag;

        void main(){
          if(flag > 0.0) {
            discard;
          }

          gl_FragColor = vec4(u_color,1.0);
        }`,
        vertex: `
        precision highp float;

        attribute vec3 a_Position;

        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;

        uniform vec3 u_cameraPos;
        uniform vec3 u_center;
        uniform float u_showFull;

        varying float flag;
        void main(){
          vec3 worldPosition = (u_model * vec4(a_Position,1.0)).xyz;
          flag = u_showFull > 0.5 ? -1.0 : -dot(worldPosition - u_center, u_cameraPos - u_center);
          gl_Position = _MatrixP * effects_MatrixV * u_model * vec4(a_Position,1.0);
        }`,
        shared: true,
      },
    });

  material.setVector3('u_color', myColor);
  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.setVector3('u_cameraPos', Vector3.ZERO);
  material.setVector3('u_center', Vector3.ZERO);

  material.depthTest = myDepthTest;
  material.stencilTest = false;
  material.blending = false;
  material.depthMask = true;

  return material;
}

/**
 *
 * @internal
 * @param color
 * @param depthTest
 * @param alpha
 * @returns
 */
export function createTransparentGizmoMaterial (engine: Engine, color?: vec3, depthTest?: boolean, alpha?: number): Material {
  const myColor = color ? Vector3.fromArray(color) : new Vector3(255, 255, 255);
  const myDepthTest = depthTest ? depthTest : false;
  const myAlpha = alpha ? alpha : 1;

  const material = Material.create(
    engine,
    {
      uniformValues: {
        u_color: new Float32Array(myColor.toArray()),
        u_alpha: new Float32Array([myAlpha, 0]),
        u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      },
      shader: {
        shared: true,
        fragment: `
        precision mediump float;

        uniform vec3 u_color;
        uniform vec2 u_alpha;

        void main(){
          gl_FragColor = vec4(u_color,u_alpha);
        }`,
        vertex: `
        precision highp float;

        attribute vec3 a_Position;

        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;
        void main(){
          gl_Position = _MatrixP * effects_MatrixV * u_model * vec4(a_Position,1.0);
        }`,
      },
    });

  material.setVector3('u_color', myColor);
  material.setVector2('u_alpha', new Vector2(myAlpha, 0));
  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.depthTest = myDepthTest;
  material.stencilTest = false;
  material.blending = true;
  material.blendEquation = [glContext.FUNC_ADD, glContext.FUNC_ADD];
  material.blendFunction = [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA];
  material.depthMask = true;

  return material;
}

export function createGizmoIconMaterial (engine: Engine, data?: vec3 | Texture, depthTest?: boolean): Material {
  const myDepthTest = depthTest ? depthTest : false;
  const uniformValues = {
    u_model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    u_alpha: new Float32Array([1, 0]),
    u_highlight: 0,
  };

  const material = Material.create(
    engine,
    {
      uniformValues,
      shader: {
        shared: true,
        fragment: `
        precision highp float;

        uniform vec2 u_alpha;
        uniform vec3 u_color;
        uniform sampler2D u_iconTex;
        uniform float u_highlight;

        varying vec2 v_uv;

        void main(){
          vec4 color = texture2D(u_iconTex, vec2(v_uv.x, 1.0 - v_uv.y));
          if(color.a < 0.001)
          {
              discard;
          }
          gl_FragColor = vec4(color.xyz * mix(u_color, vec3(1.0, 1.0, 0.0), u_highlight), color.w * u_alpha.x);
        }`,
        vertex: `
        precision highp float;

        attribute vec3 a_Position;
        attribute vec2 a_UV1;

        uniform mat4 u_model;
        uniform mat4 effects_MatrixV;
        uniform mat4 _MatrixP;
        uniform mat4 effects_MatrixInvV;
        varying vec2 v_uv;

        void main(){
          v_uv = a_UV1;
          vec4 pos = u_model * vec4(0., 0., 0., 1.0);
         // vec4 pos = u_model * vec4(a_Position,1.0);

          pos.xyz += effects_MatrixInvV[0].xyz * a_Position.x + effects_MatrixInvV[1].xyz * a_Position.y;
          gl_Position = _MatrixP * effects_MatrixV * pos;
        }`,
      },
    });

  material.setMatrix('u_model', Matrix4.IDENTITY);
  material.setVector2('u_alpha', new Vector2(1, 0));

  if (data instanceof Texture) {
    material.setTexture('u_iconTex', data);
    // uniformValues.u_iconTex = data;
  } else {
    let color: Vector3;

    if (data === undefined) {
      color = new Vector3(255, 255, 255);
    } else {
      color = Vector3.fromArray(data);
    }
    material.setVector3('u_color', color);
    // uniformValues.u_color = new Float32Array(color);
  }

  material.depthTest = myDepthTest;
  material.stencilTest = false;
  material.blending = true;
  material.blendEquation = [glContext.FUNC_ADD, glContext.FUNC_ADD];
  material.blendFunction = [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA];

  return material;
}
