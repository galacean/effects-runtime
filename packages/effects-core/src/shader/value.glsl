#pragma "./value-define.glsl"

#ifdef SHADER_VERTEX
in float aSeed;
out float vSeed;
#define NONE_CONST_INDEX 1
#else
    #if LOOKUP_TEXTURE_CURVE
    #define NONE_CONST_INDEX 1
    #endif
#endif

#ifdef NONE_CONST_INDEX
    #ifdef SHADER_VERTEX
        #define MAX_C VERT_MAX_KEY_FRAME_COUNT
    #else
        #define MAX_C FRAG_MAX_KEY_FRAME_COUNT
    #endif
#else
    #define MAX_C CURVE_VALUE_COUNT
#endif

mat4 cubicBezierMatrix = mat4(
1.0, -3.0, 3.0, -1.0,
0.0, 3.0, -6.0, 3.0,
0.0, 0.0, 3.0, -3.0,
0.0, 0.0, 0.0, 1.0
);

float cubicBezier(float t, float y1, float y2, float y3, float y4) {
  vec4 tVec = vec4(1.0, t, t * t, t * t * t);
  vec4 yVec = vec4(y1, y2, y3, y4);
  vec4 result = tVec * cubicBezierMatrix * yVec;

  return result.x + result.y + result.z + result.w;
}

float binarySearchT(float x, float x1, float x2, float x3, float x4) {
  float left = 0.0;
  float right = 1.0;
  float mid = 0.0;
  float computedX;
  int maxIterations = 12;

  for (int i = 0; i < maxIterations; i++) {
    mid = (left + right) * 0.5;
    computedX = cubicBezier(mid, x1, x2, x3, x4);
    if (abs(computedX - x) < 0.0001) {
      break;
    } else if (computedX > x) {
      right = mid;
    } else {
      left = mid;
    }
  }
  return mid;
}

float valueFromBezierCurveFrames(float time, float frameStart, float frameCount) {
  int start = int(frameStart);
  int count = int(frameCount - 1.);

  for(int i = 0; i < count; i += 2) {
    vec4 k0 = lookup_curve(i + start);
    vec4 k1 = lookup_curve(i + 1 + start);
    if (i == 0 && time < k0.x) {
      return k0.y;
    }
    if (i == count - 1 && time > k1.x) {
      return k1.y;
    }
    if(time >= k0.x && time <= k1.x) {
      float t = binarySearchT(time, k0.x, k0.z, k1.z, k1.x);
      return cubicBezier(t, k0.y, k0.w, k1.w, k1.y);
    }
  }
}

float evaluteLineSeg(float t, vec2 p0, vec2 p1) {
  return p0.y + (p1.y - p0.y) * (t - p0.x) / (p1.x - p0.x);
}

float valueFromLineSegs(float time, float frameStart, float frameCount) {
  int start = int(frameStart);
  int count = int(frameCount - 1.);
  int end = start + count;
  for(int i = 0; i < ITR_END; i++) {
        #ifdef NONE_CONST_INDEX
    if(i > count) {
      return lookup_curve(i).w;
    }
            #else
    if(i < start) {
      continue;
    }
    if(i > end) {
      return lookup_curve(i - 2).w;
    }
            #endif

            #ifdef NONE_CONST_INDEX
    vec4 seg = lookup_curve(i + start);
        #else
    vec4 seg = lookup_curve(i);
        #endif
    vec2 p0 = seg.xy;
    vec2 p1 = seg.zw;
    if(time >= p0.x && time <= p1.x) {
      return evaluteLineSeg(time, p0, p1);
    }
        #ifdef NONE_CONST_INDEX
    vec2 p2 = lookup_curve(i + start + 1).xy;
        #else
    vec2 p2 = lookup_curve(i + 1).xy;
        #endif
    if(time > p1.x && time <= p2.x) {
      return evaluteLineSeg(time, p1, p2);
    }
  }
  return lookup_curve(0).y;
}

float getValueFromTime(float time, vec4 value) {
  float type = value.x;
  if(type == 0.) {
    return value.y;
  }
  if(type == 1.) {
    return mix(value.y, value.z, time / value.w);
  }
  if(type == 3.) {
    return valueFromLineSegs(time, value.y, value.z);
  }
  if(type == 4.) {
    return mix(value.y, value.z, aSeed);
  }
  if (type == 5.) {
    return valueFromBezierCurveFrames(time, value.z, value.w);
  }
  return 0.;
}
