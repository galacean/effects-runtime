attribute vec2 aPosition;
attribute vec4 aColor;
attribute vec4 aColor2;
attribute vec2 aTexCoords;
uniform mat4 uModel;
uniform mat4 effects_MatrixVP;

#ifdef ENV_EDITOR
uniform vec4 uEditorTransform; //sx sy dx dy
#endif

varying vec4 vLight;
varying vec4 vDark;
varying vec2 vTexCoords;

void main() {
  vLight = aColor;
  vDark = aColor2;
  vTexCoords = aTexCoords;
  gl_Position = effects_MatrixVP * uModel * vec4(aPosition, 0.0, 1.0);

    #ifdef ENV_EDITOR
  gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w, gl_Position.zw);
    #endif
}
