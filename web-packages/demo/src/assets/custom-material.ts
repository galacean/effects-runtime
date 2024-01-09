import { DataType, glContext, type SceneData } from '@galacean/effects';
import geometryData from './geometries/trail.geo.json';
import trailShaderData from './shaders/trail.shader.json';

const particleSystemProps = {
  id       : '8264d22a44124050b5a2d3dc476875fa',
  dataType : DataType.ParticleSystem,
  item     : { id: '9dbf4c91c5394f1dbe08010c9ed2f1a1' },
  shape    : { shape: 'Sphere', radius: 1, arc: 360, arcMode: 0, type: 1, alignSpeedDirection: false },
  splits   : [[0, 0, 0.8125, 0.8125, 0]],
  options  : {
    startColor    : [8, [1, 1, 1, 1]],
    maxCount      : 99,
    startLifetime : [4, [2, 4.5]],
    startSize     : [4, [0.05, 0.2]],
    sizeAspect    : [0, 1],
  },
  renderer             : { texture: { id:'c8e75e0b46a44b9ca6e9c98b9b461f37' }, side: 1028 },
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
  id        : '333faa0ad3974003a5e13a6d433d8bc7',
  dataType  : DataType.SpriteComponent,
  item      : { id: '2f29a793b96a47a692239e8c858a0a33' },
  options : {
    startColor: [
      1,
      1,
      1,
      1,
    ],
  },
  renderer: {
    renderMode : 1,
    texture    : { id:'83f7b031365f481192873e908fd442a6' },
  },
  positionOverLifetime: {
    direction: [
      0,
      0,
      0,
    ],
    startSpeed : 0,
    gravity    : [
      0,
      0,
      0,
    ],
    gravityOverLifetime: [
      0,
      1,
    ],
  },
  splits: [
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
      renderLevel : 'B+',
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
        { id: '2f29a793b96a47a692239e8c858a0a33' },
        { id: '9dbf4c91c5394f1dbe08010c9ed2f1a1' },
        { id: 'e412b3bcf7ee4019ab882a41aec9efdf' },
        { id: '9830e941be074b6da820819eee0e884d' },
        { id: '90d16d7487674f08aaf398aca5f91b0e' },
        { id: '6b668d8ea2ef4965ad90d0a57446b8d8' },
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
      id          : '2f29a793b96a47a692239e8c858a0a33',
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
        id : '333faa0ad3974003a5e13a6d433d8bc7',
      }],
    },
    {
      id          : '9dbf4c91c5394f1dbe08010c9ed2f1a1',
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
        id : '8264d22a44124050b5a2d3dc476875fa',
      }],
    },
    {
      id          : 'e412b3bcf7ee4019ab882a41aec9efdf',
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
        id : 'a5f8d715a06b4acba79b891566de8754',
      }],
    },
    {
      id          : '9830e941be074b6da820819eee0e884d',
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
        id : '7cb4f4f2a0994941ab535552ac774237',
      }],
    },
    {
      id          : '90d16d7487674f08aaf398aca5f91b0e',
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
        id : '24b05ca55c0f4f1a86f97699ba907099',
      }],
    },
    {
      id          : '6b668d8ea2ef4965ad90d0a57446b8d8',
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
        id : 'bcc377b9ec064a7fb110033e805ef462',
      }],
    },
  ],
  components: [
    // 是否和Item保持一致
    {
      id        : 'a5f8d715a06b4acba79b891566de8754',
      dataType  : 1,
      item      : { id: 'e412b3bcf7ee4019ab882a41aec9efdf' },
      materials : [{ id: '11f66680df4d4665884d16de06a52216' }],
      geometry  : { id: '7e69662e964e4892ae8933f24562395b' },
    },
    particleSystemProps,
    spriteProps,
    {
      id        : '7cb4f4f2a0994941ab535552ac774237',
      dataType  : 1,
      item      : { id: '9830e941be074b6da820819eee0e884d' },
      materials : [{ id: '378d35e08fee497f901b70f1144a5f6d' }],
      geometry  : { id: '7e69662e964e4892ae8933f24562395b' },
    },
    {
      id        : '24b05ca55c0f4f1a86f97699ba907099',
      dataType  : 1,
      item      : { id: '90d16d7487674f08aaf398aca5f91b0e' },
      materials : [{ id: '992e087df9154793a34b66658f4be1ca' }],
      geometry  : { id: '7e69662e964e4892ae8933f24562395b' },
    },
    {
      id        : 'bcc377b9ec064a7fb110033e805ef462',
      dataType  : DataType.SpriteComponent,
      item      : { id: '6b668d8ea2ef4965ad90d0a57446b8d8' },
      options : {
        startColor: [
          1,
          1,
          1,
          1,
        ],
      },
      renderer: {
        renderMode : 1,
        texture    : { id:'82d245433af641d48d670bace307a9fe' },
      },
      positionOverLifetime: {
        direction: [
          0,
          0,
          0,
        ],
        startSpeed : 0,
        gravity    : [
          0,
          0,
          0,
        ],
        gravityOverLifetime: [
          0,
          1,
        ],
      },
    },
  ],
  materials: [
    {
      id       : '378d35e08fee497f901b70f1144a5f6d',
      dataType : 2,
      shader   : { id: 'a070be488c9c424d9e91d56ec1f0a591' },
      blending: true,
      zTest: false,
      zWrite: false,
      floats   : {
        _Speed : 1,
      },
      vector4s: {
        _StartColor : [1.0, 0.0, 0.0, 1.0],
        _EndColor   : [1.0, 1.0, 0.2, 1.0],
      },
      textures: {
        _MainTex : { id: '0622cbce2a724bec976e09988f192ee9' },
        _Tex2    : { id: '05d2cdc5814b412aa69b1a5e794aeca8' },
        _Tex3    : { id: '080f94ebcff64c81a67f31187015697e' },
      },
    },
    {
      id       : '11f66680df4d4665884d16de06a52216',
      dataType : 2,
      shader   : { id: 'a070be488c9c424d9e91d56ec1f0a591' },
      blending: true,
      zTest: false,
      zWrite: false,
      floats   : {
        _Speed : 1,
      },
      vector4s: {
        _StartColor : [0.0, 1.0, 0.0, 1.0],
        _EndColor   : [0.0, 0.2, 0.8, 1.0],
      },
      textures: {
        _MainTex : { id: '0622cbce2a724bec976e09988f192ee9' },
        _Tex2    : { id: '69c42f62abcb4962803df425a65b7281' },
        _Tex3    : { id: '080f94ebcff64c81a67f31187015697e' },
      },
    },
    {
      id       : '992e087df9154793a34b66658f4be1ca',
      dataType : 2,
      shader   : { id: 'a070be488c9c424d9e91d56ec1f0a591' },
      blending: true,
      zTest: false,
      zWrite: false,
      floats   : {
        _Speed : 1,
      },
      vector4s: {
        _StartColor : [1.0, 0.0, 0.0, 1.0],
        _EndColor   : [0.0, 0.0, 0.0, 1.0],
      },
      textures: {
        _MainTex : { id: '0622cbce2a724bec976e09988f192ee9' },
        _Tex2    : { id: '8f33267d4f8647acbc51f34d2fe1a428' },
        _Tex3    : { id: '080f94ebcff64c81a67f31187015697e' },
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
    { id: 'c8e75e0b46a44b9ca6e9c98b9b461f37', source: 0, flipY: true },
    { id: '0622cbce2a724bec976e09988f192ee9', source: 1, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { id: '05d2cdc5814b412aa69b1a5e794aeca8', source: 2, flipY: false, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { id: '83f7b031365f481192873e908fd442a6', source: 3, flipY: true },
    { id: '080f94ebcff64c81a67f31187015697e', source: 4, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { id: '69c42f62abcb4962803df425a65b7281', source: 5, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { id: '8f33267d4f8647acbc51f34d2fe1a428', source: 6, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
    { id: '82d245433af641d48d670bace307a9fe', source: 7, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT },
  ],
};

export default json;
