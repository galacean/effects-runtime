precision highp float;

varying vec2 uv;
uniform sampler2D _MainTex;
uniform float _Threshold;

void main(){
vec4 mainColor = texture2D(_MainTex, uv);
mainColor.rgb = pow(mainColor.rgb, vec3(2.2));
// 根据亮度值截取高亮片段
float brightness = max(mainColor.r,max(mainColor.g, mainColor.b));
float w = max(0.0, brightness - _Threshold) / max(brightness, 0.00001); // 膝盖阈值函数权重
mainColor.rgb *= w;
gl_FragColor = vec4(mainColor.rgb, 1.0);
}