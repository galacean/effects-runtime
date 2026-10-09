import { defineConfig } from './config-definition';
import type { LoadingConfig } from './types';

export const DEFAULT_LOADING_FRAGMENT = `
// Shadertoy Fragment Shader
// Diagonal background gradient + wider colorful transparent shimmer

precision highp float;

varying vec2 vUV;

uniform vec4 _Time;

// ------------------------------------------------------------
// Background
// ------------------------------------------------------------
vec3 background(vec2 uv) {
    vec3 topLeft     = vec3(0.88, 0.85, 1.00);
    vec3 bottomRight = vec3(0.98, 0.98, 0.98);

    float d = (uv.x + (1.0 - uv.y)) * 0.5;
    d = smoothstep(0.0, 1.0, d);

    vec3 col = mix(topLeft, bottomRight, d);

    vec2 p1 = uv - vec2(1.13, 1.40);
    float r1 = length(p1 / vec2(0.85, 0.85));
    float g1 = 1.0 - smoothstep(0.0, 0.96, r1);
    col += vec3(172.0/255.0, 183.0/255.0, 1.0) * g1 * 0.28;

    vec2 p2 = uv - vec2(0.25, 0.23);
    float r2 = length(p2 / vec2(0.74, 0.64));
    float g2 = 1.0 - smoothstep(0.0, 1.0, r2);
    col += vec3(147.0/255.0, 108.0/255.0, 1.0) * g2 * 0.10;

    return col;
}

// ------------------------------------------------------------
// Easing: slow at start, fast at end
// ------------------------------------------------------------
float easeInQuad(float x) {
    return x * x;
}

// ------------------------------------------------------------
// Color palette helper
// ------------------------------------------------------------
vec3 palette(float t) {
    // 柔和的彩色条：蓝 -> 青 -> 紫 -> 粉 -> 蓝
    vec3 a = vec3(0.62, 0.82, 1.00);
    vec3 b = vec3(0.72, 0.95, 1.00);
    vec3 c = vec3(0.83, 0.76, 1.00);
    vec3 d = vec3(1.00, 0.82, 0.95);

    t = fract(t);

    if (t < 0.33) {
        float k = smoothstep(0.0, 0.33, t);
        return mix(a, b, k);
    } else if (t < 0.66) {
        float k = smoothstep(0.33, 0.66, t);
        return mix(b, c, k);
    } else {
        float k = smoothstep(0.66, 1.0, t);
        return mix(c, d, k);
    }
}

// ------------------------------------------------------------
// Wider colorful transparent left-to-right shimmer
// ------------------------------------------------------------
vec4 shimmerBand(vec2 uv, float t) {
    float cycle = fract(t * 0.70);
    cycle = easeInQuad(cycle);

    float x = cycle * 1.55 - 0.25;   // sweep from left to right

    float d = abs(uv.x - x);
    float band = 1.0 - smoothstep(0.0, 0.30, d);
    float core = 1.0 - smoothstep(0.0, 0.10, d);

    float x2 = x + (uv.y - 0.5) * 0.18;
    float d2 = abs(uv.x - x2);
    float band2 = 1.0 - smoothstep(0.0, 0.20, d2);

    float s = max(band * 0.85, band2 * 0.60);
    s = max(s, core * 0.95);
    s = clamp(s, 0.0, 1.0);

    // 颜色沿条带变化，模拟彩色渐变
    float hueT = uv.y * 0.25 + uv.x * 0.60 + t * 0.10;
    vec3 color1 = palette(hueT);

    // 中间更亮一点，边缘更淡
    vec3 color2 = mix(color1, vec3(1.0), core * 0.35);

    return vec4(color2, s);
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
void main() {
    vec2 uv = vUV;

    vec3 col = background(uv);

    vec4 sh = shimmerBand(uv, _Time.y);

    // 可选：增加一点柔光感
    col += sh.rgb * sh.a * 0.06;

    gl_FragColor = vec4(col, 1.0);
}`;

export const loadingConfig = defineConfig<'feedback.loading', LoadingConfig>({
  id: 'feedback.loading',
  defaults: { loadingFragment: DEFAULT_LOADING_FRAGMENT },
});
