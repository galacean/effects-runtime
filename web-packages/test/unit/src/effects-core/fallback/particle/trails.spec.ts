import { getStandardItem, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/fallback/particle/trials', () => {
  it('trails', () => {
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
        'trails': {
          'lifetime': ['lines', [[0, 0], [1, 1]]],
          'maxPointPerTrail': 12,
          'widthOverTrail': ['lines', [[0, 0], [1, 1]]],
          'minimumVertexDistance': 1,
          'dieWithParticles': true,
          'colorOverTrail': {
            '0%': 'rgb(0,0,0)',
            '100%': 'rgba(255,255,255,0)',
          },
          'sizeAffectsWidth': true,
          'sizeAffectsLifetime': true,
          'parentAffectsPosition': true,
          'inheritParticleColor': true,
          'transparentOcclusion': true,
          'colorOverLifetime': ['gradient', { '0.00': 'rgb(0,0,0)', '1.00': 'rgb(255,255,255)' }],
          'opacityOverLifetime': ['random', [0, 1]],
          'orderOffset': 1,
          'blending': 6,
          'texture': 1,
          'occlusion': true,
        },
        'renderer': {
          'texture': 0,
        },
      },
    };

    const neo = getStandardItem(item);
    const trail = neo.content.trails;

    expect(trail.lifetime[0]).to.eql(spec.ValueType.LINE, 'lifetime.type');
    expect(trail.lifetime[1]).to.eql([[0, 0], [1, 1]], 'lifetime.value');
    expect(trail.parentAffectsPosition).to.be.true;
    expect(trail.opacityOverLifetime[0]).to.eql(spec.ValueType.RANDOM, 'opacityOverLifetime.type');
    expect(trail.opacityOverLifetime[1]).to.eql([0, 1], 'opacityOverLifetime.value');
    expect(trail.maxPointPerTrail).to.eql(12, 'maxPointPerTrail');
    expect(trail.minimumVertexDistance).to.eql(1, 'minimumVertexDistance');
    expect(trail.dieWithParticles).to.be.true;
    expect(trail.colorOverTrail[0]).to.eql(spec.ValueType.GRADIENT_COLOR, 'colorOverTrail.type');
    expect(trail.colorOverTrail[1][0]).to.eql([0, 0, 0, 0, 255], 'colorOverTrail.value[0]');
    expect(trail.colorOverTrail[1][1]).to.eql([1, 255, 255, 255, 0], 'colorOverTrail.value[1]');
    expect(trail.colorOverLifetime[0]).to.eql(spec.ValueType.GRADIENT_COLOR, 'colorOverLifetime.type');
    expect(trail.colorOverLifetime[1][0]).to.eql([0, 0, 0, 0, 255], 'colorOverLifetime.value[0]');
    expect(trail.colorOverLifetime[1][1]).to.eql([1, 255, 255, 255, 255], 'colorOverLifetime.value[1]');
    expect(trail.sizeAffectsWidth, 'sizeAffectsWidth').to.be.true;
    expect(trail.sizeAffectsLifetime, 'sizeAffectsLifetime').to.be.true;
    expect(trail.transparentOcclusion, 'transparentOcclusion').to.be.true;
    expect(trail.inheritParticleColor, 'inheritParticleColor').to.be.true;
    expect(trail.orderOffset).to.eql(1, 'orderOffset');
    expect(trail.blending).to.eql(spec.BlendingMode.WEAK_LIGHT, 'blending');
    expect(trail.occlusion).to.be.true;
    expect(trail.texture).to.eql(1);
    expect(trail.widthOverTrail[0]).to.eql(spec.ValueType.LINE, 'widthOverTrail.type');
    expect(trail.widthOverTrail[1]).to.eql([[0, 0], [1, 1]], 'widthOverTrail.value');
  });

});
