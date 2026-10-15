precision highp float;

void main() {
  gl_FragColor = vec4(mix(-1.0, 1.0, float(gl_FrontFacing)), 0.0, 0.0, 0.0);
}
