import { getStandardItem, spec, ensureFixedNumber } from '@galacean/effects';

const { expect } = chai;

describe('camera item', () => {
  it('camera duration,delay,renderLevel,type, transform, options', () => {
    const item = {
      'name': '3DModel_1',
      'delay': 1,
      'id': 14,
      'model': {
        'options': {
          'type': 1,
          'duration': 5,
          'near': 0.2,
          'far': ['curve', [[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]],
          'fov': ['lines', [[0, 15], [1, 20]]],
          'clipMode': 1,
          'renderLevel': 'B+',
          'startSize': 0,
          'looping': false,
        },
        'transform': { 'position': [0, 0, 12], 'rotation': [10, 20, 30] },
      },
    };

    const neo = getStandardItem(item);

    expect(neo.delay).to.eql(1, 'delay');
    expect(neo.duration).to.eql(5, 'duration');
    expect(neo.renderLevel).to.eql('B+', 'renderLevel');
    expect(neo.endBehavior).to.eql(spec.EndBehavior.destroy);
    expect(neo.type).to.eql(spec.ItemType.camera);
    expect(neo.transform?.position).to.eql([0, 0, 12], 'position');
    expect(neo.transform?.rotation).to.eql([10, 20, 30], 'rotation');

    const opt = neo.content.options;
    const nearFixed = ensureFixedNumber(opt.near);
    const fovFixed = ensureFixedNumber(opt.fov);
    const farFixed = ensureFixedNumber(opt.far);

    expect(nearFixed?.[0]).to.eql(spec.ValueType.CONSTANT, 'near.type');
    expect(nearFixed?.[1]).to.eql(0.2, 'near.value');
    expect(fovFixed?.[0]).to.eql(spec.ValueType.LINE, 'fov.type');
    expect(fovFixed?.[1]).to.eql([[0, 15], [1, 20]], 'fov.value');
    expect(farFixed?.[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'far.type');
    // expect(farFixed[1]).to.eql([[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]], 'far.value');
    expect(opt.clipMode).to.eql(1);
  });

  it('camera rotationOverLifetime', () => {
    const item = {
      'name': '3DModel_1',
      'delay': 1,
      'id': 14,
      'model': {
        'options': {
          'type': 1,
          'duration': 5,
          'near': 0.2,
          'far': 20,
          'fov': 30,
          'renderLevel': 'B+',
          'startSize': 0,
          'looping': false,
        },
        'rotationOverLifetime': {
          'separateAxes': true,
          'rotateX': 2,
          'rotateY': ['curve', [[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]],
          'rotateZ': ['lines', [[0, 1], [0.5, 0], [1, 1]]],
        },
      },
    };

    const neo = getStandardItem(item);
    const rol = neo.content.rotationOverLifetime;

    expect(rol.separateAxes).to.be.true;
    expect(rol.x[0]).to.eql(spec.ValueType.CONSTANT, 'x.type');
    expect(rol.x[1]).to.eql(2, 'x.value');
    expect(rol.y[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'y.type');
    // expect(rol.y[1]).to.eql([[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]], 'y.value');
    expect(rol.z[0]).to.eql(spec.ValueType.LINE, 'z.value');
    expect(rol.z[1]).to.eql([[0, 1], [0.5, 0], [1, 1]], 'z.value');
  });

  it('camera positionOverLifetime', () => {
    const item = {
      'name': '3DModel_1',
      'delay': 1,
      'id': 14,
      'model': {
        'options': {
          'type': 1,
          'duration': 5,
          'near': 0.2,
          'far': 20,
          'fov': 30,
          'renderLevel': 'B+',
          'startSize': 0,
          'looping': false,
        },
        'velocityOverLifetime': {
          'translateX': ['lines', [[0, -1], [1, 3]]],
          'translateY': 1,
          'translateZ': ['curve', [[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]],
        },
      },
    };

    const neo = getStandardItem(item);
    const pol = neo.content.positionOverLifetime;

    expect(pol.linearX[0]).to.eql(spec.ValueType.LINE, 'linearX.type');
    expect(pol.linearX[1]).to.eql([[0, -1], [1, 3]], 'linearX.value');
    expect(pol.linearY[0]).to.eql(spec.ValueType.CONSTANT, 'linearY.type');
    expect(pol.linearY[1]).to.eql(1, 'linearY.value');
    expect(pol.linearZ[0]).to.eql(spec.ValueType.BEZIER_CURVE, 'linearZ.type');
    // expect(pol.linearZ[1]).to.eql([[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]], 'linearZ.value');
  });

  it('camera transform path linear, constant, bezier', () => {
    const getItem = (path: any) => ({
      'name': '3DModel_1',
      'delay': 1,
      'id': 14,
      'model': {
        'options': {
          'type': 1,
          'duration': 5,
          'near': 0.2,
          'far': 20,
          'fov': 30,
          'renderLevel': 'B+',
          'startSize': 0,
          'looping': false,
        },
        'transform': { path },
      },
    });
    const constantPath = [1, 1, 2];
    const linearPath = ['path', [[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, 0, 0], [1, 1, 2]]]];
    const bezierPath = ['bezier', [[[0, 0, 1, 1], [1, 1, 1, 1]], [[-1.3, 0, 0], [3, 0, 0]], [[1, 1.5, 0], [2.5, 1.2, 0]]]];
    const ct = getStandardItem(getItem(constantPath));

    expect(ct.content.positionOverLifetime.path[0]).to.eql(spec.ValueType.CONSTANT_VEC3, 'constantPath.type');
    expect(ct.content.positionOverLifetime.path[1]).to.eql([1, 1, 2], 'constantPath.value');

    const lt = getStandardItem(getItem(linearPath));

    expect(lt.content.positionOverLifetime.path[0]).to.eql(spec.ValueType.BEZIER_CURVE_PATH, 'constantPath.type');
    // expect(lt.content.positionOverLifetime.path[1]).to.eql([[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, 0, 0], [1, 1, 2]]], 'constantPath.value');

    const bt = getStandardItem(getItem(bezierPath));

    expect(bt.content.positionOverLifetime.path[0]).to.eql(spec.ValueType.BEZIER_CURVE_PATH, 'constantPath.type');
    // expect(bt.content.positionOverLifetime.path[1]).to.eql([[[0, 0, 1, 1], [1, 1, 1, 1]], [[-1.3, 0, 0], [3, 0, 0]], [[1, 1.5, 0], [2.5, 1.2, 0]]], 'constantPath.value');
  });

});

