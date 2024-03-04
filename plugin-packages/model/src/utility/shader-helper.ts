import { StandardShader } from '../runtime/shader-libs/standard-shader';
import type { PShaderContext, PShaderResults } from '../runtime/shader';

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
    uniform sampler2D u_ColorSampler;

    varying vec2 v_UVCoord1;
    void main(){
      gl_FragColor = texture2D(u_ColorSampler, v_UVCoord1);
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
    uniform float u_Offset;
    uniform vec2 u_TextureSizeInv;
    uniform sampler2D u_TexturSampler;

    varying vec2 v_UVCoord1;
    void main() {
      vec4 color = vec4(0.0);
      color += texture2D(u_TexturSampler, v_UVCoord1 + vec2(-u_Offset-0.5,-u_Offset-0.5) * u_TextureSizeInv);
      color += texture2D(u_TexturSampler, v_UVCoord1 + vec2(-u_Offset-0.5, u_Offset+0.5) * u_TextureSizeInv);
      color += texture2D(u_TexturSampler, v_UVCoord1 + vec2( u_Offset+0.5,-u_Offset-0.5) * u_TextureSizeInv);
      color += texture2D(u_TexturSampler, v_UVCoord1 + vec2( u_Offset+0.5, u_Offset+0.5) * u_TextureSizeInv);
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
    uniform sampler2D u_FilterSampler;

    varying vec2 v_UVCoord1;
    void main() {
      gl_FragColor = texture2D(u_FilterSampler, v_UVCoord1) * vec4(0.5);
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
    uniform vec2 u_BlurScale;
    uniform sampler2D u_FilterSampler;

    varying vec2 v_UVCoord1;
    void main() {
      vec4 color = vec4(0);
      vec2 offset0 = vec2(0.53805) * u_BlurScale.xy;
      vec2 offset1 = vec2(2.06278) * u_BlurScale.xy;
      color += (texture2D(u_FilterSampler, v_UVCoord1 + offset0) + texture2D(u_FilterSampler, v_UVCoord1 - offset0)) * 0.44908;
      color += (texture2D(u_FilterSampler, v_UVCoord1 + offset1) + texture2D(u_FilterSampler, v_UVCoord1 - offset1)) * 0.05092;
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
    uniform vec2 u_BlurScale;
    uniform sampler2D u_FilterSampler;

    varying vec2 v_UVCoord1;
    void main() {
      vec4 color = vec4(0.0);
      color += texture2D(u_FilterSampler, v_UVCoord1 + (vec2(-3.0) * u_BlurScale.xy)) * (1.0/64.0);
      color += texture2D(u_FilterSampler, v_UVCoord1 + (vec2(-2.0) * u_BlurScale.xy)) * (6.0/64.0);
      color += texture2D(u_FilterSampler, v_UVCoord1 + (vec2(-1.0) * u_BlurScale.xy)) * (15.0/64.0);
      color += texture2D(u_FilterSampler, v_UVCoord1 + (vec2(+0.0) * u_BlurScale.xy)) * (20.0/64.0);
      color += texture2D(u_FilterSampler, v_UVCoord1 + (vec2(+1.0) * u_BlurScale.xy)) * (15.0/64.0);
      color += texture2D(u_FilterSampler, v_UVCoord1 + (vec2(+2.0) * u_BlurScale.xy)) * (6.0/64.0);
      color += texture2D(u_FilterSampler, v_UVCoord1 + (vec2(+3.0) * u_BlurScale.xy)) * (1.0/64.0);
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
    uniform vec4 u_BaseColorFactor;

    #ifdef HAS_UVS
    uniform sampler2D u_BaseColorSampler;
    varying vec2 v_UVCoord1;
    #endif

    varying vec3 v_Normal;

    float weight(float z, float a) {
      return clamp(pow(min(1.0, a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - z * 0.9, 3.0), 1e-2, 3e3);
    }

    void main() {
      vec4 color = u_BaseColorFactor;

      #ifdef HAS_UVS
      color *= texture2D(u_BaseColorSampler, v_UVCoord1);
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
    uniform sampler2D u_AccumColorSampler;
    uniform sampler2D u_AccumAlphaSampler;

    varying vec2 v_UVCoord1;
    void main() {
      vec4 accumColor = texture2D(u_AccumColorSampler, v_UVCoord1);
      vec4 accumAlpha = texture2D(u_AccumAlphaSampler, v_UVCoord1);
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

    uniform mat4 u_ModelMatrix;
    uniform mat4 u_ViewProjectionMatrix;
    attribute vec3 a_Position;
    varying vec3 v_Position;

    #ifdef HAS_UVS
    attribute vec2 a_UV1;
    varying vec2 v_UVCoord1;
    #endif

    #ifdef HAS_NORMALS
    uniform mat4 u_NormalMatrix;
    attribute vec3 a_Normal;
    varying vec3 v_Normal;
    #endif

    void main(){
      vec4 pos = u_ModelMatrix * vec4(a_Position, 1);
      v_Position = pos.xyz / pos.w;

      #ifdef HAS_UVS
      v_UVCoord1 = a_UV1;
      #endif

      #ifdef HAS_NORMALS
      v_Normal = normalize(vec3(u_ModelMatrix * vec4(a_Normal, 0)));
      #endif

      gl_Position = u_ViewProjectionMatrix * pos;
    }
  `);

  return featureList.join('\n');
}

function getQuadFilterVS (): string {
  return `
    #version 100
    precision highp float;
    attribute vec3 a_Position;
    attribute vec2 a_UV1;

    varying vec2 v_UVCoord1;
    void main(){
      v_UVCoord1 = a_UV1;
      gl_Position = vec4(a_Position.xy, 0.0, 1.0);
    }
  `;
}
