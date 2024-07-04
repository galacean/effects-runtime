precision highp float;

#define FEATURES

#include <webglCompatibility.glsl>

vsIn vec3 aPos;
vsOut vec3 v_CameraDir;


uniform mat4 _InvViewProjectionMatrix;

void main(){
  vec4 dir = _InvViewProjectionMatrix * vec4(aPos.xy, 1, 1);
  v_CameraDir = normalize(dir.xyz / dir.w);

  gl_Position = vec4(aPos.xy, 0.99999, 1);
}