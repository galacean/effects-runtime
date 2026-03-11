precision highp float;

varying float vHalfLength;
varying vec2 vLocal;

uniform float uRadius;

const float PI_4 = 0.7853981633;

float integBoundaryLine_Polar_3 (float r2, float b, float y1, float y2) {
  float b2 = b * b;
  float b4 = b2 * b2;
  float b6 = b4 * b2;
  float r4 = r2 * r2;
  float r6 = r4 * r2;
  float y1_2 = y1 * y1;
  float y2_2 = y2 * y2;
  float c1 = b * (0.5 - 0.75 * b2 / r2 + 0.5 * b4 / r4 - 0.125 * b6 / r6);
  float c2 = b * (-0.25 / r2 + 1.0 / 3.0 * b2 / r4 - 0.125 * b4 / r6);
  float c3 = b * (0.1 / r4 - 0.075 * b2 / r6);
  float c4 = b * (-1.0 / 56.0 / r6);
  float integ1 = (((c4 * y1_2 + c3) * y1_2 + c2) * y1_2 + c1) * y1;
  float integ2 = (((c4 * y2_2 + c3) * y2_2 + c2) * y2_2 + c1) * y2;
  float integArc = 0.125 * r2 * (atan(y2 / b) - atan(y1 / b));

  return (integ2 - integ1 - integArc) / (r2 * PI_4);
}

float getFeather (float r2, vec2 local) {
  float xSpan = sqrt(max(r2 - local.y * local.y, 0.0));
  float xLocal2 = max(min(local.x + xSpan, vHalfLength), -vHalfLength);
  float xLocal1 = min(max(local.x - xSpan, -vHalfLength), vHalfLength);

  return integBoundaryLine_Polar_3(r2, local.y, xLocal1 - vLocal.x, xLocal2 - vLocal.x);
}

void main() {
  float r2 = uRadius * uRadius;

  gl_FragColor = vec4(clamp(getFeather(r2, vLocal), -1.0, 1.0), 0.0, 0.0, 0.0);
}
