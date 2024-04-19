float calculateMovement(float t, vec2 p1, vec2 p2, vec2 p3, vec2 p4) {
  float movement = 0.0;
  float h = (t - p1.x) * 0.1;
  float detla = 1. / (p4.x - p1.x);
  for(int i = 0; i <= 10; i++) {
    float t = float(i) * h * detla;
    float nt = binarySearchT(t, p1.x, p2.x, p3.x, p4.x);
    float y = cubicBezier(nt, p1.y, p2.y, p3.y, p3.y);
    float weight = (i == 0 || i == 10) ? 1.0 : (mod(float(i), 2.) != 0.) ? 4.0 : 2.0;
    movement += weight * y;
  }

  movement *= h / 3.;
  return movement;
}

float integrateFromBezierCurveFrames(float time, float frameStart, float frameCount) {
  int start = int(frameStart);
  int count = int(frameCount - 1.);
  float ret = 0.;
  for(int i = 0; i < ITR_END; i += 2) {
    vec4 k0 = lookup_curve(i + start);
    vec4 k1 = lookup_curve(i + 1 + start);
    if(i == 0 && time < k0.x) {
      return ret;
    }
    vec2 p1 = vec2(k0.x, k0.y);
    vec2 p2 = vec2(k0.z, k0.w);
    vec2 p3 = vec2(k1.z, k1.w);
    vec2 p4 = vec2(k1.x, k1.y);
    if(time >= k1.x) {
      ret += calculateMovement(k1.x, p1, p2, p3, p4);
    }
    if(time >= k0.x && time < k1.x) {
      return ret + calculateMovement(time, p1, p2, p3, p4);
    }
  }

  return ret;
}

float integrateByTimeLineSeg(float t, vec2 p0, vec2 p1) {
  float t0 = p0.x;
  float t1 = p1.x;
  float y0 = p0.y;
  float y1 = p1.y;
  vec4 tSqr = vec4(t, t, t0, t0);
  tSqr = tSqr * tSqr;
  vec4 a = vec4(2. * t, 3., -t0, 3.) * tSqr;
  float t1y0 = t1 * y0;
  vec4 b = vec4(y0 - y1, t0 * y1 - t1y0, 2. * y0 + y1, t1y0);
  float r = dot(a, b);
  return r / (t0 - t1) * 0.16666667;
}

float integrateLineSeg(float time, vec2 p0, vec2 p1) {
  float h = time - p0.x;
  float y0 = p0.y;
  return (y0 + y0 + (p1.y - y0) * h / (p1.x - p0.x)) * h / 2.;
}

float integrateFromLineSeg(float time, float frameStart, float frameCount) {
  if(time == 0.) {
    return 0.;
  }
  int start = int(frameStart);
  int count = int(frameCount - 1.);
  float ret = 0.;

  for(int i = 0; i < ITR_END; i++) {
    if(i > count) {
      return ret;
    }
    vec4 ks = lookup_curve(i + start);
    vec2 k0 = ks.xy;
    vec2 k1 = ks.zw;
    if(time > k0.x && time <= k1.x) {
      return ret + integrateLineSeg(time, k0, k1);
    }
    ret += integrateLineSeg(k1.x, k0, k1);
    vec2 k2 = lookup_curve(i + start + 1).xy;
    if(time > k1.x && time <= k2.x) {
      return ret + integrateLineSeg(time, k1, k2);
    }
    ret += integrateLineSeg(k2.x, k1, k2);
  }
  return ret;
}

float integrateByTimeFromLineSeg(float time, float frameStart, float frameCount) {
  if(time == 0.) {
    return 0.;
  }
  int start = int(frameStart);
  int count = int(frameCount - 1.);
  float ret = 0.;
  for(int i = 0; i < ITR_END; i++) {
    if(i > count) {
      return ret;
    }
    vec4 ks = lookup_curve(i + start);
    vec2 k0 = ks.xy;
    vec2 k1 = ks.zw;
    if(time > k0.x && time <= k1.x) {
      return ret + integrateByTimeLineSeg(time, k0, k1);
    }
    ret += integrateByTimeLineSeg(k1.x, k0, k1);

    vec2 k2 = lookup_curve(i + start + 1).xy;
    if(time > k1.x && time <= k2.x) {
      return ret + integrateByTimeLineSeg(time, k1, k2);
    }
    ret += integrateByTimeLineSeg(k2.x, k1, k2);
  }
  return ret;
}

float getIntegrateFromTime0(float t1, vec4 value) {
  float type = value.x;
  if(type == 0.) {
    return value.y * t1;
  } else if(type == 1.) {
    vec2 p0 = vec2(0., value.y);
    vec2 p1 = vec2(value.w, value.z);
    return integrateLineSeg(t1, p0, p1);
  }

  if(type == 3.) {
    return integrateFromLineSeg(t1, value.y, value.z);
  }

/*
  if(type == 2.) {
    float idx = floor(value.y);
    float ilen = floor(1. / fract(value.y) + 0.5);
    float d = integrateFromCurveFrames(t1, idx, ilen);
    return d * value.w + value.z * t1;
  }
*/

  if(type == 4.) {
    return mix(value.y, value.z, aSeed) * t1;
  }
  if(type == 5.) {
    return integrateFromBezierCurveFrames(t1, value.z, value.w);
  }
  return 0.;
}

float getIntegrateByTimeFromTime(float t0, float t1, vec4 value) {
  float type = value.x;
  if(type == 0.) {
    return value.y * (t1 * t1 - t0 * t0) / 2.;
  } else if(type == 1.) {
    vec2 p0 = vec2(0., value.y);
    vec2 p1 = vec2(value.w, value.z);
    return integrateByTimeLineSeg(t1, p0, p1) - integrateByTimeLineSeg(t0, p0, p1);
  }

/*  if(type == 2.) {
    float idx = floor(value.y);
    float ilen = floor(1. / fract(value.y) + 0.5);
    float d = integrateByTimeFromCurveFrames(t1, idx, ilen) - integrateByTimeFromCurveFrames(t0, idx, ilen);
    return d * value.w + value.z * pow(t1 - t0, 2.) * 0.5;
  }*/

  if(type == 3.) {
    return integrateByTimeFromLineSeg(t1, value.y, value.z) - integrateByTimeFromLineSeg(t0, value.y, value.z);
  }

  if(type == 4.) {
    return mix(value.y, value.z, aSeed) * (t1 * t1 - t0 * t0) / 2.;
  }
  if(type == 5.) {
    return integrateFromBezierCurveFrames(t1, value.z, value.w) - integrateFromBezierCurveFrames(t0, value.z, value.w);
  }
  return 0.;
}
