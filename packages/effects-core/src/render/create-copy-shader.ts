import { createShaderWithMarcos, ShaderType } from '../material';
import copy from '../shader/adjust/copy.frag.glsl';
import type { SharedShaderWithSource } from './shader';
import { GLSLVersion } from './shader';

export const EFFECTS_COPY_MESH_NAME = 'effects-internal-copy';
export const COPY_MESH_SHADER_ID = 'effects-internal-copy-mesh';

export const COPY_VERTEX_SHADER = `
#ifdef WEBGL2
#define vsIn in
#define vsOut out
#else
#define vsIn attribute
#define vsOut varying
#endif
precision highp float;
vsIn vec2 aPos;
vsOut vec2 vTex;
void main(){
    gl_Position = vec4(aPos,0.,1.0);
    vTex = (aPos + vec2(1.0))/2.;
}`;

export const COPY_FRAGMENT_SHADER = `precision mediump float;
#ifdef WEBGL2
#define fsIn in
#define fsOut out
#define texture2D texture
#else
#define fsIn varying
#endif
${copy}
fsIn vec2 vTex;
#ifdef WEBGL2
layout (location = 0) out vec4 fragColor;
#else
#define fragColor gl_FragColor
#endif

#ifdef DEPTH_TEXTURE
uniform sampler2D uDepth;
#ifndef WEBGL2
#extension GL_EXT_frag_depth : enable
#define gl_FragDepth gl_FragDepthEXT
#endif
#endif
void main(){
    fragColor = filterMain(vTex,uFilterSource);
    #ifdef DEPTH_TEXTURE
    gl_FragDepth = texture2D(uDepth,vTex).r;
    #endif
}
`;

export function createCopyShader (level: number, writeDepth?: boolean): SharedShaderWithSource {
  const webgl2 = level === 2;
  const version = webgl2 ? '#version 300 es' : '';

  return {
    name: EFFECTS_COPY_MESH_NAME,
    vertex: createShaderWithMarcos([], version + '\n' + COPY_VERTEX_SHADER, ShaderType.vertex, level),
    fragment: createShaderWithMarcos([], version + '\n' + COPY_FRAGMENT_SHADER, ShaderType.fragment, level),
    glslVersion: webgl2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
    marcos: [
      ['WEBGL2', !!webgl2],
      ['DEPTH_TEXTURE', !!writeDepth],
    ],
    // @ts-expect-error
    cacheId: COPY_MESH_SHADER_ID + (+writeDepth),
  };
}
