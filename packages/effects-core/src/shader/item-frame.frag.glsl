#version 100
precision highp float;
#include "./blend.glsl";

varying vec4 vColor;
varying vec4 vTexCoord;//x y transparentOcclusion
varying highp vec2 vParams;//texIndex mulAplha
uniform vec3 uFrameColor;

void main() {
  gl_FragColor = vec4(uFrameColor.xyz, 1.0);
}
