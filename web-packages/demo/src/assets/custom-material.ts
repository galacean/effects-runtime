import type { GeometryData } from '@galacean/effects';
import { DataType, glContext, type SceneData } from '@galacean/effects';
import { TrailShader } from './shaders/trail-shader';

const trailShaderData = TrailShader.getShaderData();

const geometryData: GeometryData = {
  id: 'Geometry1',
  dataType: DataType.Geometry,
  vertices:[
    -24.1306, 0, 80.0432, 25.2414, 0, 80.0413, 24.7642, 0, 76.9534, -23.6524, 0, 76.9554, -19.4331, 0, 157.237, 20.542, 0, 157.237, 21.329, 0, 154.149, -20.2199, 0, 154.149, 22.0945, 0, 151.062, -20.985, 0, 151.062,
    22.815, 0, 147.974, -21.7051, 0, 147.974, 23.4924, 0, 144.886, -22.3817, 0, 144.886, 24.1121, 0, 141.798, -23.0007, 0, 141.798, 24.6665, 0, 138.71, -23.5545, 0, 138.711, 25.1565, 0, 135.622, -24.0441, 0, 135.623,
    25.5914, 0, 132.535, -24.478, 0, 132.535, 25.9721, 0, 129.447, -24.8577, 0, 129.447, 26.2969, 0, 126.359, -25.182, 0, 126.36, 26.5684, 0, 123.271, -25.4523, 0, 123.272, 26.7882, 0, 120.183, -25.6721, 0, 120.184,
    26.9623, 0, 117.095, -25.8477, 0, 117.096, 27.0905, 0, 114.007, -25.9744, 0, 114.009, 27.1779, 0, 110.92, -26.0598, 0, 110.921, 27.2273, 0, 107.832, -26.109, 0, 107.833, 27.2411, 0, 104.744, -26.123, 0, 104.745,
    27.2108, 0, 101.656, -26.0926, 0, 101.658, 27.1104, 0, 98.5683, -25.9929, 0, 98.5697, 26.9418, 0, 95.4805, -25.8247, 0, 95.482, 26.7095, 0, 92.3926, -25.5928, 0, 92.3942, 26.4173, 0, 89.3048, -25.3013, 0, 89.3065,
    26.0709, 0, 86.2169, -24.9557, 0, 86.2187, 25.6901, 0, 83.1291, -24.5775, 0, 83.1309, 5.99812, 0, -0.242529, -4.92743, 0, -0.238635, -5.62864, 0, 2.84913, 6.69914, 0, 2.84532, -6.37102, 0, 5.93689, 7.44008, 0, 5.93315,
    -7.14734, 0, 9.02465, 8.21685, 0, 9.02099, -7.95257, 0, 12.1124, 9.02581, 0, 12.1088, -8.78814, 0, 15.2002, 9.86244, 0, 15.1967, -9.64552, 0, 18.2879, 10.7212, 0, 18.2845, -10.5184, 0, 21.3757, 11.5958, 0, 21.3723,
    -11.4037, 0, 24.4635, 12.4789, 0, 24.4602, -12.2815, 0, 27.5512, 13.3624, 0, 27.548, -13.1545, 0, 30.639, 14.2378, 0, 30.6359, -14.0101, 0, 33.7267, 15.0957, 0, 33.7237, -14.8608, 0, 36.8145, 15.9446, 0, 36.8115,
    -15.6911, 0, 39.9023, 16.7773, 0, 39.8994, -16.5024, 0, 42.99, 17.5954, 0, 42.9872, -17.2824, 0, 46.0778, 18.3736, 0, 46.075, -18.0198, 0, 49.1656, 19.1181, 0, 49.1629, -18.7441, 0, 52.2533, 19.8448, 0, 52.2507,
    -19.4503, 0, 55.3411, 20.5532, 0, 55.3386, -20.1125, 0, 58.4288, 21.2134, 0, 58.4264, -20.7566, 0, 61.5166, 21.8596, 0, 61.5142, -21.3871, 0, 64.6044, 22.4922, 0, 64.6021, -21.9985, 0, 67.6921, 23.1053, 0, 67.6899,
    -22.5985, 0, 70.7799, 23.7069, 0, 70.7777, -23.1418, 0, 73.8676, 24.2517, 0, 73.8656,
  ],
  uv:[
    0.509804, 8.37517e-09, 0.509804, 1, 0.490196, 1, 0.490196, 7.51809e-09, 1, 2.98023e-08, 1, 1, 0.980392, 1, 0.980392, 2.89452e-08, 0.960784, 1, 0.960784, 2.80881e-08,
    0.941176, 1, 0.941176, 2.72311e-08, 0.921569, 1, 0.921569, 2.6374e-08, 0.901961, 1, 0.901961, 2.55169e-08, 0.882353, 1, 0.882353, 2.46598e-08, 0.862745, 1, 0.862745, 2.38027e-08,
    0.843137, 1, 0.843137, 2.29456e-08, 0.823529, 1, 0.823529, 2.20885e-08, 0.803922, 1, 0.803922, 2.12315e-08, 0.784314, 1, 0.784314, 2.03744e-08, 0.764706, 1, 0.764706, 1.95173e-08,
    0.745098, 1, 0.745098, 1.86602e-08, 0.72549, 1, 0.72549, 1.78031e-08, 0.705882, 1, 0.705882, 1.6946e-08, 0.686274, 1, 0.686275, 1.60889e-08, 0.666667, 1, 0.666667, 1.52319e-08,
    0.647059, 1, 0.647059, 1.43748e-08, 0.627451, 1, 0.627451, 1.35177e-08, 0.607843, 1, 0.607843, 1.26606e-08, 0.588235, 1, 0.588235, 1.18035e-08, 0.568627, 1, 0.568627, 1.09464e-08,
    0.54902, 1, 0.54902, 1.00893e-08, 0.529412, 1, 0.529412, 9.23226e-09, 0, 1, 0, -1.39091e-08, 0.0196078, -1.3052e-08, 0.0196078, 1, 0.0392157, -1.21949e-08, 0.0392157, 1,
    0.0588235, -1.13378e-08, 0.0588235, 1, 0.0784313, -1.04807e-08, 0.0784314, 1, 0.0980392, -9.62364e-09, 0.0980392, 1, 0.117647, -8.76655e-09, 0.117647, 1, 0.137255, -7.90947e-09, 0.137255, 1,
    0.156863, -7.05238e-09, 0.156863, 1, 0.176471, -6.19529e-09, 0.176471, 1, 0.196078, -5.33821e-09, 0.196078, 1, 0.215686, -4.48112e-09, 0.215686, 1, 0.235294, -3.62403e-09, 0.235294, 1,
    0.254902, -2.76695e-09, 0.254902, 1, 0.27451, -1.90986e-09, 0.27451, 1, 0.294118, -1.05278e-09, 0.294118, 1, 0.313725, -1.9569e-10, 0.313725, 1, 0.333333, 6.61396e-10, 0.333333, 1,
    0.352941, 1.51848e-09, 0.352941, 1, 0.372549, 2.37557e-09, 0.372549, 1, 0.392157, 3.23265e-09, 0.392157, 1, 0.411765, 4.08974e-09, 0.411765, 1, 0.431373, 4.94683e-09, 0.431373, 1,
    0.45098, 5.80391e-09, 0.45098, 1, 0.470588, 6.661e-09, 0.470588, 1,
  ],
  indices:[
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 7, 6, 8, 7, 8, 9, 9, 8, 10, 9, 10, 11, 11, 10, 12, 11, 12, 13,
    13, 12, 14, 13, 14, 15, 15, 14, 16, 15, 16, 17, 17, 16, 18, 17, 18, 19, 19, 18, 20, 19, 20, 21, 21, 20, 22, 21, 22, 23,
    23, 22, 24, 23, 24, 25, 25, 24, 26, 25, 26, 27, 27, 26, 28, 27, 28, 29, 29, 28, 30, 29, 30, 31, 31, 30, 32, 31, 32, 33,
    33, 32, 34, 33, 34, 35, 35, 34, 36, 35, 36, 37, 37, 36, 38, 37, 38, 39, 39, 38, 40, 39, 40, 41, 41, 40, 42, 41, 42, 43,
    43, 42, 44, 43, 44, 45, 45, 44, 46, 45, 46, 47, 47, 46, 48, 47, 48, 49, 49, 48, 50, 49, 50, 51, 51, 50, 52, 51, 52, 53,
    53, 52, 1, 53, 1, 0, 54, 55, 56, 54, 56, 57, 57, 56, 58, 57, 58, 59, 59, 58, 60, 59, 60, 61, 61, 60, 62, 61, 62, 63,
    63, 62, 64, 63, 64, 65, 65, 64, 66, 65, 66, 67, 67, 66, 68, 67, 68, 69, 69, 68, 70, 69, 70, 71, 71, 70, 72, 71, 72, 73,
    73, 72, 74, 73, 74, 75, 75, 74, 76, 75, 76, 77, 77, 76, 78, 77, 78, 79, 79, 78, 80, 79, 80, 81, 81, 80, 82, 81, 82, 83,
    83, 82, 84, 83, 84, 85, 85, 84, 86, 85, 86, 87, 87, 86, 88, 87, 88, 89, 89, 88, 90, 89, 90, 91, 91, 90, 92, 91, 92, 93,
    93, 92, 94, 93, 94, 95, 95, 94, 96, 95, 96, 97, 97, 96, 98, 97, 98, 99, 99, 98, 100, 99, 100, 101, 101, 100, 102, 101, 102, 103,
    103, 102, 3, 103, 3, 2,
  ],
};

const vert = `precision highp float;
attribute vec3 aPos;
attribute vec2 aUV;

varying vec2 uv;

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_MatrixVP;
uniform vec4 uEditorTransform;

void main() {
  uv = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos*2.0,1.0);
}
`;
const sinFrag = `precision highp float;
varying vec2 uv;

uniform float _GlobalTime;
uniform float _MaxIntensity;
uniform float _WaveZoom;

void main() {
  float minIntensity = 1.5;
  float maxIntensity = _MaxIntensity;
  float combinedIntensity = 150.0;
  float waveZoom = _WaveZoom;
  float waveStretch = 1.5;

  vec2 iuv = vec2(uv)*2.0 - vec2(1.0, 1.0);
  vec2 uv0 = waveZoom * iuv;

  vec3 finalCol = vec3(0.0);

  uv0.y += waveStretch * sin(uv0.x - (_GlobalTime * 3.75));

  float lineIntensity = minIntensity + (maxIntensity * abs(mod(uv.x + _GlobalTime, 2.0) - 1.0));
  float glowWidth = abs(lineIntensity / (combinedIntensity * uv0.y));

  finalCol += vec3(glowWidth * (1.0 + sin(_GlobalTime * 0.33)),
                glowWidth * (1.0 - sin(_GlobalTime * 0.33)),
                glowWidth * (1.0 - cos(_GlobalTime * 0.33)));

  gl_FragColor = vec4(finalCol, 1.0);
}
`;
const bubbleFrag = `precision highp float;
#define BG_COLOR (vec3(sin(_GlobalTime)*0.5+0.5) * 0.0 + vec3(0.0))
const vec3 color1 = vec3(0.611765, 0.262745, 0.996078);
const vec3 color2 = vec3(0.298039, 0.760784, 0.913725);
const vec3 color3 = vec3(0.062745, 0.078431, 0.600000);
const float innerRadius = 0.6;
const float noiseScale = 0.65;

uniform float _GlobalTime;
uniform float _Speed;
uniform vec3 _Color;
varying vec2 uv;

// noise from https://www.shadertoy.com/view/4sc3z2
vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031,.11369,.13787));
    p3 += dot(p3, p3.yxz+19.19);
    return -1.0 + 2.0 * fract(vec3(p3.x+p3.y, p3.x+p3.z, p3.y+p3.z)*p3.zyx);
}
float snoise3(vec3 p)
{
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;

    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);

    vec3 e = step(vec3(0.0), d0 - d0.yzx);
	vec3 i1 = e * (1.0 - e.zxy);
	vec3 i2 = 1.0 - e.zxy * (1.0 - e);

    vec3 d1 = d0 - (i1 - K2);
    vec3 d2 = d0 - (i2 - K1);
    vec3 d3 = d0 - 0.5;

    vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
    vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));

    return dot(vec4(31.316), n);
}

vec4 extractAlpha(vec3 colorIn)
{
    vec4 colorOut;
    float maxValue = min(max(max(colorIn.r, colorIn.g), colorIn.b), 1.0);
    if (maxValue > 1e-5)
    {
        colorOut.rgb = colorIn.rgb * (1.0 / maxValue);
        colorOut.a = maxValue;
    }
    else
    {
        colorOut = vec4(0.0);
    }
    return colorOut;
}

float light1(float intensity, float attenuation, float dist)
{
    return intensity / (1.0 + dist * attenuation);
}
float light2(float intensity, float attenuation, float dist)
{
    return intensity / (1.0 + dist * dist * attenuation);
}

void draw( out vec4 _FragColor, in vec2 vUv )
{
    float time  = _Speed * _GlobalTime;
    vec2 uv = vUv;
    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float v0, v1, v2, v3, cl;
    float r0, d0, n0;
    float r, d;

    // ring
    n0 = snoise3( vec3(uv * noiseScale, time * 0.5) ) * 0.5 + 0.5;
    r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
    d0 = distance(uv, r0 / len * uv);
    v0 = light1(1.0, 10.0, d0);
    v0 *= smoothstep(r0 * 1.05, r0, len);
    cl = cos(ang + time * 2.0) * 0.5 + 0.5;

    // high light
    float a = time * -1.0;
    vec2 pos = vec2(cos(a), sin(a)) * r0;
    d = distance(uv, pos);
    v1 = light2(1.5, 5.0, d);
    v1 *= light1(1.0, 50.0 , d0);

    // back decay
    v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);

    // hole
    v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

    // color
    vec3 c = mix(color1, _Color/255.0, cl);
    vec3 col = mix(color1,  _Color/255.0, cl);
    col = mix(color3, col, v0);
    col = (col + v1) * v2 * v3;
    col.rgb = clamp(col.rgb, 0.0, 1.0);

    //gl_FragColor = extractAlpha(col);
    _FragColor = extractAlpha(col);
}

void main()
{

    vec4 col;
    vec2 iuv = vec2(uv)*2.0 - vec2(1.0, 1.0);
    draw(col, iuv);

    vec3 bg = BG_COLOR;

    gl_FragColor = vec4(mix(bg, col.rgb, col.a), 1.0); //normal blend
}
`;
const particleSystemProps = {
  id       : '12',
  dataType : DataType.ParticleSystem,
  item     : { id: '01' },
  shape    : { shape: 'Sphere', radius: 1, arc: 360, arcMode: 0, type: 1, alignSpeedDirection: false },
  splits   : [[0, 0, 0.8125, 0.8125, 0]],
  options  : {
    startColor    : [8, [1, 1, 1, 1]],
    maxCount      : 99,
    startLifetime : [4, [2, 4.5]],
    startSize     : [4, [0.05, 0.2]],
    sizeAspect    : [0, 1],
  },
  renderer             : { texture: 0, side: 1028 },
  emission             : { rateOverTime: [0, 16] },
  positionOverLifetime : { startSpeed: [4, [0.5, 1]], gravityOverLifetime: [0, 1] },
  colorOverLifetime    : {
    opacity: [
      6,
      [
        [0, 0, 0, 4.323488565047734],
        [0.1569, 0.9994, -0.000008581158770600304, 0.0000019450758869311368],
        [0.72, 0.82, -0.9799974080598542, -1.099987166822864],
        [1, 0, -4.999984592567138, 0],
      ],
    ],
  },
};
const spriteProps = {
  id        : '13',
  dataType  : DataType.SpriteComponent,
  item      : { id: '03' },
  'options' : {
    'startColor': [
      1,
      1,
      1,
      1,
    ],
  },
  'renderer': {
    'renderMode' : 1,
    'texture'    : 3,
  },
  'positionOverLifetime': {
    'direction': [
      0,
      0,
      0,
    ],
    'startSpeed' : 0,
    'gravity'    : [
      0,
      0,
      0,
    ],
    'gravityOverLifetime': [
      0,
      1,
    ],
  },
  'splits': [
    [
      0,
      0,
      0.9375,
      0.52734375,
      0,
    ],
  ],
};
const json = {
  images: [
    {
      url         : 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original',
      webp        : 'https://mdn.alipayobjects.com/mars/afts/img/A*8ZhTRa_BlToAAAAAAAAAAAAADlB4AQ/original',
      renderLevel : 'B+',
    },
    {
      url         : '../src/assets/textures/trail.png',
      renderLevel : 'B+',
    },
    {
      url         : '../src/assets/textures/ge.png',
      renderLevel : 'B+',
    },
    {
      url           : 'https://mdn.alipayobjects.com/mars/afts/img/A*XrKtT5cF_58AAAAAAAAAAAAADlB4AQ/original',
      'renderLevel' : 'B+',
    },
    {
      url         : '../src/assets/textures/trail2.png',
      renderLevel : 'B+',
    },
    {
      url         : '../src/assets/textures/trail3.png',
      renderLevel : 'B+',
    },
    {
      url         : '../src/assets/textures/trail5.png',
      renderLevel : 'B+',
    },
  ],
  spines       : [],
  version      : '3.0',
  shapes       : [],
  plugins      : [],
  type         : 'mars',
  compositions : [
    {
      id          : '4',
      name        : '辐射粒子',
      duration    : 5,
      startTime   : 0,
      endBehavior : 2,
      previewSize : [0, 0],
      items       : [
        { id: '0' },
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
      ],
      camera       : { fov: 60, far: 1000, near: 0.3, clipMode: 0, position: [0, 0, 8], rotation: [0, 0, 0] },
      globalVolume : {
        usePostProcessing : true,
        useHDR            : true,
        // Bloom
        useBloom       : 1.0,
        threshold      : 1.0,
        bloomIntensity : 1.0,
        // ColorAdjustments
        brightness : 1.5,
        saturation : 1,
        contrast   : 1,
        // ToneMapping
        useToneMapping: 1,  // 1: true, 0: false
      },
    },
  ],
  items: [
    {
      'id'          : '03',
      'name'        : 'background',
      'duration'    : 1000,
      dataType      : 0,
      'type'        : '1',
      'visible'     : true,
      'endBehavior' : 2,
      'delay'       : 0,
      'renderLevel' : 'B+',
      'transform'   : {
        'position': [
          0,
          -7.285564691294531e-16,
          0,
        ],
        'rotation': [
          0,
          0,
          0,
        ],
        'scale': [
          16.24,
          7.315,
          1,
        ],
      },
      components: [{
        id : '13',
      }],
    },
    {
      id          : '01',
      name        : 'particle',
      duration    : 1000,
      dataType    : 0,
      type        : '2',
      visible     : true,
      endBehavior : 5,
      delay       : 0,
      renderLevel : 'B+',
      transform   : { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components  : [{
        id : '12',
      }],
    },
    {
      id          : '02',
      name        : 'Trail1',
      duration    : 1000,
      type        : 'ECS',
      dataType    : 0,
      visible     : true,
      endBehavior : 0,
      delay       : 0,
      renderLevel : 'B+',
      transform   : { position: [-30, 30, -200], rotation: [90, -150, 0], scale: [0.3, 0.3, 0.3] },
      components  : [{
        id : '11',
      }],
    },
    {
      id          : '04',
      name        : 'Trail2',
      duration    : 1000,
      type        : 'ECS',
      dataType    : 0,
      visible     : true,
      endBehavior : 0,
      delay       : 0,
      renderLevel : 'B+',
      transform   : { position: [20, 30, -200], rotation: [90, -150, 0], scale: [0.3, 0.3, 0.3] },
      components  : [{
        id : '14',
      }],
    },
    {
      id          : '05',
      name        : 'Trail3',
      duration    : 1000,
      type        : 'ECS',
      dataType    : 0,
      visible     : true,
      endBehavior : 0,
      delay       : 0,
      renderLevel : 'B+',
      transform   : { position: [-80, 30, -200], rotation: [90, -150, 0], scale: [0.3, 0.3, 0.3] },
      components  : [{
        id : '15',
      }],
    },
  ],
  components: [
    // 是否和Item保持一致
    {
      id        : '11',
      dataType  : 1,
      item      : { id: '02' },
      materials : [{ id: '21' }],
      geometry  : { id:geometryData.id },
    },
    particleSystemProps,
    spriteProps,
    {
      id        : '14',
      dataType  : 1,
      item      : { id: '04' },
      materials : [{ id: '22' }],
      geometry  : { id:geometryData.id },
    },
    {
      id        : '15',
      dataType  : 1,
      item      : { id: '05' },
      materials : [{ id: '23' }],
      geometry  : { id:geometryData.id },
    },
  ],
  materials: [
    {
      id       : '21',
      dataType : 2,
      shader   : { id: trailShaderData.id },
      floats   : {
      },
      vector4s: {
        _StartColor : [1.0, 0.0, 0.0, 1.0],
        _EndColor   : [1.0, 1.0, 0.2, 1.0],
      },
      textures: {
        _MainTex : { id: '1' },
        _Tex2    : { id: '2' },
        _Tex3    : { id: '4' },
      },
    },
    {
      id       : '22',
      dataType : 2,
      shader   : { id: trailShaderData.id },
      floats   : {
      },
      vector4s: {
        _StartColor : [0.0, 1.0, 0.0, 1.0],
        _EndColor   : [0.0, 0.2, 0.8, 1.0],
      },
      textures: {
        _MainTex : { id: '1' },
        _Tex2    : { id: '5' },
        _Tex3    : { id: '4' },
      },
    },
    {
      id       : '23',
      dataType : 2,
      shader   : { id: trailShaderData.id },
      floats   : {
      },
      vector4s: {
        _StartColor : [1.0, 0.0, 0.0, 1.0],
        _EndColor   : [0.0, 0.0, 0.0, 1.0],
      },
      textures: {
        _MainTex : { id: '1' },
        _Tex2    : { id: '6' },
        _Tex3    : { id: '4' },
      },
    },
  ],
  shaders: [
    trailShaderData,
  ],
  geometrys:[
    geometryData,
  ],
  requires      : [],
  compositionId : '4',
  bins          : [],
  textures      : [
    { source: 0, flipY: true },
    { source: 1, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { source: 2, flipY: false, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { source: 3, flipY: true },
    { source: 4, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { source: 5, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { source: 6, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
  ],
};

export const sceneData: SceneData = { effectsObjects: {} };

for (const item of json.items) {
  sceneData.effectsObjects[item.id] = item;
}
for (const component of json.components) {
  sceneData.effectsObjects[component.id] = component;
}
for (const material of json.materials) {
  sceneData.effectsObjects[material.id] = material;
}
for (const shader of json.shaders) {
  sceneData.effectsObjects[shader.id] = shader;
}

export default json;
