import type { SceneData, Composition, VFXItem, SpriteComponent } from '@galacean/effects';
import { DataType, Deserializer, EffectComponent, Player, glContext } from '@galacean/effects';
import { compatibleCalculateItem } from './common/utils';
import trail from './assets/shaders/Trail.fs.glsl';

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
  // gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos.x*5.5,aPos.y*3.5,aPos.z*3.5,1.0);
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
  id: '12',
  dataType: DataType.ParticleSystem,
  item: { id: '01' },
  shape: { shape: 'Sphere', radius: 1, arc: 360, arcMode: 0, type: 1, alignSpeedDirection: false },
  splits: [[0, 0, 0.8125, 0.8125, 0]],
  options: {
    startColor: [8, [1, 1, 1, 1]],
    maxCount: 99,
    startLifetime: [4, [2, 4.5]],
    startSize: [4, [0.05, 0.2]],
    sizeAspect: [0, 1],
  },
  renderer: { texture: 0, side: 1028 },
  emission: { rateOverTime: [0, 16] },
  positionOverLifetime: { startSpeed: [4, [0.5, 1]], gravityOverLifetime: [0, 1] },
  colorOverLifetime: {
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
  id:'13',
  dataType: DataType.SpriteComponent,
  item:{ id:'03' },
  'options': {
    'startColor': [
      1,
      1,
      1,
      1,
    ],
  },
  'renderer': {
    'renderMode': 1,
    'texture': 3,
  },
  'positionOverLifetime': {
    'direction': [
      0,
      0,
      0,
    ],
    'startSpeed': 0,
    'gravity': [
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
      url: 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original',
      webp: 'https://mdn.alipayobjects.com/mars/afts/img/A*8ZhTRa_BlToAAAAAAAAAAAAADlB4AQ/original',
      renderLevel: 'B+',
    },
    {
      url: '../src/assets/textures/Trail.png',
      renderLevel: 'B+',
    },
    {
      url: '../src/assets/textures/Ge.png',
      renderLevel: 'B+',
    },
    {
      url: 'https://mdn.alipayobjects.com/mars/afts/img/A*XrKtT5cF_58AAAAAAAAAAAAADlB4AQ/original',
      'renderLevel': 'B+',
    },
  ],
  spines: [],
  version: '3.0',
  shapes: [],
  plugins: [],
  type: 'mars',
  compositions: [
    {
      id: '4',
      name: '辐射粒子',
      duration: 5,
      startTime: 0,
      endBehavior: 2,
      previewSize: [0, 0],
      items: [
        { id: '0' },
        { id: '1' },
        { id: '2' },
      ],
      camera: { fov: 60, far: 1000, near: 0.3, clipMode: 0, position: [0, 0, 8], rotation: [0, 0, 0] },
      globalVolume:{
        usePostProcessing: true,
        useHDR: true,
        // Bloom
        useBloom: 1.0,
        threshold: 1.0,
        bloomIntensity: 1.0,
        // ColorAdjustments
        brightness: 1.5,
        saturation: 1,
        contrast: 1,
        // ToneMapping
        useToneMapping: 1, // 1: true, 0: false
      },
    },
  ],
  items: [
    {
      'id': '03',
      'name': 'background',
      'duration': 1000,
      dataType: 0,
      'type': '1',
      'visible': true,
      'endBehavior': 2,
      'delay': 0,
      'renderLevel': 'B+',
      content: spriteProps,
      'transform': {
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
          9.289619008007278,
          5.225410692004094,
          1,
        ],
      },
      components: [{
        id: '13',
      }],
    },
    {
      id: '01',
      name: 'particle',
      duration: 1000,
      dataType: 0,
      type: '2',
      visible: true,
      endBehavior: 5,
      delay: 0,
      renderLevel: 'B+',
      content: particleSystemProps,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [{
        id: '12',
      }],
    },
    {
      id: '02',
      name: 'sprite_5',
      duration: 1000,
      type: 'ECS',
      dataType: 0,
      visible: true,
      endBehavior: 0,
      delay: 0,
      renderLevel: 'B+',
      transform: { position: [-30, 30, -200], rotation: [90, -150, 0], scale: [0.3, 0.3, 0.3] },
      components: [{
        id: '11',
      }],
    },
  ],
  components: [
    // 是否和Item保持一致
    {
      id: '11',
      dataType: 1,
      item: { id: '02' },
      materials: [{ id: '21' }],
    },
    particleSystemProps,
    spriteProps,
  ],
  materials: [
    {
      id: '21',
      dataType: 2,
      shader: { id: '31' },
      floats: {
        _MaxIntensity: 5.5,
        _WaveZoom: 12,
      },
      ints: {
      },
      vector4s: {
        _StartColor:[1.0, 0.2, 0.2, 1.0],
        _EndColor:[1.0, 1.0, 0.2, 1.0],
      },
      vector3s: {
      },
      textures:{
        _MainTex:{ id:1 },
        _MainTex2:{ id:2 },
      },
    },
  ],
  shaders: [
    {
      id: '31',
      dataType: 3,
      vertex: vert,
      fragment: trail,
    },
  ],
  requires: [],
  compositionId: '4',
  bins: [],
  textures: [
    { source: 0, flipY: true },
    { source: 1, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { source: 2, flipY: false, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { source: 3, flipY: true },
  ],
};
const sceneData: SceneData = { effectsObjects: {} };

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

const container = document.getElementById('J-container');

let composition: Composition;
let deserializer: Deserializer;
let testVfxItem: VFXItem<SpriteComponent>;

//@ts-expect-error
let gui;

// const properties = `
// _2D("2D", 2D) = "" {}
// _Color("Color",Color) = (1,1,1,1)
// _Value("Value",Range(0,10)) = 2.5
// _Float("Float",Float) = 0
// _Vector("Vector",Vector) = (0,0,0,0)
// _Rect("Rect",Rect) = "" {}
// _Cube("Cube",Cube) = "" {}
// `;

function parseMaterialProperties (shaderProperties: string, gui: any) {

  //@ts-expect-error
  json.materials[0].floats = {};
  const lines = shaderProperties.split('\n');

  for (const property of lines) {
    // 提取材质属性信息
    // 如 “_Float1("Float2", Float) = 0”
    // 提取出 “_Float1” “Float2” “Float” “0”
    const regex = /\s*(.+?)\s*\(\s*"(.+?)"\s*,\s*(.+?)\s*\)\s*=\s*(.+)\s*/;
    const matchResults = property.match(regex);

    if (!matchResults) {
      return;
    }
    const uniformName = matchResults[1];
    const inspectorName = matchResults[2];
    const type = matchResults[3];
    const value = matchResults[4];

    // 提取 Range(a, b) 的 a 和 b
    const match = type.match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);

    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);

      //@ts-expect-error
      json.materials[0].floats[uniformName] = Number(value);
      gui.add(json.materials[0].floats, uniformName, start, end).onChange(() => {
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    } else if (type === 'Float') {
      //@ts-expect-error
      json.materials[0].floats[uniformName] = Number(value);
      gui.add(json.materials[0].floats, uniformName).onChange(() => {
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    } else if (type === 'Color') {
      const Color: Record<string, number[]> = {};

      Color[uniformName] = [0, 0, 0, 0];
      gui.addColor(Color, uniformName).onChange((value: number[]) => {
        //@ts-expect-error
        json.materials[0].vector4s[uniformName] = [value[0] / 255, value[1] / 255, value[2] / 255, value[3] / 255];
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    }
  }
}

(async () => {
  try {
    const player = createMarsPlayer();
    //@ts-expect-error
    const comp = await player.loadScene(json, {
      // variables:{
      //   'BottleImg': 'https://mdn.alipayobjects.com/graph_jupiter/afts/img/A*CqZeT5ie2K4AAAAAAAAAAAAADsF2AQ/original',
      //   'funQuiz': 'https://mdn.alipayobjects.com/huamei_uu41p1/afts/img/A*HElIQJgy4YIAAAAAAAAAAAAADhyWAQ/original',
      // },
      // pendingCompile: true
    });

    compatibleCalculateItem(comp);
    comp.handleEnd = composition => {
      console.info(composition);
    };

    player.play();

    composition = comp;
    deserializer = new Deserializer(composition.getEngine());
    testVfxItem = composition.getItemByName('sprite_5') as VFXItem<any>;
    // testVfxItem.fromData(deserializer, json.vfxItems['1'], ecsSceneJsonDemo);
    // composition.content.items.push(testVfxItem);
    // composition.content.rootItems.push(testVfxItem);
    setGUI();
    // testVfxItem.fromData(deserializer, ecsSceneJsonDemo.vfxItems['1'], ecsSceneJsonDemo);
    // testVfxItem.start();
    // testVfxItem.composition = composition;
  } catch (e) {
    console.error('biz', e);
  }
})();

function createMarsPlayer () {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    interactive: true,
    renderFramework: 'webgl',
    env: 'editor',
    onPausedByItem: data => {
      console.info('onPausedByItem', data);
    },
    onItemClicked: ({ name }) => {
      console.info(`item ${name} has been clicked`);
    },
    // reportGPUTime: console.debug,
  });

  return player;
}

// dat gui 参数及修改
function setDatGUI (materialProperties: string) {
  //@ts-expect-error
  if (gui) {
    gui.destroy();
  }
  //@ts-expect-error
  gui = new dat.GUI();
  const materialGUI = gui.addFolder('Material');

  parseMaterialProperties(materialProperties, gui);
  materialGUI.open();
}

function setGUI () {
  const vsInput = document.getElementById('vs-input') as HTMLTextAreaElement;
  const fsInput = document.getElementById('fs-input') as HTMLTextAreaElement;
  const propertiesInput = document.getElementById('properties-input') as HTMLTextAreaElement;
  const compileButton = document.getElementById('compile-button') as HTMLButtonElement;

  vsInput.value = json.shaders[0].vertex;
  fsInput.value = json.shaders[0].fragment;
  propertiesInput.value = `_StartColor("Color",Color) = (1,1,1,1)
_EndColor("Color",Color) = (1,1,1,1)`;

  // compileButton.addEventListener('click', () => {
  //   json.shaders[0].vertex = vsInput.value;
  //   json.shaders[0].fragment = fsInput.value;
  //   setDatGUI(propertiesInput.value);
  //   testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0], deserializer, sceneData);
  // });
  setDatGUI(propertiesInput.value);
}