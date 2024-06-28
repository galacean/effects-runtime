#version 300 es
precision highp float;
#include "./compatible.frag.glsl";
#include "./blend.glsl";

in vec4 vColor;
in vec4 vTexCoord;//x y transparentOcclusion
in highp vec2 vParams;//texIndex mulAplha
uniform vec3 uFrameColor;

void main() {
  fragColor = vec4(uFrameColor.xyz, 1.0);
}
