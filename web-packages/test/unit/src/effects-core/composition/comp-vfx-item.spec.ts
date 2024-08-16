import { Player } from '@galacean/effects';

const { expect } = chai;

describe('core/composition/comp-vfx-item', () => {
  let player: Player;

  before(() => {
    const container = document.createElement('div');

    container.style.width = '100px';
    container.style.height = '120px';
    document.body.appendChild(container);
    player = new Player({ container });
  });

  after(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  // 预合成的信息保持与引用合成中的一致
  it('get pre-composition by composition.refContent', async () => {
    const json = {
      'images': [],
      'spines': [],
      'version': '1.5',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      'compositions': [
        {
          'id': '36',
          'name': '新建合成28',
          'duration': 2,
          'startTime': 0,
          'endBehavior': 1,
          'previewSize': [
            750,
            1624,
          ],
          'items': [
            {
              'id': '1',
              'name': 'sprite_1',
              'duration': 1.5,
              'type': '1',
              'visible': true,
              'endBehavior': 0,
              'delay': 0,
              'renderLevel': 'B+',
              'content': {
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
                'sizeOverLifetime': {
                  'size': [
                    6,
                    [
                      [
                        0,
                        1,
                        0,
                        3.7036865570066797,
                      ],
                      [
                        0.18000000000000002,
                        2,
                        3.7036865570066806,
                        -4.838687276089373,
                      ],
                      [
                        0.38666666666666666,
                        0.5,
                        -4.838687276089371,
                        1.4285648148454329,
                      ],
                      [
                        0.62,
                        1,
                        1.428564814845432,
                        0,
                      ],
                    ],
                  ],
                },
              },
              'transform': {
                'position': [
                  0,
                  0,
                  0,
                ],
                'rotation': [
                  0,
                  0,
                  0,
                ],
                'scale': [
                  3.814589947968038,
                  1.267428273034541,
                  1,
                ],
              },
            },
            {
              'id': '2',
              'name': 'ref_火花',
              'duration': 5,
              'type': '7',
              'visible': true,
              'endBehavior': 0,
              'delay': 0,
              'renderLevel': 'B+',
              'content': {
                'options': {
                  'refId': '35',
                },
                'positionOverLifetime': {},
              },
              'transform': {
                'position': [
                  0,
                  0,
                  0,
                ],
                'rotation': [
                  0,
                  0,
                  0,
                ],
                'scale': [
                  1,
                  1,
                  1,
                ],
              },
            },
          ],
          'camera': {
            'fov': 60,
            'far': 40,
            'near': 0.1,
            'clipMode': 0,
            'position': [
              0,
              0,
              8,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
          },
        },
        {
          'id': '35',
          'name': '火花合成',
          'duration': 2,
          'startTime': 0,
          'endBehavior': 1,
          'previewSize': [
            750,
            1624,
          ],
          'items': [
            {
              'id': '2+17',
              'name': '欢呼粒子',
              'duration': 3,
              'type': '7',
              'visible': true,
              'endBehavior': 0,
              'delay': 0,
              'renderLevel': 'B+',
              'content': {
                'options': {
                  'refId': '37',
                },
                'positionOverLifetime': {},
              },
              'transform': {
                'position': [
                  0,
                  0,
                  0,
                ],
                'rotation': [
                  0,
                  0,
                  0,
                ],
                'scale': [
                  1,
                  1,
                  1,
                ],
              },
            },
            {
              'id': '2+16',
              'name': '火星',
              'duration': 5,
              'type': '2',
              'visible': true,
              'endBehavior': 5,
              'delay': 0,
              'renderLevel': 'B+',
              'content': {
                'shape': {
                  'shape': 'Cone',
                  'radius': 0.1,
                  'arc': 360,
                  'angle': 20,
                  'type': 2,
                  'alignSpeedDirection': false,
                },
                'options': {
                  'startColor': [
                    8,
                    [
                      1,
                      1,
                      1,
                      1,
                    ],
                  ],
                  'maxCount': 10,
                  'startLifetime': [
                    0,
                    2,
                  ],
                  'startDelay': [
                    0,
                    0,
                  ],
                  'startSize': [
                    0,
                    0.4,
                  ],
                  'sizeAspect': [
                    0,
                    1,
                  ],
                  'start3DSize': false,
                  'startRotationZ': [
                    0,
                    0,
                  ],
                  'particleFollowParent': false,
                },
                'renderer': {
                  'renderMode': 0,
                  'blending': 3,
                },
                'emission': {
                  'rateOverTime': [
                    0,
                    5,
                  ],
                },
                'positionOverLifetime': {
                  'startSpeed': [
                    4,
                    [
                      1,
                      1.2,
                    ],
                  ],
                  'gravity': [
                    0,
                    0.1,
                    0,
                  ],
                  'gravityOverLifetime': [
                    0,
                    1,
                  ],
                },
                'sizeOverLifetime': {
                  'size': [
                    6,
                    [
                      [
                        0,
                        0.5294117647058822,
                        0,
                        2.0585311937448925,
                      ],
                      [
                        0.4689655172413793,
                        1.060941176470588,
                        2.058531193744892,
                        0.0651845134046614,
                      ],
                      [
                        1,
                        1.0799999999999998,
                        0.06518451340466141,
                        0,
                      ],
                    ],
                  ],
                },
                'colorOverLifetime': {
                  'color': [
                    9,
                    [
                      [
                        0,
                        0,
                        0,
                        0,
                        0,
                      ],
                      [
                        0.14285714285714285,
                        255,
                        213,
                        99,
                        158.1,
                      ],
                      [
                        0.3116883116883117,
                        255,
                        145,
                        55,
                        255,
                      ],
                      [
                        0.7142857142857143,
                        255,
                        26,
                        21,
                        229.5,
                      ],
                      [
                        1,
                        255,
                        26,
                        0,
                        2.5500000000000003,
                      ],
                    ],
                  ],
                },
              },
              'transform': {
                'position': [
                  0,
                  0,
                  0,
                ],
                'rotation': [
                  89.99999999999999,
                  0,
                  0,
                ],
                'scale': [
                  1,
                  1,
                  1,
                ],
              },
            },

          ],
          'camera': {
            'fov': 60,
            'far': 40,
            'near': 0.1,
            'clipMode': 0,
            'position': [
              0,
              0,
              8,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
          },
        },
        {
          'id': '37',
          'name': '欢呼粒子合成',
          'duration': 2,
          'startTime': 0,
          'endBehavior': 1,
          'previewSize': [
            750,
            1624,
          ],
          'items': [
            {
              'id': '2+17+4',
              'name': 'face',
              'duration': 2,
              'type': '2',
              'visible': true,
              'endBehavior': 0,
              'delay': 0,
              'renderLevel': 'B+',
              'content': {
                'shape': {
                  'shape': 'Cone',
                  'radius': 0.6,
                  'arc': 360,
                  'arcMode': 0,
                  'angle': 33,
                  'type': 2,
                  'alignSpeedDirection': false,
                  'turbulenceX': [
                    0,
                    0,
                  ],
                  'turbulenceY': [
                    0,
                    0,
                  ],
                  'turbulenceZ': [
                    0,
                    0,
                  ],
                },
                'options': {
                  'startColor': [
                    8,
                    [
                      1,
                      1,
                      1,
                      1,
                    ],
                  ],
                  'maxCount': 100,
                  'startLifetime': [
                    4,
                    [
                      1,
                      1.4,
                    ],
                  ],
                  'startDelay': [
                    0,
                    0,
                  ],
                  'startSize': [
                    4,
                    [
                      0.2,
                      0.4,
                    ],
                  ],
                  'sizeAspect': [
                    0,
                    1,
                  ],
                  'start3DSize': false,
                  'startRotationZ': [
                    4,
                    [
                      0,
                      360,
                    ],
                  ],
                },
                'renderer': {
                  'renderMode': 1,
                },
                'emission': {
                  'rateOverTime': [
                    0,
                    0,
                  ],
                  'burstOffsets': [
                    {
                      'index': 0,
                      'x': 0,
                      'y': 0,
                      'z': 0,
                    },
                    {
                      'index': 1,
                      'x': 0,
                      'y': 0,
                      'z': 0,
                    },
                    {
                      'index': 2,
                      'x': 0,
                      'y': 0,
                      'z': 0,
                    },
                  ],
                  'bursts': [
                    {
                      'time': 0,
                      'count': 22,
                      'cycles': 1,
                      'interval': 0,
                    },
                    {
                      'time': 0.5,
                      'count': 22,
                      'cycles': 1,
                      'interval': 0,
                    },
                    {
                      'time': 1,
                      'count': 22,
                      'cycles': 1,
                      'interval': 0,
                    },
                  ],
                },
                'positionOverLifetime': {
                  'asMovement': false,
                  'speedOverLifetime': [
                    6,
                    [
                      [
                        0,
                        1,
                        0,
                        0.0000025802027067030354,
                      ],
                      [
                        0.2169,
                        0.8442,
                        -1.2999965617120517,
                        -1.2199958479986142,
                      ],
                      [
                        0.4336,
                        0.13319999999999999,
                        -0.4661963455560438,
                        -0.5118986461079996,
                      ],
                      [
                        1,
                        0,
                        0.000001016004434714001,
                        0,
                      ],
                    ],
                  ],
                  'linearY': [
                    0,
                    0,
                  ],
                  'linearX': [
                    0,
                    0,
                  ],
                  'linearZ': [
                    0,
                    0,
                  ],
                  'startSpeed': [
                    4,
                    [
                      9,
                      16,
                    ],
                  ],
                  'gravity': [
                    0,
                    -7,
                    0,
                  ],
                  'gravityOverLifetime': [
                    0,
                    1,
                  ],
                },
                'sizeOverLifetime': {
                  'size': [
                    6,
                    [
                      [
                        0,
                        0.8,
                        0,
                        2.953461002658948,
                      ],
                      [
                        0.2547,
                        1.4018,
                        2.9534610026589463,
                        0.3324149376285652,
                      ],
                      [
                        1,
                        1.6,
                        0.3324149376285653,
                        0,
                      ],
                    ],
                  ],
                },
                'rotationOverLifetime': {
                  'asRotation': false,
                  'z': [
                    4,
                    [
                      260,
                      400,
                    ],
                  ],
                },
                'colorOverLifetime': {
                  'opacity': [
                    6,
                    [
                      [
                        0,
                        0,
                        0,
                        5.65287942564971,
                      ],
                      [
                        0.1769,
                        1,
                        5.652879425649707,
                        -9.261639418603061e-12,
                      ],
                      [
                        0.8198000000000001,
                        1.000001,
                        0.000004666338567823127,
                        -5.549358326289854,
                      ],
                      [
                        1,
                        0,
                        -5.549358326289856,
                        0,
                      ],
                    ],
                  ],
                },
                'textureSheetAnimation': {
                  'col': 4,
                  'animate': false,
                  'total': 0,
                  'row': 1,
                },
              },
              'transform': {
                'position': [
                  -0.06231099026667142,
                  -4.154147151879992,
                  0,
                ],
                'rotation': [
                  89.99999999999999,
                  0,
                  0,
                ],
                'scale': [
                  1,
                  1,
                  1,
                ],
              },
            },
          ],
          'camera': {
            'fov': 60,
            'far': 40,
            'near': 0.1,
            'clipMode': 0,
            'position': [
              0,
              0,
              8,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
          },
        },
      ],
      'requires': [],
      'compositionId': '36',
      'bins': [],
      'textures': [],
    };
    const scene = await player.loadScene(json);

    player.play();
    expect(scene.refContent.length).to.eql(2);
    const comp1 = scene.refContent[0];
    const comp2 = scene.refContent[1];

    expect(comp1.name).to.eql('ref_火花');
    expect(comp2.name).to.eql('欢呼粒子');
    comp1.duration = 5;
    comp1.endBehavior = 0;
    comp2.duration = 5;
    comp2.endBehavior = 5;

  });

  it('translate by pixel', async () => {
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*3VDzQI83d9sAAAAAAAAAAAAADlB4AQ', {
      autoplay: false,
    });

    player.gotoAndStop(1);

    const sprite = comp.getItemByName('sprite_2');
    const pos = sprite?.transform.position;

    sprite?.translateByPixel(50, 60);
    expect(pos?.toArray()[0]).to.closeTo(0, 0.1);
    expect(pos?.toArray()[1]).to.closeTo(0, 0.1);
  });

  it('setPosition by pixel', async () => {
    // FIXME: 老版本数据，需要更新
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*dFfLQp7L0TsAAAAAAAAAAAAADlB4AQ', {
      autoplay: false,
    });

    player.gotoAndStop(1);

    const sprite = comp.getItemByName('sprite_1');
    const pos = sprite?.transform.position;

    const { width, height } = player.canvas.getBoundingClientRect();

    // 正中心
    sprite?.setPositionByPixel(width / 2, height / 2);
    expect(pos?.toArray()[0]).to.closeTo(0, 0.1);
    expect(pos?.toArray()[1]).to.closeTo(0, 0.1);
  });
  // 预合成设置缩放
  it('set scale in compVFXItem', async () => {
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*bkLLToY54tgAAAAAAAAAAAAADlB4AQ');

    player.gotoAndStop(0);
    const ref = comp.getItemByName('ref');

    ref?.setScale(0.1, 0.5, 2);
    player.gotoAndStop(1);
    let scale = ref?.transform.scale;

    expect(scale?.x).to.eql(0.1);
    expect(scale?.y).to.eql(0.5);
    expect(scale?.z).to.eql(2);
    ref?.scale(2, 2, 0.1);

    player.gotoAndStop(2);
    scale = ref?.transform.scale;

    expect(scale?.x).to.eql(0.2);
    expect(scale?.y).to.eql(1);
    expect(scale?.z).to.eql(0.2);
  });
});
