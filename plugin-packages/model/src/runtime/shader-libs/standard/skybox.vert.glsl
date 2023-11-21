precision highp float;

#define FEATURES

#include <webglCompatibility.glsl>

vsIn vec3 a_Position;
vsOut vec3 v_CameraDir;


uniform mat4 u_InvViewProjectionMatrix;

void main(){
  vec4 dir = u_InvViewProjectionMatrix * vec4(a_Position.xy, 1, 1);
  v_CameraDir = normalize(dir.xyz / dir.w);

  gl_Position = vec4(a_Position.xy, 0.99999, 1);
}