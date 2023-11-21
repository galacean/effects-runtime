float integrateCurveFrames(float t1, vec4 k0, vec4 k1) {
  float k = k1.x - k0.x;
  float m0 = k0.w * k;
  float m1 = k1.z * k;
  float t0 = k0.x;
  float v0 = k0.y;
  float v1 = k1.y;

  float dt = t0 - t1;
  float dt2 = dt * dt;
  float dt3 = dt2 * dt;

  vec4 a = vec4(dt3 * dt, dt3, dt2, dt) / vec4(4. * k * k * k, 3. * k * k, 2. * k, 1.);
  vec4 b = vec4(m0 + m1 + 2. * v0 - 2. * v1, 2. * m0 + m1 + 3. * v0 - 3. * v1, m0, -v0);
  return dot(a, b);
}

float integrateByTimeCurveFrames(float t1, vec4 k0, vec4 k1) {
  float k = k1.x - k0.x;
  float m0 = k0.w * k;
  float m1 = k1.z * k;
  float t0 = k0.x;
  float v0 = k0.y;
  float v1 = k1.y;

  float dt = t0 - t1;
  float dt2 = dt * dt;
  float dt3 = dt2 * dt;
  float k2 = k * k;
  float k3 = k2 * k;

  vec4 a = vec4(-30. * k3, 10. * k2, 5. * k, 3.) * vec4(dt, dt2, dt3, dt3 * dt);
  vec4 b = vec4(v0, m0, 2. * m0 + m1 + 3. * v0 - 3. * v1, m0 + m1 + 2. * v0 - 2. * v1) * vec4(t0 + t1, t0 + 2. * t1, t0 + 3. * t1, t0 + 4. * t1);
  return dot(a, b) / 60. / k3;
}

float integrateByTimeFromCurveFrames(float t1, float frameStart, float frameCount) {
  if(t1 == 0.) {
    return 0.;
  }
  int start = int(frameStart);
  int count = int(frameCount - 1.);
  float ret = 0.;
  for(int i = 0; i < ITR_END; i++) {
    if(i == count) {
      return ret;
    }
    vec4 k0 = lookup_curve(i + start);
    vec4 k1 = lookup_curve(i + 1 + start);
    if(t1 > k0.x && t1 <= k1.x) {
      return ret + integrateByTimeCurveFrames(t1, k0, k1);
    }
    ret += integrateByTimeCurveFrames(k1.x, k0, k1);
  }
  return ret;
}

float integrateFromCurveFrames(float time, float frameStart, float frameCount) {
  if(time == 0.) {
    return 0.;
  }
  int start = int(frameStart);
  int count = int(frameCount - 1.);
  float ret = 0.;
  for(int i = 0; i < ITR_END; i++) {
    if(i == count) {
      return ret;
    }
    vec4 k0 = lookup_curve(i + start);
    vec4 k1 = lookup_curve(i + 1 + start);
    if(time > k0.x && time <= k1.x) {
      return ret + integrateCurveFrames(time, k0, k1);
    }
    ret += integrateCurveFrames(k1.x, k0, k1);
  }
  return ret;
}

float integrateByTimeLineSeg(float t, vec2 p0, vec2 p1) {
  float t0 = p0.x;
  float t1 = p1.x;
  float y0 = p0.y;
  float y1 = p1.y;
  float r = dot(vec4(2. * t * t * t, 3. * t * t, -t0 * t0 * t0, 3. * t0 * t0), vec4(y0 - y1, t0 * y1 - t1 * y0, 2. * y0 + y1, t1 * y0));
  return r / (t0 - t1) / 6.;
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

  if(type == 2.) {
    float idx = floor(value.y);
    float ilen = floor(1. / fract(value.y) + 0.5);
    float d = integrateFromCurveFrames(t1, idx, ilen);
    return d * value.w + value.z * t1;
  }

  if(type == 4.) {
    return mix(value.y, value.z, aSeed) * t1;
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

  if(type == 2.) {
    float idx = floor(value.y);
    float ilen = floor(1. / fract(value.y) + 0.5);
    float d = integrateByTimeFromCurveFrames(t1, idx, ilen) - integrateByTimeFromCurveFrames(t0, idx, ilen);
    return d * value.w + value.z * pow(t1 - t0, 2.) * 0.5;
  }

  if(type == 3.) {
    return integrateByTimeFromLineSeg(t1, value.y, value.z) - integrateByTimeFromLineSeg(t0, value.y, value.z);
  }

  if(type == 4.) {
    return mix(value.y, value.z, aSeed) * (t1 * t1 - t0 * t0) / 2.;
  }
  return 0.;
}
