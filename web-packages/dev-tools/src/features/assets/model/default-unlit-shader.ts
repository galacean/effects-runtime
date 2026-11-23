export const DEFAULT_UNLIT_VERTEX = `precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixVP;

varying vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
}
`;

export const DEFAULT_UNLIT_FRAGMENT = `precision highp float;

uniform sampler2D _MainTex;
uniform vec4 _Color;

varying vec2 vUV;

void main() {
  vec4 color = texture2D(_MainTex, vUV) * _Color;
  color.rgb *= color.a;
  gl_FragColor = color;
}
`;
