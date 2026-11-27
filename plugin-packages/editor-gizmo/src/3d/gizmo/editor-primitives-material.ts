import type { Engine, spec } from '@galacean/effects';
import { Material, glContext, math } from '@galacean/effects';

type vec3 = spec.vec3;
const { Vector3 } = math;

/** Material for scene helpers that respect scene occlusion after post-processing. */
export function createEditorPrimitivesMaterial (engine: Engine, color: vec3, alpha = 1): Material {
  const material = Material.create(engine, {
    shader: {
      shared: true,
      fragment: `
        precision mediump float;

        uniform vec3 u_color;
        uniform float u_alpha;

        void main() {
          gl_FragColor = vec4(u_color, u_alpha);
        }`,
      vertex: `
        precision highp float;

        attribute vec3 a_Position;
        uniform mat4 effects_ObjectToWorld;
        uniform mat4 effects_MatrixVP;

        void main() {
          gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(a_Position, 1.0);
        }`,
    },
  });

  material.setVector3('u_color', Vector3.fromArray(color));
  material.setFloat('u_alpha', alpha);
  material.depthTest = true;
  material.depthFunc = glContext.LEQUAL;
  material.stencilTest = false;
  material.blending = alpha < 1;
  material.blendFunction = [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];
  material.depthMask = true;

  return material;
}
