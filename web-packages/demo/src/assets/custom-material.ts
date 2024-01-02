import { DataType, glContext, type SceneData } from '@galacean/effects';
import geometryData from './geometries/trail.geo.json';
import trailShaderData from './shaders/trail.shader.json';

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
    {
      url         : '../src/assets/textures/ge-icon.png',
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
        { id: '5' },
      ],
      camera       : { fov: 60, far: 1000, near: 0.3, clipMode: 0, position: [0, 0, 8], rotation: [0, 0, 0] },
      globalVolume : {
        usePostProcessing : true,
        useHDR            : true,
        // Bloom
        useBloom       : 1.0,
        threshold      : 0.8,
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
      id          : '03',
      name        : 'background',
      duration    : 1000,
      dataType    : 0,
      type        : '1',
      visible     : true,
      endBehavior : 2,
      delay       : 0,
      renderLevel : 'B+',
      transform   : {
        position: [
          0,
          -7.285564691294531e-16,
          0,
        ],
        rotation: [
          0,
          0,
          0,
        ],
        scale: [
          16.24,
          6.2,
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
      transform   : { position: [2, 1.5, 0], rotation: [90, -150, 0], scale: [0.03, 0.03, 0.03] },
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
      transform   : { position: [-1, 1.5, 0], rotation: [90, -150, 0], scale: [0.03, 0.03, 0.03] },
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
      transform   : { position: [-4, 1.5, 0], rotation: [90, -150, 0], scale: [0.03, 0.03, 0.03] },
      components  : [{
        id : '15',
      }],
    },
    {
      id          : '06',
      name        : 'Ge',
      duration    : 1000,
      dataType    : 0,
      type        : '1',
      visible     : true,
      endBehavior : 2,
      delay       : 0,
      renderLevel : 'B+',
      transform   : {
        position: [
          0,
          -3.85,
          0,
        ],
        rotation: [
          0,
          0,
          0,
        ],
        scale: [
          3.36,
          0.7,
          1,
        ],
      },
      components: [{
        id : '16',
      }],
    },
  ],
  components: [
    // 是否和Item保持一致
    {
      id        : '11',
      dataType  : 1,
      item      : { id: '02' },
      materials : [{ id: '22' }],
      geometry  : { id: '7e69662e964e4892ae8933f24562395b' },
    },
    particleSystemProps,
    spriteProps,
    {
      id        : '14',
      dataType  : 1,
      item      : { id: '04' },
      materials : [{ id: '21' }],
      geometry  : { id: '7e69662e964e4892ae8933f24562395b' },
    },
    {
      id        : '15',
      dataType  : 1,
      item      : { id: '05' },
      materials : [{ id: '23' }],
      geometry  : { id: '7e69662e964e4892ae8933f24562395b' },
    },
    {
      id        : '16',
      dataType  : DataType.SpriteComponent,
      item      : { id: '06' },
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
        'texture'    : 7,
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
    },
  ],
  materials: [
    {
      id       : '21',
      dataType : 2,
      shader   : { id: 'a070be488c9c424d9e91d56ec1f0a591' },
      blending: true,
      zTest: false,
      zWrite: false,
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
      shader   : { id: 'a070be488c9c424d9e91d56ec1f0a591' },
      blending: true,
      zTest: false,
      zWrite: false,
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
      shader   : { id: 'a070be488c9c424d9e91d56ec1f0a591' },
      blending: true,
      zTest: false,
      zWrite: false,
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
    trailShaderData.exportObjects[0],
  ],
  geometries:[
    geometryData.exportObjects[0],
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
    { source: 7, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
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
