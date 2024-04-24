import { StandardShader } from '../runtime/shader-libs/standard-shader';
import type { PShaderContext, PShaderResults } from '../runtime/shader';
import { PMaterialType } from '../runtime';

export function fetchPBRShaderCode (isWebGL2?: boolean): PShaderResults {
  const vertexShaderCode = StandardShader.genVertexShaderCode(PMaterialType.pbr, isWebGL2);
  const fragmentShaderCode = StandardShader.genFragmentShaderCode(PMaterialType.pbr, isWebGL2);

  return {
    vertexShaderCode,
    fragmentShaderCode,
  };
}

export function fetchUnlitShaderCode (isWebGL2?: boolean): PShaderResults {
  const vertexShaderCode = StandardShader.genVertexShaderCode(PMaterialType.unlit, isWebGL2);
  const fragmentShaderCode = StandardShader.genFragmentShaderCode(PMaterialType.unlit, isWebGL2);

  return {
    vertexShaderCode,
    fragmentShaderCode,
  };
}

/**
 * 获取 PBR 材质着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getPBRPassShaderCode (context: PShaderContext): PShaderResults {
  const vertexShaderCode = StandardShader.getVertexShaderCode(context);
  const fragmentShaderCode = StandardShader.getFragmentShaderCode(context);

  return {
    vertexShaderCode: vertexShaderCode,
    fragmentShaderCode: fragmentShaderCode,
  };
}

export function getShadowPassShaderCode (context: PShaderContext): PShaderResults {
  const vertexShaderCode = StandardShader.getVertexShaderCode(context);
  const fragmentShaderCode = StandardShader.getFragmentShaderCode(context);

  return {
    vertexShaderCode: vertexShaderCode,
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取天空盒着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getSkyBoxShaderCode (context: PShaderContext): PShaderResults {
  const vertexShaderCode = StandardShader.getVertexShaderCode(context);
  const fragmentShaderCode = StandardShader.getFragmentShaderCode(context);

  return {
    vertexShaderCode: vertexShaderCode,
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取四边形滤波着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getQuadFilterShaderCode (context: PShaderContext): PShaderResults {
  const fragmentShaderCode = `
    #version 100
    precision highp float;
    uniform sampler2D _ColorSampler;

    varying vec2 v_UVCoord1;
    void main(){
      gl_FragColor = texture2D(_ColorSampler, v_UVCoord1);
    }
  `;

  return {
    vertexShaderCode: getQuadFilterVS(),
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取法线可视化着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getNormalVisShaderCode (context: PShaderContext): PShaderResults {
  const fragmentShaderCode = `
    #version 100
    precision highp float;
    varying vec3 v_Normal;
    void main(){
      gl_FragColor = vec4(v_Normal * 0.5 + 0.5, 1);
    }
  `;

  return {
    vertexShaderCode: getBasicVS({ hasNormals: true }),
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取仅漫反射着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getDiffuseOnlyShaderCode (context: PShaderContext): PShaderResults {
  const fragmentShaderCode = `
    #version 100
    precision highp float;
    varying vec3 v_Normal;
    void main(){
      vec3 lightDir = normalize(vec3(1, 1, 1));
      gl_FragColor = vec4(max(0.0, dot(v_Normal, lightDir)) * 0.8);
    }
  `;

  return {
    vertexShaderCode: getBasicVS({ hasNormals: true }),
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取 Kawase 模糊着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getKawaseBlurShaderCode (context: PShaderContext): PShaderResults {
  const fragmentShaderCode = `
    #version 100
    precision highp float;
    uniform float _Offset;
    uniform vec2 _TextureSizeInv;
    uniform sampler2D _TexturSampler;

    varying vec2 v_UVCoord1;
    void main() {
      vec4 color = vec4(0.0);
      color += texture2D(_TexturSampler, v_UVCoord1 + vec2(-_Offset-0.5,-_Offset-0.5) * _TextureSizeInv);
      color += texture2D(_TexturSampler, v_UVCoord1 + vec2(-_Offset-0.5, _Offset+0.5) * _TextureSizeInv);
      color += texture2D(_TexturSampler, v_UVCoord1 + vec2( _Offset+0.5,-_Offset-0.5) * _TextureSizeInv);
      color += texture2D(_TexturSampler, v_UVCoord1 + vec2( _Offset+0.5, _Offset+0.5) * _TextureSizeInv);
      gl_FragColor = color * 0.25;
    }
  `;

  return {
    vertexShaderCode: getQuadFilterVS(),
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取简单滤波着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getSimpleFilterShaderCode (context: PShaderContext): PShaderResults {
  const fragmentShaderCode = `
    #version 100
    precision highp float;
    uniform sampler2D _FilterSampler;

    varying vec2 v_UVCoord1;
    void main() {
      gl_FragColor = texture2D(_FilterSampler, v_UVCoord1) * vec4(0.5);
    }
  `;

  return {
    vertexShaderCode: getQuadFilterVS(),
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取高斯模糊着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getGaussianBlurShaderCodeV2 (context: PShaderContext): PShaderResults {
  const fragmentShaderCode = `
    #version 100
    precision highp float;
    uniform vec2 _BlurScale;
    uniform sampler2D _FilterSampler;

    varying vec2 v_UVCoord1;
    void main() {
      vec4 color = vec4(0);
      vec2 offset0 = vec2(0.53805) * _BlurScale.xy;
      vec2 offset1 = vec2(2.06278) * _BlurScale.xy;
      color += (texture2D(_FilterSampler, v_UVCoord1 + offset0) + texture2D(_FilterSampler, v_UVCoord1 - offset0)) * 0.44908;
      color += (texture2D(_FilterSampler, v_UVCoord1 + offset1) + texture2D(_FilterSampler, v_UVCoord1 - offset1)) * 0.05092;
      gl_FragColor = color;
    }
  `;

  return {
    vertexShaderCode: getQuadFilterVS(),
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取高斯模糊着色器代码
 * @param context - 着色器上下文
 * @returns
 */
export function getGaussianBlurShaderCodeV1 (context: PShaderContext): PShaderResults {
  const fragmentShaderCode = `
    #version 100
    precision highp float;
    uniform vec2 _BlurScale;
    uniform sampler2D _FilterSampler;

    varying vec2 v_UVCoord1;
    void main() {
      vec4 color = vec4(0.0);
      color += texture2D(_FilterSampler, v_UVCoord1 + (vec2(-3.0) * _BlurScale.xy)) * (1.0/64.0);
      color += texture2D(_FilterSampler, v_UVCoord1 + (vec2(-2.0) * _BlurScale.xy)) * (6.0/64.0);
      color += texture2D(_FilterSampler, v_UVCoord1 + (vec2(-1.0) * _BlurScale.xy)) * (15.0/64.0);
      color += texture2D(_FilterSampler, v_UVCoord1 + (vec2(+0.0) * _BlurScale.xy)) * (20.0/64.0);
      color += texture2D(_FilterSampler, v_UVCoord1 + (vec2(+1.0) * _BlurScale.xy)) * (15.0/64.0);
      color += texture2D(_FilterSampler, v_UVCoord1 + (vec2(+2.0) * _BlurScale.xy)) * (6.0/64.0);
      color += texture2D(_FilterSampler, v_UVCoord1 + (vec2(+3.0) * _BlurScale.xy)) * (1.0/64.0);
      gl_FragColor = color;
    }
  `;

  return {
    vertexShaderCode: getQuadFilterVS(),
    fragmentShaderCode: fragmentShaderCode,
  };
}

/**
 * 获取透明效果着色器代码
 * @param isVertexShader - 是否顶点着色器
 * @returns
 */
export function getTransparecyBaseShader (isVertexShader: boolean): string {
  if (isVertexShader) {
    return getBasicVS({ hasNormals: true });
  } else {
    return `
    #version 100
    #extension GL_EXT_draw_buffers: require

    precision highp float;
    uniform vec4 _BaseColorFactor;

    #ifdef HAS_UVS
    uniform sampler2D _BaseColorSampler;
    varying vec2 v_UVCoord1;
    #endif

    varying vec3 v_Normal;

    float weight(float z, float a) {
      return clamp(pow(min(1.0, a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - z * 0.9, 3.0), 1e-2, 3e3);
    }

    void main() {
      vec4 color = _BaseColorFactor;

      #ifdef HAS_UVS
      color *= texture2D(_BaseColorSampler, v_UVCoord1);
      #endif

      color.rgb *= color.a * dot(normalize(v_Normal), normalize(vec3(0, 1, 3))) * 5.0;
      float w = weight(gl_FragCoord.z, color.a);
      gl_FragData[0] = vec4(color.rgb * w, color.a);
      gl_FragData[1] = vec4(color.a * w);
    }
    `;
  }
}

/**
 * 获取透明效果滤波着色器代码
 * @param isVertexShader - 是否顶点着色器
 * @returns
 */
export function getTransparecyFilterShader (isVertexShader: boolean): string {
  if (isVertexShader) {
    return getQuadFilterVS();
  } else {
    return `
    #version 100
    precision highp float;
    uniform sampler2D _AccumColorSampler;
    uniform sampler2D _AccumAlphaSampler;

    varying vec2 v_UVCoord1;
    void main() {
      vec4 accumColor = texture2D(_AccumColorSampler, v_UVCoord1);
      vec4 accumAlpha = texture2D(_AccumAlphaSampler, v_UVCoord1);
      float finalAlpha = 1.0 - accumColor.a;
      vec3 finalColor = accumColor.rgb / clamp(accumAlpha.r, 0.001, 50000.0);
      gl_FragColor = vec4(finalColor, finalAlpha);
    }
    `;
  }
}

function getBasicVS (params: Record<string, boolean> = {}): string {
  const featureList: string[] = ['#version 100'];

  if (params.hasUVs) { featureList.push('#define HAS_UVS 1'); }
  if (params.hasNormals) { featureList.push('#define HAS_NORMALS 1'); }

  featureList.push(`
    precision highp float;

    uniform mat4 _ModelMatrix;
    uniform mat4 _ViewProjectionMatrix;
    attribute vec3 aPos;
    varying vec3 v_Position;

    #ifdef HAS_UVS
    attribute vec2 aUV;
    varying vec2 v_UVCoord1;
    #endif

    #ifdef HAS_NORMALS
    uniform mat4 _NormalMatrix;
    attribute vec3 aNormal;
    varying vec3 v_Normal;
    #endif

    void main(){
      vec4 pos = _ModelMatrix * vec4(aPos, 1);
      v_Position = pos.xyz / pos.w;

      #ifdef HAS_UVS
      v_UVCoord1 = aUV;
      #endif

      #ifdef HAS_NORMALS
      v_Normal = normalize(vec3(_ModelMatrix * vec4(aNormal, 0)));
      #endif

      gl_Position = _ViewProjectionMatrix * pos;
    }
  `);

  return featureList.join('\n');
}

function getQuadFilterVS (): string {
  return `
    #version 100
    precision highp float;
    attribute vec3 aPos;
    attribute vec2 aUV;

    varying vec2 v_UVCoord1;
    void main(){
      v_UVCoord1 = aUV;
      gl_Position = vec4(aPos.xy, 0.0, 1.0);
    }
  `;
}
