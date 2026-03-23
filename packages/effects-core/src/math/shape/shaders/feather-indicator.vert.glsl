precision highp float;

attribute vec3 aPos;

uniform mat4 uProjection;

void main() {
  gl_Position = uProjection * vec4(aPos, 1.0);
}
