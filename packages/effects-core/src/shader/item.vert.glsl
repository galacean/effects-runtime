#version 300 es
precision highp float;
#define SHADER_VERTEX 1
#define SPRITE_SHADER 1
in vec4 aPoint;//x y
in vec2 aIndex;//tex

#pragma "./item.define.glsl"

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_MatrixVP;

out vec4 vColor;
out vec4 vTexCoord;
#ifdef ADJUST_LAYER
out vec2 vFeatherCoord;
#endif
out highp vec3 vParams;// texIndex mulAplha

const float d2r = 3.141592653589793 / 180.;

#ifdef ENV_EDITOR
uniform vec4 uEditorTransform;
#endif

vec4 filterMain(float t, vec4 position);

#pragma FILTER_VERT

vec3 rotateByQuat(vec3 a, vec4 quat) {
  vec3 qvec = quat.xyz;
  vec3 uv = cross(qvec, a);
  vec3 uuv = cross(qvec, uv) * 2.;
  return a + (uv * 2. * quat.w + uuv);
}

void main() {
  int index = int(aIndex.x);
  vec4 texParams = uTexParams[index];
  mat4 mainData = uMainData[index];
  float life = mainData[1].z;
  if(life < 0. || life > 1.) {
    gl_Position = vec4(3., 3., 3., 1.);
  } else {
    vec4 _pos = mainData[0];
    vec2 size = mainData[1].xy;
    vec3 point = rotateByQuat(vec3(aPoint.xy * size, 0.), mainData[2]);
    vec4 pos = vec4(_pos.xyz, 1.0);

    float renderMode = texParams.z;
    if(renderMode == 0.) {
      pos = effects_ObjectToWorld * pos;
      pos.xyz += effects_MatrixInvV[0].xyz * point.x + effects_MatrixInvV[1].xyz * point.y;
    } else if(renderMode == 1.) {
      pos.xyz += point;
      pos = effects_ObjectToWorld * pos;
    } else if(renderMode == 2.) {
      pos = effects_ObjectToWorld * pos;
      pos.xy += point.xy;
    } else if(renderMode == 3.) {
      pos = effects_ObjectToWorld * pos;
      pos.xyz += effects_MatrixInvV[0].xyz * point.x + effects_MatrixInvV[2].xyz * point.y;
    }

    gl_Position = effects_MatrixVP * pos;

        #ifdef ADJUST_LAYER
    vec4 filter_Position = filterMain(life, pos);
        #endif
    gl_PointSize = 6.0;

        #ifdef ENV_EDITOR
    gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w, gl_Position.zw);
        #ifdef ADJUST_LAYER
    filter_Position = vec4(filter_Position.xy * uEditorTransform.xy + uEditorTransform.zw * filter_Position.w, filter_Position.zw);
        #endif
        #endif

        #ifdef ADJUST_LAYER
    vTexCoord = vec4(filter_Position.xy / filter_Position.w + 1., gl_Position.xy / gl_Position.w + 1.) / 2.;
    vFeatherCoord = aPoint.zw;
        #else
    vec4 texOffset = uTexOffset[index];
    vTexCoord = vec4(aPoint.zw * texOffset.zw + texOffset.xy, texParams.xy);
        #endif
    vColor = mainData[3];
    vParams = vec3(aIndex.y, texParams.y, texParams.x);
  }
}
