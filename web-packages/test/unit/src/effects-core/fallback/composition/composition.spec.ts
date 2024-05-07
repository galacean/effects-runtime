import { getStandardComposition } from '@galacean/effects';

const { expect } = chai;

describe('composition', () => {
  it('composition previewSize', () => {
    const composition = {
      'name': '帧动画',
      'id': 3,
      'endBehavior': 2,
      'duration': 5,
      'st': 1.2,
      'camera': {
        'fov': 60,
        'far': 20,
        'near': 0.1,
        'position': [0, 0, 8],
        'clipMode': 0,
        'z': 8,
      },
      'items': [
        {
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
            'splits': [[0.001953125, 0.001953125, 0.94140625, 0.841796875, 0],
            ],
          },
        },
      ],
      'meta': { 'previewSize': [750, 1624] },
    };
    const comp = getStandardComposition(composition);
    const previewSize = comp.previewSize;

    expect(comp.startTime).to.eql(1.2);
    expect(previewSize?.length, 'previewSize.length').to.eql(2);
    expect(previewSize?.[0]).to.eql(750, 'previewSize.width');
    expect(previewSize?.[1]).to.eql(1624, 'previewSize.height');

    const compotision2 = {
      'name': '帧动画',
      'id': 3,
      'endBehavior': 2,
      'duration': 5,
      startTime: 2.2,
      'camera': {
        'fov': 60,
        'far': 20,
        'near': 0.1,
        'position': [0, 0, 8],
        'clipMode': 0,
        'z': 8,
      },
      'items': [
        {
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
            'splits': [[0.001953125, 0.001953125, 0.94140625, 0.841796875, 0],
            ],
          },
        },
      ],
    };
    const comp2 = getStandardComposition(compotision2);

    expect(comp2.startTime).to.eql(2.2);
    expect(comp2.previewSize).to.be.undefined;
  });

});
