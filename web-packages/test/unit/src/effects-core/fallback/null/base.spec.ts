import { getStandardItem, normalizeColor, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/fallback/null/item-base', () => {
  it('duration, renderLevel, type, endBehavior, startColor', () => {
    const item = {
      'name': 'null_11',
      'id': 1,
      'parentId': 14,
      'cal': {
        'options': {
          'duration': 3,
          'startSize': 1,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',
          'endBehavior': 4,
          'startColor': ['color', [245, 166, 35, 0.5]],
        },
      },
    };
    const neo = getStandardItem(item);

    expect(neo.duration).to.eql(3, 'duration');
    expect(neo.renderLevel).to.eql('B+', 'renderLevel');
    expect(neo.type).to.eql(spec.ItemType.null, 'type');
    expect(neo.parentId).to.eql('14', 'parentId');
    expect(neo.pn, 'pn').not.exist;
    expect(neo.endBehavior).to.eql(spec.END_BEHAVIOR_FREEZE, 'endBehavior');

    const content = neo.content;

    expect(content).to.be.an('object');
    expect(content.options.startColor).to.eql(normalizeColor([245, 166, 35, 128]));

    // @ts-expect-error
    delete item.cal.options.endBehavior;

    const neo2 = getStandardItem(item);

    expect(neo2.endBehavior).to.eql(spec.END_BEHAVIOR_DESTROY, 'endBehavior');

  });

  it('static transform', () => {
    const t = { 'position': [1, 1, 1], 'rotation': [-30, 30, 30] };
    const item = {
      'name': 'null_1',
      'id': 1,
      'cal': {
        'options': {
          'duration': 3,
          'startSize': 2,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',
        },
        'transform': t,
      },
    };
    const neo = getStandardItem(item);

    expect(neo.transform?.position).to.eql(t.position);

    const r = neo.transform!.rotation!;

    expect([+r[0].toFixed(1), +r[1].toFixed(1), +r[2].toFixed(1)]).to.deep.equal([-16.1, 38.7, 16.1]);
    expect(neo.transform?.scale).to.eql([2, 2, 1]);

    // @ts-expect-error
    delete item.cal.transform;

    const neo2 = getStandardItem(item);

    expect(neo2.transform?.position).not.exist;
    expect(neo2.transform?.rotation).not.exist;
    expect(neo2.transform?.scale).to.eql([2, 2, 1]);
  });

  it('colorOverLifetime', () => {
    const opacityLine = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'cal': {
        'options': {
          'duration': 3,
          'startSize': 5,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',

        },
        'colorOverLifetime': {
          'color': ['gradient', { '0.00': 'rgba(211,27,27,1)', '1.00': 'rgba(10,28,230,0.4)' }],
          'opacity': ['lines', [[0, 0], [1, 1]]],
        },
      },
    };

    const opacityCurve = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'cal': {
        'options': {
          'duration': 3,
          'startSize': 5,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',
        },
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

  it('sizeOverLifetime', () => {
    const constantSize = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'cal': {
        'options': {
          'duration': 3,
          'startSize': 5,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',
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
      'cal': {
        'options': {
          'duration': 3,
          'startSize': 5,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',

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
      'cal': {
        'options': {
          'duration': 5,
          'startSize': 1,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',
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
    expect(positionOverLifetime.gravity, 'gravity').to.be.undefined;
    expect(positionOverLifetime.gravityOverLifetime, 'gravityOverLifetime').to.be.undefined;

  });

  it('rotateOverLifetime', () => {
    const item = {
      'name': 'null_11',
      'delay': 0,
      'id': 12,
      'cal': {
        'options': {
          'duration': 5,
          'startSize': 1,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',
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
      'cal': {
        'options': {
          'duration': 5,
          'startSize': 1,
          'sizeAspect': 1,
          'relative': true,
          'renderLevel': 'B+',
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
});

