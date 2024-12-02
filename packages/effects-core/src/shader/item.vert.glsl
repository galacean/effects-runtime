precision highp float;

attribute vec2 atlasOffset;//x y
attribute vec3 aPos;//x y

varying vec2 vTexCoord;
varying vec3 vParams;// texIndex mulAplha
varying vec4 vColor;

uniform vec2 _Size;
uniform vec3 _Scale;
uniform vec4 _Color;
uniform vec4 _TexParams;//transparentOcclusion blending renderMode
uniform vec4 _TexOffset;// x y sx sy
uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixV;

#ifdef ENV_EDITOR
uniform vec4 uEditorTransform;
#endif

void main() {
  vec4 texParams = _TexParams;
  vTexCoord = vec2(atlasOffset.xy * _TexOffset.zw + _TexOffset.xy);
  vColor = _Color;
  vParams = vec3(0.0, texParams.y, texParams.x);

  if(texParams.z == 1.0) {
    vec4 pos = vec4(aPos.xy * _Size, aPos.z, 1.0);
    gl_Position = effects_MatrixVP * effects_ObjectToWorld * pos;
  } else { // Billboard
    mat4 view = effects_MatrixV;
    // 提取摄像机的右向量和上向量
    vec3 camRight = vec3(view[0][0], view[1][0], view[2][0]); // 视图矩阵的第一列
    vec3 camUp = vec3(view[0][1], view[1][1], view[2][1]);    // 视图矩阵的第二列

    // 计算模型转换后的位置
    vec3 worldPosition = vec3(effects_ObjectToWorld * vec4(0.0, 0.0, 0.0, 1.0));

    // 根据局部顶点在 billboarding 平面上的方向，调整到面向摄像机的世界坐标
    vec3 vertexPosition = worldPosition + camRight * aPos.x * _Size.x * _Scale.x + camUp * aPos.y * _Size.y * _Scale.y;
    gl_Position = effects_MatrixVP * vec4(vertexPosition, 1.0);
  }

#ifdef ENV_EDITOR
  gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w, gl_Position.zw);
#endif
}
