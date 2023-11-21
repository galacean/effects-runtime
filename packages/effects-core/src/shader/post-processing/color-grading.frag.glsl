/**
 * https://github.com/ampas/aces-dev
 *
 * Academy Color Encoding System (ACES) software and tools are provided by the
 * Academy under the following terms and conditions: A worldwide, royalty-free,
 * non-exclusive right to copy, modify, create derivatives, and use, in source and
 * binary forms, is hereby granted, subject to acceptance of this license.
 *
 * Copyright 2015 Academy of Motion Picture Arts and Sciences (A.M.P.A.S.).
 * Portions contributed by others as indicated. All rights reserved.
 *
 * Performance of any of the aforementioned acts indicates acceptance to be bound
 * by the following terms and conditions:
 *
 * * Copies of source code, in whole or in part, must retain the above copyright
 * notice, this list of conditions and the Disclaimer of Warranty.
 *
 * * Use in binary form must retain the above copyright notice, this list of
 * conditions and the Disclaimer of Warranty in the documentation and/or other
 * materials provided with the distribution.
 *
 * * Nothing in this license shall be deemed to grant any rights to trademarks,
 * copyrights, patents, trade secrets or any other intellectual property of
 * A.M.P.A.S. or any contributors, except as expressly stated herein.
 *
 * * Neither the name "A.M.P.A.S." nor the name of any other contributors to this
 * software may be used to endorse or promote products derivative of or based on
 * this software without express prior written permission of A.M.P.A.S. or the
 * contributors, as appropriate.
 *
 * This license shall be construed pursuant to the laws of the State of
 * California, and any disputes related thereto shall be subject to the
 * jurisdiction of the courts therein.
 *
 * Disclaimer of Warranty: THIS SOFTWARE IS PROVIDED BY A.M.P.A.S. AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
 * NON-INFRINGEMENT ARE DISCLAIMED. IN NO EVENT SHALL A.M.P.A.S., OR ANY
 * CONTRIBUTORS OR DISTRIBUTORS, BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, RESITUTIONARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * WITHOUT LIMITING THE GENERALITY OF THE FOREGOING, THE ACADEMY SPECIFICALLY
 * DISCLAIMS ANY REPRESENTATIONS OR WARRANTIES WHATSOEVER RELATED TO PATENT OR
 * OTHER INTELLECTUAL PROPERTY RIGHTS IN THE ACADEMY COLOR ENCODING SYSTEM, OR
 * APPLICATIONS THEREOF, HELD BY PARTIES OTHER THAN A.M.P.A.S.,WHETHER DISCLOSED OR
 * UNDISCLOSED.
 */
 
// 包括合并Bloom、颜色校准、ACES ToneMapping
precision highp float;

#define HALF_MAX 60000.0
#define ACEScc_MIDGRAY 0.4135884

varying vec2 uv;
uniform sampler2D _GaussianTex;
uniform sampler2D _SceneTex;
uniform float _BloomIntensity;
uniform float _Brightness;
uniform float _Saturation;
uniform float _Contrast;
uniform bool _UseBloom;
uniform bool _UseToneMapping;

mat3 LinearToACES = mat3(
  0.59719,0.07600,0.02840,
  0.35458,0.90834,0.13383,
  0.04823,0.01566,0.83777);

mat3 ACESToLinear = mat3(
  1.60475, -0.10208, -0.00327,
  -0.53108, 1.10813, -0.07276,
  -0.07367, -0.00605, 1.07602);

float log10(float x) {
  return log(x) / log(10.0);
}

vec3 log10(vec3 v) {
  return vec3(log10(v.x), log10(v.y), log10(v.z));
}

vec3 LinearToLogC(vec3 x)
{
  return  0.244161 * log10(5.555556 * x + 0.047996) + 0.386036;
}

vec3 LogCToLinear(vec3 x)
{
  return (pow(vec3(10.0), (x - 0.386036) /  0.244161) - 0.047996) / 5.555556;
}

// ACES Reference Render Transform(RRT)
vec3 rrt_and_odt_fit(vec3 col) {
    vec3 a = col * (col + 0.0245786) - 0.000090537;
    vec3 b = col * (0.983729 * col + 0.4329510) + 0.238081;
    return a / b;
}

// ACES ToneMapping 主函数
vec3 ACESToneMapping(vec3 col) {
    vec3 aces = LinearToACES * col;
    aces = rrt_and_odt_fit(aces);
    col = ACESToLinear * aces;
    return col;
}

// 标准 ACES Gamma 矫正, 效果好但是性能一般
vec3 LinearToSrgb(vec3 c) {
  return mix(1.055*pow(c, vec3(1./2.4)) - 0.055, 12.92*c, step(c,vec3(0.0031308)));
}

// 传统 Gamma 矫正
vec3 GammaCorrection(vec3 c) {
  return pow(c, vec3(1.0/2.2));
}

void main() {
  vec4 hdrColor = texture2D(_SceneTex, uv);
  
  hdrColor.rgb = pow(hdrColor.rgb, vec3(2.2)); // srgb转linear
  
  vec3 finalColor = hdrColor.rgb; 
  if(_UseBloom) {
    vec4 bloomColor = texture2D(_GaussianTex, uv);
    bloomColor.rgb *= _BloomIntensity;
    finalColor += bloomColor.rgb; // 叠加Bloom效果后的颜色
  }

  // Apply brightness
  finalColor = finalColor * _Brightness;

  // Apply contrast
  vec3 colorLog = LinearToLogC(finalColor);
  colorLog = (colorLog - ACEScc_MIDGRAY) * _Contrast + ACEScc_MIDGRAY;
  finalColor = LogCToLinear(colorLog);
  finalColor = max(finalColor, 0.0);

  // Apply saturation
  float luminance = 0.2125 * finalColor.r + 0.7154 * finalColor.g + 0.0721 * finalColor.b;
  vec3 luminanceColor = vec3(luminance, luminance, luminance);
  finalColor = (finalColor - luminanceColor) * _Saturation + luminanceColor;
  finalColor = max(finalColor, 0.0);

  if(_UseToneMapping){
    finalColor = ACESToneMapping(finalColor);
  }
  gl_FragColor = vec4(clamp(GammaCorrection(finalColor), 0.0, 1.0), 1.0);
}