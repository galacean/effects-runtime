import { getStandardItem, getStandardJSON, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/fallback/particle/base', () => {
  it('particle options: duration, delay, renderLevel,type,gravity, endBehavior, startRotateCurve, startSize', () => {
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 2,
          'gravity': [1, 1, 1],
          'renderLevel': 'B+',
          'startTurbulence': true,
          'turbulenceX': 45,
          'turbulenceY': ['lines', [[0, 0], [1, 30]]],
          'turbulenceZ': ['random', [0, 30]],
          'start3DRotation': true,
          'endBehavior': 4,
          'startRotation': ['curve', [[0, 360, 0, -3], [0.5, 0, 0, 0], [1, 360, 3, 0]]],
          'startRotationY': ['curve', [[0, 360, 0, -3], [0.5, 0, 0, 0], [1, 360, 3, 0]]],
        },
        'emission': { 'rateOverTime': 5 },
      },
    };
    const neo = getStandardItem(item);

    expect(neo.delay).to.eql(0.56, 'delay');
    expect(neo.duration).to.eql(2, 'duration');
    expect(neo.renderLevel).to.eql('B+', 'renderLevel');
    expect(neo.type).to.eql(spec.ItemType.particle, 'type');
    expect(neo.parentId).to.eql('5', 'parentId');
    expect(neo.pn, 'pn').not.exist;

    const content = neo.content;

    expect(content).to.be.an('object');
    expect(content.positionOverLifetime.gravityOverLifetime[0]).to.eql(spec.ValueType.CONSTANT);
    expect(content.positionOverLifetime.gravityOverLifetime[1]).to.eql(2);
    expect(content.positionOverLifetime.gravity).to.eql([1, 1, 1]);
    expect(content.emission.rateOverTime[0]).to.eql(spec.ValueType.CONSTANT, 'rateOverTime.type');
    expect(content.emission.rateOverTime[1]).to.eql(5, 'rateOverTime.value');

    const shape = content.shape;

    expect(shape.turbulenceX[0]).to.be.eql(spec.ValueType.CONSTANT, 'turbulenceX.type');
    expect(shape.turbulenceX[1]).to.be.eql(45, 'turbulenceX.value');
    expect(shape.turbulenceY[0]).to.be.eql(spec.ValueType.LINE, 'turbulenceY.type');
    expect(shape.turbulenceY[1]).to.be.eql([[0, 0], [1, 30]], 'turbulenceX.value');
    expect(shape.turbulenceZ[0]).to.be.eql(spec.ValueType.RANDOM, 'turbulenceZ.type');
    expect(shape.turbulenceZ[1]).to.be.eql([0, 30], 'turbulenceZ.value');
    expect(neo.endBehavior).to.be.eql(spec.END_BEHAVIOR_FREEZE, 'endBehavior');
    expect(content.options.startRotationZ[0]).to.be.eql(spec.ValueType.BEZIER_CURVE, 'startRotationZ.type');
    // expect(content.options.startRotationZ[1]).to.be.eql([[0, 360, 0, -3], [0.5, 0, 0, 0], [1, 360, 3, 0]], 'startRotation.value');
    expect(content.options.startRotationY[0]).to.be.eql(spec.ValueType.BEZIER_CURVE, 'startRotationY.type');
  });

  it('particle start3DRotation', () => {
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 2,
          'gravity': [1, 1, 1],
          'renderLevel': 'B+',
          'startTurbulence': true,
          'turbulenceX': 45,
          'turbulenceY': ['lines', [[0, 0], [1, 30]]],
          'turbulenceZ': ['random', [0, 30]],
          'start3DRotation': true,
          'endBehavior': 4,
          'startRotationZ': ['curve', [[0, 360, 0, -3], [0.5, 0, 0, 0], [1, 360, 3, 0]]],
          'startRotationY': ['curve', [[0, 360, 0, -3], [0.5, 0, 0, 0], [1, 360, 3, 0]]],
        },
        'emission': { 'rateOverTime': 5 },
      },
    };
    const neo = getStandardItem(item);

    expect(neo.delay).to.eql(0.56, 'delay');
    expect(neo.duration).to.eql(2, 'duration');
    expect(neo.renderLevel).to.eql('B+', 'renderLevel');
    expect(neo.type).to.eql(spec.ItemType.particle, 'type');
    expect(neo.parentId).to.eql('5', 'parentId');
    expect(neo.pn, 'pn').not.exist;
    const content = neo.content;

    expect(content).to.be.an('object');
    expect(content.positionOverLifetime.gravityOverLifetime[0]).to.eql(spec.ValueType.CONSTANT);
    expect(content.positionOverLifetime.gravityOverLifetime[1]).to.eql(2);
    expect(content.positionOverLifetime.gravity).to.eql([1, 1, 1]);
    expect(content.emission.rateOverTime[0]).to.eql(spec.ValueType.CONSTANT, 'rateOverTime.type');
    expect(content.emission.rateOverTime[1]).to.eql(5, 'rateOverTime.value');
    const shape = content.shape;

    expect(shape.turbulenceX[0]).to.be.eql(spec.ValueType.CONSTANT, 'turbulenceX.type');
    expect(shape.turbulenceX[1]).to.be.eql(45, 'turbulenceX.value');
    expect(shape.turbulenceY[0]).to.be.eql(spec.ValueType.LINE, 'turbulenceY.type');
    expect(shape.turbulenceY[1]).to.be.eql([[0, 0], [1, 30]], 'turbulenceX.value');
    expect(shape.turbulenceZ[0]).to.be.eql(spec.ValueType.RANDOM, 'turbulenceZ.type');
    expect(shape.turbulenceZ[1]).to.be.eql([0, 30], 'turbulenceZ.value');
    expect(neo.endBehavior).to.be.eql(spec.END_BEHAVIOR_FREEZE, 'endBehavior');
    expect(content.options.startRotationZ[0]).to.be.eql(spec.ValueType.BEZIER_CURVE, 'startRotation.type');
    // expect(content.options.startRotationZ[1]).to.be.eql([[0, 360, 0, -3], [0.5, 0, 0, 0], [1, 360, 3, 0]], 'startRotation.value');
    expect(content.options.startRotationY[0]).to.be.eql(spec.ValueType.BEZIER_CURVE, 'startRotation.type');
    // expect(content.options.startRotationY[1]).to.be.eql([[0, 360, 0, -3], [0.5, 0, 0, 0], [1, 360, 3, 0]], 'startRotation.value');
    expect(content.options.startSizeX).not.exist;
  });

  it('particle start3D size', () => {
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 2,
          'gravity': [1, 1, 1],
          'renderLevel': 'B+',
          'start3DSize': true,
          'startSizeX': ['lines', [[0, 0], [1, 1]]],
          'startSizeY': ['curve', [[0, 0, 1, 0], [0.3, 0.7, 1.4, 1.28], [0.63, 4.45, 1.1, 1], [1, 5, 0, 0]]],
        },
        'emission': { 'rateOverTime': 5 },
      },
    };

    const neo = getStandardItem(item);

    expect(neo.content.options.start3DSize).to.be.true;
    expect(neo.content.options.startSizeX[0]).to.eql(spec.ValueType.LINE, 'startSizeX.type');
    expect(neo.content.options.startSizeX[1]).to.eql([[0, 0], [1, 1]], 'startSizeX.value');
    expect(neo.content.options.startSizeY[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'startSizeY.type');
    // expect(neo.content.options.startSizeY[1]).to.eql([[0, 0, 1, 0], [0.3, 0.7, 1.4, 1.28], [0.63, 4.45, 1.1, 1], [1, 5, 0, 0]], 'startSizeY.value');

  });

  it('particle emitter shape', () => {
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 2,
          'gravity': [1, 1, 1],
          'renderLevel': 'B+',
        },
        'emission': { 'rateOverTime': 5 },
        'shape': {
          'shape': 'RectangleEdge', 'radius': 1, 'arc': 360, 'arcMode': 0,
        },
      },
    };
    const neo = getStandardItem(item);
    const shape = neo.content.shape;

    expect(shape.type).to.be.eql(spec.ParticleEmitterShapeType.RECTANGLE_EDGE);
    expect(shape.radius).to.be.eql(1);
  });

  it('particle emission params', () => {
    const item = {
      'name': 'item_5',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 6,
          'burstOffsets': [{
            'index': 0, 'x': '1', 'y': '1', 'z': '1',
          }],
          'bursts': [{
            'time': '0.5', 'count': '5', 'cycles': '1', 'interval': '0.1',
          }],
        },
        'shape': {
          'shape': 'Sphere', 'radius': 1, 'arc': 360, 'arcMode': 0,
        },
      },
    };

    const neo = getStandardItem(item);
    const emission = neo.content.emission;

    expect(emission.rateOverTime[0]).to.eql(spec.ValueType.CONSTANT, 'rateOverTime.type');
    expect(emission.rateOverTime[1]).to.eql(6, 'rateOverTime.value');
    expect(emission.bursts).to.be.an('array');
    expect(emission.bursts[0].time).to.be.eql(0.5, 'time');
    expect(emission.bursts[0].count).to.be.eql(5, 'count');
    expect(emission.bursts[0].cycles).to.be.eql(1, 'cycles');
    expect(emission.bursts[0].interval).to.be.eql(0.1, 'interval');

    expect(emission.burstOffsets).to.be.an('array');
    expect(emission.burstOffsets[0].index).to.be.eql(0, 'index');
    expect(emission.burstOffsets[0].x).to.be.eql(1, 'x');
    expect(emission.burstOffsets[0].y).to.be.eql(1, 'y');
    expect(emission.burstOffsets[0].z).to.be.eql(1, 'z');
  });

  it('particle emitter static transform', () => {
    const item = {
      'name': 'item_2',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 2,
          'renderLevel': 'B+',
        },
        'emission': { 'rateOverTime': 5 },
        'shape': {
          'shape': 'Sphere', 'radius': 1, 'arc': 360, 'arcMode': 0,
        },
        'transform': { 'position': [1, 2, 1], 'rotation': [90, 77, 20] },
      },
    };
    const neo = getStandardItem(item);
    const transform = neo.transform;

    expect(neo.transform?.position).to.eql(transform?.position, 'position');

    const r = neo.transform!.rotation!;

    expect([+r[0].toFixed(1), +r[1].toFixed(1), +r[2].toFixed(1)]).to.deep.equal([90.0, -20.0, 77.0]);
    // @ts-expect-error
    delete item.particle.transform;
    const neo2 = getStandardItem(item);

    expect(neo2.transform?.position, 'position').not.exist;
    expect(neo2.transform?.rotation, 'rotation').not.exist;

    const oldParticle = {
      'compositionId': 11,
      'requires': [],
      'compositions': [
        {
          'name': '桃花',
          'id': 11,
          'duration': 15,
          'camera': {
            'fov': 60,
            'far': 20,
            'near': 2,
            'position': [
              0,
              0,
              8,
            ],
            'clipMode': 0,
            'z': 8,
          },
          'items': [
            {
              'name': 'item_4',
              'delay': 0,
              'id': 19,
              'ro': 0.1,
              'particle': {
                'options': {
                  'startLifetime': [
                    'random',
                    [
                      3,
                      4,
                    ],
                  ],
                  'startSize': [
                    'random',
                    [
                      0.3,
                      0.4,
                    ],
                  ],
                  'startSpeed': [
                    'random',
                    [
                      1.8,
                      2.2,
                    ],
                  ],
                  'startColor': [
                    'color',
                    [
                      255,
                      255,
                      255,
                    ],
                  ],
                  'duration': 10,
                  'maxCount': 200,
                  'gravityModifier': 1,
                  'start3DSize': false,
                  'gravity': [
                    0,
                    -0.2,
                    0,
                  ],
                  'renderLevel': 'B+',
                },
                'emission': {
                  'rateOverTime': 30,
                },
                'shape': {
                  'shape': 'Rectangle',
                  'radius': 2,
                  'arc': 360,
                  'arcMode': 0,
                  'angle': 10,
                  'width': 12,
                  'height': 12,
                },
                'renderer': {
                  'texture': 0,
                },
                'transform': {
                  'rotation': [
                    90,
                    30,
                    20,
                  ],
                },
              },
            },
          ],
          'meta': {
            'previewSize': [
              0,
              0,
            ],
          },
        },
      ],
      'gltf': [],
      'images': [
        'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/RXJVVGVKNJAW/-105869846-e926c.png',
      ],
      'version': '0.1.47',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      '_imgs': {
        '11': [
          0,
        ],
      },
      'imageTags': [
        'B+',
      ],
    };
    const res = getStandardJSON(oldParticle);
    const pt = res.items.find(item => item.id === res.compositions[0].items[0].id);
    const r2 = pt!.transform!.eulerHint;

    expect([+r2.x.toFixed(1), +r2.y.toFixed(1), +r2.z.toFixed(1)]).to.eql([-90.0, -20.0, 30.0], 'oldParticle rotation');
  });

  it('particle emitter transform path linear, constant, bezier', () => {
    const linearPath = ['path', [[[0, 0, 1, 1], [1, 1, 1, 1]], [[-2, -2, -5], [1, 2, 0]]]];
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 2,
          'renderLevel': 'B+',
        },
        'emission': { 'rateOverTime': 5 },
        'shape': {
          'shape': 'Sphere', 'radius': 1, 'arc': 360, 'arcMode': 0,
        },
        'transform': {
          'path': linearPath,
        },
      },
    };
    const neo = getStandardItem(item);
    const p = neo.content.emitterTransform.path;

    expect(p[0]).to.be.eql(spec.ValueType.BEZIER_CURVE_PATH, 'path type');
    // expect(p[1]).to.be.eql([[[0, 0, 1, 1], [1, 1, 1, 1]], [[-2, -2, -5], [1, 2, 0]]], 'path value');

    const item2 = {
      'name': 'item_2',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 2,
          'renderLevel': 'B+',
        },
        'emission': { 'rateOverTime': 5 },
        'shape': {
          'shape': 'Sphere', 'radius': 1, 'arc': 360, 'arcMode': 0,
        },
        'transform': {
          'path': [1, 1, 1],
        },
      },
    };
    const neo2 = getStandardItem(item2);
    const p2 = neo2.content.emitterTransform.path;

    expect(p2[0]).to.be.eql(spec.ValueType.CONSTANT_VEC3, 'path type');
    expect(p2[1]).to.be.eql([1, 1, 1], 'path value');

    const bezierPath = ['bezier', [[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, 0, -0.1], [3, 0, -0]], [[0.1, 1, -0], [2, 1, 0]]]];
    const item3 = {
      'name': 'item_2',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'maxCount': 10,
          'gravityModifier': 2,
          'renderLevel': 'B+',
        },
        'emission': { 'rateOverTime': 5 },
        'shape': {
          'shape': 'Sphere', 'radius': 1, 'arc': 360, 'arcMode': 0,
        },
        'transform': {
          'path': bezierPath,
        },
      },
    };

    const neo3 = getStandardItem(item3);
    const p3 = neo3.content.emitterTransform.path;

    expect(p3[0]).to.be.eql(spec.ValueType.BEZIER_CURVE_PATH, 'path type');
    // expect(p3[1]).to.be.eql([[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, 0, -0.1], [3, 0, -0]], [[0.1, 1, -0], [2, 1, 0]]], 'path value');

  });

  it('particle renderer', () => {
    const item = {
      'name': 'item_11',
      'delay': 0,
      'id': 11,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 0.75,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': { 'rateOverTime': 5 },
        'renderer': {
          'renderMode': 1,
          'particleOrigin': 4,
          'blending': 5,
          'texture': 2,
          'order': 1,
          'occlusion': true,
          'transparentOcclusion': true,
          'maskMode': 2,
          'side': 1028,
        },
      },
    };

    const neo = getStandardItem(item);
    const renderer = neo.content.renderer;

    expect(renderer.renderMode).to.eql(spec.RenderMode.MESH, 'renderMode');
    expect(renderer.particleOrigin).to.eql(spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_TOP, 'ParticleOrigin');
    expect(renderer.blending).to.eql(spec.BlendingMode.STRONG_LIGHT, 'blending');
    expect(renderer.texture, 'texture').to.eql(2);
    expect(renderer.occlusion, 'occlusion').to.be.true;
    expect(renderer.transparentOcclusion, 'transparentOcclusion').to.be.true;
    expect(renderer.maskMode).to.eql(spec.MaskMode.OBSCURED, 'maskMode');
    expect(renderer.side).to.eql(spec.SideMode.FRONT, 'side');
  });

  it('particle colorOverLifetime', () => {
    const opacityLine = {
      'name': 'item_1',
      'delay': 0,
      'id': 12,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 0.75,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': { 'rateOverTime': 5 },
        'colorOverLifetime': {
          'color': ['gradient', { '0.00': 'rgba(211,27,27,1)', '1.00': 'rgba(10,28,230,0.4)' }],
          'opacity': ['lines', [[0, 0], [1, 1]]],
        },
      },
    };

    const opacityCurve = {
      'name': 'item_1',
      'delay': 0,
      'id': 12,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 0.75,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': { 'rateOverTime': 5 },
        'colorOverLifetime': {
          'opacity': ['curve', [[0, 100, 0, -3], [0.5, 0, 0, 0], [1, 100, 3, 0]]],
        },
      },
    };

    const neo1 = getStandardItem(opacityLine);

    expect(neo1.content.colorOverLifetime.opacity[0]).to.eql(spec.ValueType.LINE, 'opacity.type');
    expect(neo1.content.colorOverLifetime.opacity[1]).to.eql([[0, 0], [1, 1]], 'opacity.value');
    expect(neo1.content.colorOverLifetime.color[0]).to.eql(spec.ValueType.GRADIENT_COLOR, 'colorGradient.type');
    expect(neo1.content.colorOverLifetime.color[1][0]).to.eql([0, 211, 27, 27, 255], 'colorGradient.value');
    expect(neo1.content.colorOverLifetime.color[1][1]).to.eql([1, 10, 28, 230, 102], 'colorGradient.value');

    const neo2 = getStandardItem(opacityCurve);

    expect(neo2.content.colorOverLifetime.opacity[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'opacity.type');
    // expect(neo2.content.colorOverLifetime.opacity[1]).to.eql([[0, 100, 0, -3], [0.5, 0, 0, 0], [1, 100, 3, 0]], 'opacity.value');
  });

  it('particle sizeOverLifetime', () => {
    const constantSize = {
      'name': 'item_12',
      'delay': 0,
      'id': 12,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'shape': {
          'shape': 'Sphere',
          'radius': 1,
          'arc': 360,
          'arcMode': 0,
        },
        'sizeOverLifetime': {
          'separateAxes': false,
          'size': 10,
        },
      },
    };
    const sizeSeparate = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'shape': {
          'shape': 'Sphere',
          'radius': 1,
          'arc': 360,
          'arcMode': 0,
        },
        'sizeOverLifetime': {
          'separateAxes': true,
          'size': 10,
          'x': ['lines', [[0, 0], [0.25, 0.5], [0.75, 0.5], [1, 1]]],
          'y': ['random', [1, 2]],
        },
      },
    };

    const neo1 = getStandardItem(constantSize);
    const sizeOverLifetime1 = neo1.content.sizeOverLifetime;

    expect(sizeOverLifetime1.size[0]).to.eql(spec.ValueType.CONSTANT, 'size.type');
    expect(sizeOverLifetime1.size[1]).to.eql(10, 'size.value');
    expect(sizeOverLifetime1.separateAxes, 'separateAxes').to.be.undefined;
    expect(sizeOverLifetime1.x, 'x').to.be.undefined;
    expect(sizeOverLifetime1.y, 'y').to.be.undefined;
    expect(sizeOverLifetime1.z, 'z').to.be.undefined;

    const neo2 = getStandardItem(sizeSeparate);
    const sizeOverLifetime2 = neo2.content.sizeOverLifetime;

    expect(sizeOverLifetime2.separateAxes, 'separateAxes').to.be.true;
    expect(sizeOverLifetime2.size, 'size').to.be.undefined;
    expect(sizeOverLifetime2.x[0]).to.eql(spec.ValueType.LINE, 'sizeX.type');
    expect(sizeOverLifetime2.x[1]).to.eql([[0, 0], [0.25, 0.5], [0.75, 0.5], [1, 1]], 'sizeX.value');
    expect(sizeOverLifetime2.y[0]).to.eql(spec.ValueType.RANDOM, 'sizeY.type');
    expect(sizeOverLifetime2.y[1]).to.eql([1, 2], 'sizeY.value');

  });

  it('particle rotateOverLifetime', () => {
    const item = {
      'name': 'item_12',
      'delay': 0,
      'id': 12,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'shape': {
          'shape': 'Sphere',
          'radius': 1,
          'arc': 360,
          'arcMode': 0,
        },
        'rotationOverLifetime': {
          'asRotation': true,
          'angularVelocity': ['random', [0, 180]],
        },
      },
    };

    const neo = getStandardItem(item);
    const rot = neo.content.rotationOverLifetime;

    expect(rot.asRotation, 'asRotation').to.be.true;
    expect(rot.separateAxes, 'separateAxes').to.be.undefined;
    expect(rot.z[0]).eql(spec.ValueType.RANDOM, 'angularVelocity.type');
    expect(rot.z[1]).eql([0, 180], 'angularVelocity.value');

    const separateItem = {
      'name': 'item_12',
      'delay': 0,
      'id': 12,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'shape': {
          'shape': 'Sphere',
          'radius': 1,
          'arc': 360,
          'arcMode': 0,
        },
        'rotationOverLifetime': {
          'asRotation': true,
          'angularVelocity': ['random', [0, 180]],
          'separateAxes': true,
          'x': 30,
          'y': ['lines', [[0, 0], [1, 360]]],
          'z': ['curve', [[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]],
        },
      },
    };

    const neo2 = getStandardItem(separateItem);
    const rot2 = neo2.content.rotationOverLifetime;

    expect(rot2.asRotation, 'asRotation').to.be.true;
    expect(rot2.separateAxes, 'separateAxes').to.be.true;
    expect(rot2.x[0]).eql(spec.ValueType.CONSTANT, 'x.type');
    expect(rot2.x[1]).eql(30, 'x.value');
    expect(rot2.y[0]).eql(spec.ValueType.LINE, 'y.type');
    expect(rot2.y[1]).eql([[0, 0], [1, 360]], 'y.value');
    expect(rot2.z[0]).eql(spec.ValueType.BEZIER_CURVE, 'z.type');
    // expect(rot2.z[1]).eql([[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]], 'z.value');
  });

  it('velocityOverLifetime', () => {
    const item = {
      'name': 'item_12',
      'delay': 0,
      'id': 12,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': ['random', [0, 1]],
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'renderer': {
          'texture': 0,
        },
        'velocityOverLifetime': {
          'asMovement': true,
          'linearX': 1,
          'linearY': ['random', [0, 1]],
          'linearZ': ['curve', [[0, 0, 1, 0], [0.3, 0.14, 1.4, 1.28], [0.63, 0.89, 1.1, 1], [1, 1, 0, 0]]],
          'asRotation': true,
          'orbitalX': 30,
          'orbitalY': ['lines', [[0, 0], [1, 1]]],
          'orbitalZ': ['random', [0, 90]],
          'orbCenter': [1, 1, 1],
          'speedOverLifetime': 4,
          'forceTarget': true,
          'target': [2, 2, 10],
          'forceCurve': ['curve', [[0, 1, 0, 0], [0.72, 0.82, -0.98, -1.1], [1, 0, -5, 7]]],
        },
      },
    };

    const neo = getStandardItem(item);
    const positionOverLifetime = neo.content.positionOverLifetime;

    expect(positionOverLifetime.asMovement, 'asMovement').to.be.true;
    expect(positionOverLifetime.linearX[0]).to.eql(spec.ValueType.CONSTANT, 'linearX.type');
    expect(positionOverLifetime.linearX[1]).to.eql(1, 'linearX.value');
    expect(positionOverLifetime.linearY[0]).to.eql(spec.ValueType.RANDOM, 'linearY.type');
    expect(positionOverLifetime.linearY[1]).to.eql([0, 1], 'linearY.value');
    expect(positionOverLifetime.linearZ[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'linearZ.type');
    // expect(positionOverLifetime.linearZ[1]).to.eql([[0, 0, 1, 0], [0.3, 0.14, 1.4, 1.28], [0.63, 0.89, 1.1, 1], [1, 1, 0, 0]], 'linearZ.value');
    expect(positionOverLifetime.asRotation, 'asRotation').to.be.true;
    expect(positionOverLifetime.orbitalX[0]).to.eql(spec.ValueType.CONSTANT, 'orbitalX.type');
    expect(positionOverLifetime.orbitalX[1]).to.eql(30, 'orbitalX.value');
    expect(positionOverLifetime.orbitalY[0]).to.eql(spec.ValueType.LINE, 'orbitalY.type');
    expect(positionOverLifetime.orbitalY[1]).to.eql([[0, 0], [1, 1]], 'orbitalY.value');
    expect(positionOverLifetime.orbitalZ[0]).to.eql(spec.ValueType.RANDOM, 'orbitalZ.type');
    expect(positionOverLifetime.orbitalZ[1]).to.eql([0, 90], 'orbitalZ.value');
    expect(positionOverLifetime.speedOverLifetime[0]).to.eql(spec.ValueType.CONSTANT, 'speedOverLifetime.type');
    expect(positionOverLifetime.speedOverLifetime[1]).to.eql(4, 'speedOverLifetime.value');
    expect(positionOverLifetime.forceTarget).to.be.true;
    expect(positionOverLifetime.forceCurve[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'forceCurve.type');
    // expect(positionOverLifetime.forceCurve[1]).to.eql([[0, 1, 0, 0], [0.72, 0.82, -0.98, -1.1], [1, 0, -5, 7]], 'forceCurve.value');
    expect(positionOverLifetime.startSpeed[0]).to.eql(spec.ValueType.RANDOM, 'startSpeed.type');
    expect(positionOverLifetime.startSpeed[1]).to.eql([0, 1], 'startSpeed.value');

    const emptySpeed = {
      'name': 'item_12',
      'delay': 0,
      'id': 12,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': ['random', [0, 1]],
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'renderer': {
          'texture': 0,
        },
        'velocityOverLifetime': {
          'asMovement': true,
          'speedOverLifetime': 0,
        },
      },
    };
    const neo2 = getStandardItem(emptySpeed);
    const positionOverLifetime2 = neo2.content.positionOverLifetime;

    expect(positionOverLifetime2.speedOverLifetime).to.not.exist;
  });

  it('interaction', () => {
    const item = {
      'name': 'item_12',
      'delay': 0,
      'id': 12,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': ['random', [0, 1]],
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'renderer': {
          'texture': 0,
        },
        'interaction': {
          'radius': 0.5,
          'behavior': 1,
          'multiple': true,
        },
      },
    };

    const neo = getStandardItem(item);

    expect(neo.content.interaction, 'interaction').to.be.an('object');
    expect(neo.content.interaction.behavior).to.eql(spec.ParticleInteractionBehavior.removeParticle, 'ParticleInteractionBehavior');
    expect(neo.content.interaction.multiple).to.be.true;
    expect(neo.content.interaction.radius).to.eql(0.5);
  });

  it('textureSheetAnimation', () => {
    const item = {
      'name': 'item_12',
      'delay': 0,
      'id': 12,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': ['random', [0, 1]],
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'shape': {
          'shape': 'Sphere',
          'radius': 1,
          'arc': 360,
          'arcMode': 0,
        },
        'renderer': {
          'texture': 0,
        },
        'textureSheetAnimation': {
          'animate': true,
          'col': 2,
          'row': 3,
          'total': 4,
          'animationDuration': 10,
          'animationDelay': 2,
          'cycles': ['curve', [[0, 10, 0, -3], [0.5, 0, 0, 0], [1, 10, 3, 0]]],
        },
      },
    };

    const neo = getStandardItem(item);
    const tsa = neo.content.textureSheetAnimation;

    expect(tsa.row).to.eql(3, 'row');
    expect(tsa.col).to.eql(2, 'col');
    expect(tsa.total).to.eql(4, 'total');
    expect(tsa.animate, 'animate').to.be.true;
    expect(tsa.animationDuration[0]).to.eql(spec.ValueType.CONSTANT, 'animationDuration.type');
    expect(tsa.animationDuration[1]).to.eql(10, 'animationDuration.value');
    expect(tsa.cycles[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'cycles.type');
    // expect(tsa.cycles[1]).to.eql([[0, 10, 0, -3], [0.5, 0, 0, 0], [1, 10, 3, 0]], 'cycles.value');
    expect(tsa.animationDelay[0]).to.eql(spec.ValueType.CONSTANT, 'animationDelay.type');
    expect(tsa.animationDelay[1]).to.eql(2, 'animationDelay.value');

    const randomAnimation = {
      'name': 'item_12',
      'delay': 0,
      'id': 12,
      'ro': 0.1,
      'particle': {
        'options': {
          'startLifetime': 1.2,
          'startSize': 0.2,
          'sizeAspect': 1,
          'startSpeed': ['random', [0, 1]],
          'startColor': ['color', [255, 255, 255]],
          'duration': 5,
          'maxCount': 10,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'emission': {
          'rateOverTime': 5,
        },
        'shape': {
          'shape': 'Sphere',
          'radius': 1,
          'arc': 360,
          'arcMode': 0,
        },
        'renderer': {
          'texture': 0,
        },
        'textureSheetAnimation': {
          'animate': true,
          'col': 2,
          'row': 3,
          'total': 4,
          'animationDuration': ['random', [2, 8]],
          'animationDelay': ['random', [0.5, 1]],
          'cycles': ['curve', [[0, 10, 0, -3], [0.5, 0, 0, 0], [1, 10, 3, 0]]],
        },
      },
    };
    const neo2 = getStandardItem(randomAnimation);
    const tsa2 = neo2.content.textureSheetAnimation;

    expect(tsa2.animationDelay[0]).to.eql(spec.ValueType.CONSTANT, 'animationDelay.type');
    expect(tsa2.animationDelay[1]).to.eql(0.5, 'animationDelay.value');
    expect(tsa2.animationDuration[0]).to.eql(spec.ValueType.CONSTANT, 'animationDelay.type');
    expect(tsa2.animationDuration[1]).to.eql(2, 'animationDelay.value');
  });
});
