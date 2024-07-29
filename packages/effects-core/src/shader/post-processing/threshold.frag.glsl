precision highp float;

varying vec2 uv;
uniform sampler2D _MainTex;
uniform float _Threshold;

void main() {
    vec4 mainTex = texture2D(_MainTex, uv);
    mainTex.rgb = pow(mainTex.rgb, vec3(2.2));
// 根据亮度值截取高亮片段
    float brightness = max(mainTex.r, max(mainTex.g, mainTex.b));
    float w = max(0.0, brightness - _Threshold) / max(brightness, 0.00001); // 膝盖阈值函数权重
    mainTex.rgb *= w;
    mainTex.rgb *= mainTex.a;
    gl_FragColor = vec4(mainTex.rgb, 1.0);
}