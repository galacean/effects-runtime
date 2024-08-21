import { getStandardItem, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/fallback/sprite/base', () => {
  it('sprite duration,delay,renderLevel,type', () => {
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        }, 'renderer': { 'renderMode': 1 },
      },
    };
    const neo = getStandardItem(item);

    expect(neo.delay).to.eql(0.56, 'delay');
    expect(neo.duration).to.eql(2, 'duration');
    expect(neo.renderLevel).to.eql('B+', 'renderLevel');
    expect(neo.transform?.scale).to.deep.equal([1.2, 1.2, 1], 'transform.scale');
    expect(neo.type).to.eql(spec.ItemType.sprite, 'type');
    expect(neo.content).to.be.an('object');
    expect(neo.content.options.startColor).to.deep.equal([1, 1, 1, 1], 'startColor');
    expect(neo.parentId).to.eql('5', 'parentId');
    expect(neo.pn, 'pn').not.exist;
  });

  it('sprite anchor', () => {
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        }, 'renderer': { 'renderMode': 1, anchor: [1, 0] },
      },
    };
    const requires: string[] = [];
    const neo = getStandardItem(item, { requires });

    expect(neo.content.renderer.anchor).to.deep.equals([1, 0]);
    expect(requires).to.deep.equals(['anchor']);
  });

  it('sprite delete anchor', () => {
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'parentId': '5',
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        }, 'renderer': { 'renderMode': 1, anchor: [0.5, 0.5] },
      },
    };
    const requires: string[] = [];
    const neo = getStandardItem(item, { requires });

    expect(neo.content.renderer.anchor).to.not.exist;
    expect(requires).to.deep.equals([]);
  });
  it('sprite endBehavior', () => {
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        }, 'renderer': { 'renderMode': 1 },
      },
    };
    const neo = getStandardItem(item);

    expect(neo.type).to.eql(spec.ItemType.sprite, 'type');
    expect(neo.endBehavior).to.eql(spec.EndBehavior.destroy, 'end');
    expect(neo.parentId).not.exist;
    const item2 = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'looping': true,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        }, 'renderer': { 'renderMode': 1 },
      },
    };
    const neo2 = getStandardItem(item2);

    expect(neo2.type).to.eql(spec.ItemType.sprite, 'type 2');
    expect(neo2.endBehavior).to.eql(spec.EndBehavior.restart, 'end 2');
    const item3 = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'endBehavior': 4,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        }, 'renderer': { 'renderMode': 1 },
      },
    };
    const neo3 = getStandardItem(item3);

    expect(neo3.type).to.eql(spec.ItemType.sprite, 'type 3');
    expect(neo3.endBehavior).to.eql(spec.EndBehavior.freeze, 'end 3');
  });

  it('sprite static transform', () => {
    const t = { 'position': [-2, 1, 2], 'rotation': [20, 10, 30] };
    const item = {
      'name': 'item_1',
      'delay': 0.56,
      'id': 1,
      'ro': 0.1,
      'sprite': {
        transform: t,
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 0.5,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        }, 'renderer': { 'renderMode': 1 },
      },
    };
    const neo = getStandardItem(item);

    expect(neo.transform?.position).to.deep.equal(t.position);
    const r = neo.transform!.rotation!;

    expect([+r[0].toFixed(1), +r[1].toFixed(1), +r[2].toFixed(1)]).to.deep.equal([22.2, -1.7, 31.4]);
    expect(neo.transform?.scale).to.deep.equal([1.2, 2.4, 1]);

    // @ts-expect-error
    delete item.sprite.transform;
    const neo2 = getStandardItem(item);

    expect(neo2.transform?.position).not.exist;
    expect(neo2.transform?.rotation).not.exist;
    expect(neo2.transform?.scale).to.deep.equal([1.2, 2.4, 1]);
  });

  it('colorOverLifetime', () => {
    const opacityLine = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'renderer': {
          'renderMode': 1,
        },
        'colorOverLifetime': {
          'color': ['gradient', {
            '0.00': 'rgba(229,12,12,1)',
            '0.5': 'rgba(44,229,12,1)',
            '1.00': 'rgba(79,29,201,1)',
          }],
          'opacity': ['lines', [[0, 1], [0.5, 0], [1, 1]]],
        },
      },
    };

    const opacityCurve = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'renderer': {
          'renderMode': 1,
        },
        'colorOverLifetime': {
          'color': ['gradient', {
            '0.00': 'rgba(229,12,12,1)',
            '0.5': 'rgba(44,229,12,1)',
            '1.00': 'rgba(79,29,201,1)',
          }],
          'opacity': ['curve', [[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]],
        },
      },
    };

    const gradientColor = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'renderer': {
          'renderMode': 1,
        },
        'colorOverLifetime': {
          'color': { '0.00': 'rgba(229,12,12,1)', '0.5': 'rgba(44,229,12,1)', '1.00': 'rgba(79,29,201,1)' },
          'opacity': ['lines', [[0, 1], [0.5, 0], [1, 1]]],
        },
      },
    };

    const neo1 = getStandardItem(opacityLine);

    expect(neo1.content.colorOverLifetime.opacity[0]).to.eql(spec.ValueType.LINE, 'opacity.type');
    expect(neo1.content.colorOverLifetime.opacity[1]).to.eql([[0, 1], [0.5, 0], [1, 1]], 'opacity.value');
    expect(neo1.content.colorOverLifetime.color[0]).to.eql(spec.ValueType.GRADIENT_COLOR, 'colorGradient.type');
    expect(neo1.content.colorOverLifetime.color[1][0]).to.eql([0, 229, 12, 12, 255], 'colorGradient.value');
    expect(neo1.content.colorOverLifetime.color[1][1]).to.eql([0.5, 44, 229, 12, 255], 'colorGradient.value');
    expect(neo1.content.colorOverLifetime.color[1][2]).to.eql([1, 79, 29, 201, 255], 'colorGradient.value');

    const neo2 = getStandardItem(opacityCurve);

    expect(neo2.content.colorOverLifetime.opacity[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'opacity.type');
    // expect(neo2.content.colorOverLifetime.opacity[1]).to.eql([[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]], 'opacity.value');

    const neo3 = getStandardItem(gradientColor);

    expect(neo3.content.colorOverLifetime.color[0]).to.eql(spec.ValueType.GRADIENT_COLOR, 'colorGradient.type');
    expect(neo3.content.colorOverLifetime.color[1][0]).to.eql([0, 229, 12, 12, 255], 'colorGradient.value');
    expect(neo3.content.colorOverLifetime.color[1][1]).to.eql([0.5, 44, 229, 12, 255], 'colorGradient.value');
    expect(neo3.content.colorOverLifetime.color[1][2]).to.eql([1, 79, 29, 201, 255], 'colorGradient.value');

  });

  it('sizeOverLifetime', () => {
    const constantSize = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'renderer': {
          'renderMode': 1,
        },
        'sizeOverLifetime': {
          'size': 3,
        },
      },
    };
    const sizeSeparate = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 1,
          'renderLevel': 'B+',
        },
        'renderer': {
          'renderMode': 1,
        },
        'sizeOverLifetime': {
          'separateAxes': true,
          'x': ['lines', [[0, 0], [1, 10]]],
          'y': 2,
          'z': ['curve', [[0, 0, 1, 0], [0.73, 0.24, 1, 1.1], [1, 1, 5, 1]]],
        },
      },
    };

    const neo1 = getStandardItem(constantSize);

    expect(neo1.content.sizeOverLifetime.size[0]).to.eql(spec.ValueType.CONSTANT, 'size.type');
    expect(neo1.content.sizeOverLifetime.size[1]).to.eql(3, 'size.value');
    expect(neo1.content.sizeOverLifetime.separateAxes, 'separateAxes').to.be.undefined;
    expect(neo1.content.sizeOverLifetime.x, 'x').to.be.undefined;
    expect(neo1.content.sizeOverLifetime.y, 'y').to.be.undefined;
    expect(neo1.content.sizeOverLifetime.z, 'z').to.be.undefined;
    const neo2 = getStandardItem(sizeSeparate);

    expect(neo2.content.sizeOverLifetime.separateAxes, 'separateAxes').to.be.true;
    expect(neo2.content.sizeOverLifetime.size, 'size').to.be.undefined;
    expect(neo2.content.sizeOverLifetime.x[0]).to.eql(spec.ValueType.LINE, 'sizeX.type');
    expect(neo2.content.sizeOverLifetime.x[1]).to.eql([[0, 0], [1, 10]], 'sizeX.value');
    expect(neo2.content.sizeOverLifetime.y[0]).to.eql(spec.ValueType.CONSTANT, 'sizeY.type');
    expect(neo2.content.sizeOverLifetime.y[1]).to.eql(2, 'sizeY.value');
    expect(neo2.content.sizeOverLifetime.z[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'sizeZ.type');
    // expect(neo2.content.sizeOverLifetime.z[1]).to.eql([[0, 0, 1, 0], [0.73, 0.24, 1, 1.1], [1, 1, 5, 1]], 'sizeZ.value');
  });

  it('velocityOverLifetime', () => {
    const item = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravity': [0, -10, 0],
          'gravityModifier': ['lines', [[0, 0], [0.5, 1], [1, 0]]],
          'renderLevel': 'B+',
        },
        'renderer': {
          'renderMode': 1,
        },
        'velocityOverLifetime': {
          'asMovement': false,
          'linearX': 2,
          'linearY': ['lines', [[0, 0], [0.25, 5], [0.75, 5], [1, 0]]],
          'linearZ': ['curve', [[0, 1, 0, 0], [0.35, 0.85, -1.3, -1.22], [0.56, 0.16, -1, -1.2], [1, 0, 0, 0]]],
          'asRotation': true,
          'orbitalX': 30,
          'orbitalY': ['lines', [[0, 180], [0.25, 90], [0.75, 90], [1, 0]]],
          'orbitalZ': ['curve', [[0, 30, 0, -2], [0.2, 15.6, -0.8, -0.7], [0.82, 12.6, -0.57, -0.55], [1, 0, -4.9, 1]]],
          'speedOverLifetime': 10,
        },
      },
    };

    const neo = getStandardItem(item);
    const positionOverLifetime = neo.content.positionOverLifetime;

    expect(positionOverLifetime.asMovement, 'asMovement').to.be.false;
    expect(positionOverLifetime.linearX[0]).to.eql(spec.ValueType.CONSTANT, 'linearX.type');
    expect(positionOverLifetime.linearX[1]).to.eql(2, 'linearX.value');
    expect(positionOverLifetime.linearY[0]).to.eql(spec.ValueType.LINE, 'linearY.type');
    expect(positionOverLifetime.linearY[1]).to.eql([[0, 0], [0.25, 5], [0.75, 5], [1, 0]], 'linearY.value');
    expect(positionOverLifetime.linearZ[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'linearZ.type');
    // expect(positionOverLifetime.linearZ[1]).to.eql([[0, 1, 0, 0], [0.35, 0.85, -1.3, -1.22], [0.56, 0.16, -1, -1.2], [1, 0, 0, 0]], 'linearZ.value');
    expect(positionOverLifetime.asRotation, 'asRotate').to.be.true;
    expect(positionOverLifetime.orbitalX[0]).to.eql(spec.ValueType.CONSTANT, 'orbitalX.type');
    expect(positionOverLifetime.orbitalX[1]).to.eql(30, 'orbitalX.value');
    expect(positionOverLifetime.orbitalY[0]).to.eql(spec.ValueType.LINE, 'orbitalY.type');
    expect(positionOverLifetime.orbitalY[1]).to.eql([[0, 180], [0.25, 90], [0.75, 90], [1, 0]], 'orbitalY.value');
    expect(positionOverLifetime.orbitalZ[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'orbitalZ.type');
    // expect(positionOverLifetime.orbitalZ[1]).to.eql([[0, 30, 0, -2], [0.2, 15.6, -0.8, -0.7], [0.82, 12.6, -0.57, -0.55], [1, 0, -4.9, 1]], 'orbitalZ.value');
    expect(positionOverLifetime.speedOverLifetime[0]).to.eql(spec.ValueType.CONSTANT, 'speedOverLifetime.type');
    expect(positionOverLifetime.speedOverLifetime[1]).to.eql(10, 'speedOverLifetime.value');
    expect(positionOverLifetime.startSpeed, 'startSpeed').to.be.undefined;
    expect(positionOverLifetime.gravity).to.eql([0, -10, 0], 'gravity');
    expect(positionOverLifetime.gravityOverLifetime[0]).to.eql(spec.ValueType.LINE, 'gravityOverLifetime.type');
    expect(positionOverLifetime.gravityOverLifetime[1]).to.eql([[0, 0], [0.5, 1], [1, 0]], 'gravityOverLifetime.value');
  });

  it('rotateOverLifetime', () => {
    const item = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravity': [0, -10, 0],
          'gravityModifier': ['lines', [[0, 0], [0.5, 1], [1, 0]]],
          'renderLevel': 'B+',
        },
        'renderer': {
          'renderMode': 1,
        },
        'rotationOverLifetime': {
          'asRotation': true,
          'angularVelocity': ['curve', [[0, 0, 1, 6], [0.17, 0.54, 0.72, 0.72], [0.78, 0.7, 1, 1], [1, 1, 1, 1]]],
        },
      },
    };

    const neo = getStandardItem(item);
    const rot = neo.content.rotationOverLifetime;

    expect(rot.asRotation, 'asRotation').to.be.true;
    expect(rot.separateAxes, 'separateAxes').to.be.undefined;
    expect(rot.z[0]).eql(spec.ValueType.BEZIER_CURVE, 'angularVelocity.type');
    // expect(rot.z[1]).eql([[0, 0, 1, 6], [0.17, 0.54, 0.72, 0.72], [0.78, 0.7, 1, 1], [1, 1, 1, 1]], 'angularVelocity.value');

    const separateItem = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 1.2,
          'sizeAspect': 1,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravity': [0, -10, 0],
          'gravityModifier': ['lines', [[0, 0], [0.5, 1], [1, 0]]],
          'renderLevel': 'B+',
        },
        'renderer': {
          'renderMode': 1,
        },
        'rotationOverLifetime': {
          'asRotation': true,
          'angularVelocity': ['curve', [[0, 0, 1, 6], [0.17, 0.54, 0.72, 0.72], [0.78, 0.7, 1, 1], [1, 1, 1, 1]]],
          'separateAxes': true,
          'x': 10,
          'y': ['lines', [[0, 1], [0.25, 0], [0.75, 0], [1, 1]]],
          'z': ['curve', [[0, 1, 0, 0], [0.72, 0.82, -0.98, -1.1], [1, 0, -5, 7]]],
        },
      },
    };

    const neo2 = getStandardItem(separateItem);
    const rot2 = neo2.content.rotationOverLifetime;

    expect(rot2.asRotation, 'asRotation').to.be.true;
    expect(rot2.separateAxes, 'separateAxes').to.be.true;
    expect(rot2.x[0]).eql(spec.ValueType.CONSTANT, 'x.type');
    expect(rot2.x[1]).eql(10, 'x.value');
    expect(rot2.y[0]).eql(spec.ValueType.LINE, 'y.type');
    expect(rot2.y[1]).eql([[0, 1], [0.25, 0], [0.75, 0], [1, 1]], 'y.value');
    expect(rot2.z[0]).eql(spec.ValueType.BEZIER_CURVE, 'z.type');
    // expect(rot2.z[1]).eql([[0, 1, 0, 0], [0.72, 0.82, -0.98, -1.1], [1, 0, -5, 7]], 'z.value');
  });

  it('sprite textureSheetAnimation', () => {
    const item = {
      'name': '日历逐帧',
      'delay': 0,
      'id': 15,
      'ro': 0.01,
      'sprite': {
        'options': {
          'startLifetime': 5,
          'startSize': 2,
          'startSpeed': 0,
          'startColor': ['color', [255, 255, 255]],
          'duration': 1,
          'maxCount': 1,
          'gravityModifier': 1,
          'startSizeX': 3.5,
          'startSizeY': 3.5,
          'endBehavior': 4,
          'sizeAspect': 1,
          'looping': false,
          'renderLevel': 'B+',
        },
        'renderer': {
          'texture': 0,
          'occlusion': false,
          'order': 1,
          'renderMode': 1,
        },
        'textureSheetAnimation': {
          'col': 8,
          'row': 8,
          'animate': true,
          'cycles': 0,
          'blend': false,
          'animationDuration': 2,
          'animationDelay': 0,
          'total': 59,
        },
      },
    };

    const neo = getStandardItem(item);
    const tsa = neo.content.textureSheetAnimation;

    expect(tsa.row).to.eql(8, 'row');
    expect(tsa.col).to.eql(8, 'col');
    expect(tsa.total).to.eql(59, 'total');
    expect(tsa.animate, 'animate').to.be.true;
  });

  it('splits', () => {
    const item = {
      'name': 'earth',
      'delay': 0,
      'id': 12,
      'ro': 0.01,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 6,
          'sizeAspect': 1.1183294663573087,
          'startColor': ['color', [255, 255, 255]],
          'duration': 2,
          'gravityModifier': 0,
          'endBehavior': 4,
          'renderLevel': 'B+',
        },
        'renderer': {
          'texture': 1,
          'order': 0,
        },
        'transform': {
          'position': [0.022863817233533368, -0.021775064031936076, -2.5],
        },
        'splits': [[0.001953125, 0.001953125, 0.94140625, 0.841796875, 0]],
      },
    };

    const neo = getStandardItem(item);
    const split = neo.content.splits;

    split.forEach((sp: string[]) => {
      expect(sp.length).to.eql(5);
      expect(sp[0], 'sx').to.be.an('number');
      expect(sp[1], 'sy').to.be.an('number');
      expect(sp[2], 'width').to.be.an('number');
      expect(sp[3], 'height').to.be.an('number');
      expect(sp[4], 'flip').to.be.oneOf([0, 1]);
    });

  });

  it('options startRotation', () => {
    const item = {
      'name': 'earth',
      'delay': 0,
      'id': 12,
      'ro': 0.01,
      'sprite': {
        'options': {
          'startLifetime': 2,
          'startSize': 6,
          'sizeAspect': 1.1183294663573087,
          'startColor': ['color', [255, 255, 255]],
          startRotation: 30,
          'duration': 2,
          'gravityModifier': 0,
          'endBehavior': 4,
          'renderLevel': 'B+',
        },
        'renderer': {
          'texture': 1,
          'order': 0,
        },
        'transform': {
          rotation: [0, 0, 10],
        },
      },
    };

    const neo = getStandardItem(item);

    expect(neo.transform?.rotation?.[0]).to.closeTo(0, 0.0001);
    expect(neo.transform?.rotation?.[1]).to.closeTo(0, 0.0001);
    expect(neo.transform?.rotation?.[2]).to.closeTo(40, 0.0001);
    // @ts-expect-error
    delete item.sprite.transform;

    const rr = getStandardItem(item);

    expect(rr.transform?.rotation?.[0]).to.closeTo(0, 0.0001);
    expect(rr.transform?.rotation?.[1]).to.closeTo(0, 0.0001);
    expect(rr.transform?.rotation?.[2]).to.closeTo(30, 0.0001);
  });
});
