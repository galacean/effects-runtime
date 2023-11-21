uniform mat4 uMoveCameraViewPro;

vec4 filterMain(float p, vec4 pos) {
  return uMoveCameraViewPro * pos;
}
