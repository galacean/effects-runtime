// @ts-nocheck
import { Player, BezierSegments, CameraController, CurveValue, PathSegments, spec, math } from '@galacean/effects';

const { Vector3 } = math;
const { expect } = chai;

describe('camera item', () => {
  let player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('camera options, type', async () => {
    const items = [{
      'name': 'camera',
      'delay': 0,
      'id': 11,
      'model': {
        'options': {
          'type': 1,
          'duration': 5,
          'near': 0.6,
          'far': 25,
          'fov': 60,
          'renderLevel': 'B+',
          'looping': true,
        },
        'transform': {
          'position': [10, 2, 12],
          'rotation': [10, 60, 30],
        },
      },
    }];
    const comp = await player.loadScene(generateScene(items));

    player.gotoAndStop(0.1);
    const { near, fov, far, position, rotation } = comp.camera;
    const item = comp.getItemByName('camera');

    expect(item.type).to.eql(spec.ItemType.camera, 'type');
    const cf = item.content;

    expect(cf).to.be.an.instanceof(CameraController);
    expect(near).to.eql(0.6);
    expect(fov).to.eql(60);
    expect(far).to.eql(25);
    expect([+(position.x.toFixed(0)), +(position.y.toFixed(0)), +(position.z.toFixed(0))]).to.eql([10, 2, 12]);
    expect([+(rotation.x.toFixed(0)), +(rotation.y.toFixed(0)), +(rotation.z.toFixed(0))]).to.eql([10, 60, 30]);
  });

  it('camera positionOverLifetime', async () => {
    const items = [
      {
        'name': '3DModel_10',
        'delay': 0,
        'id': 11,
        'model': {
          'options': {
            'type': 1,
            'duration': 5,
            'near': 0.2,
            'far': 25,
            'fov': 60,
            'renderLevel': 'B+',
            'looping': true,
          },
          'transform': {
            'position': [0, 0, 0],
            'rotation': [0, 0, 0],
          },
          'velocityOverLifetime': {
            'translateX': 2,
            'translateY': ['lines', [[0, 0], [1, 1]]],
            'translateZ': ['curve', [[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]],
          },
        },
      },
    ];
    const comp = await player.loadScene(generateScene(items));

    player.gotoAndStop(2.5);
    const pos = comp.camera.position;

    expect(pos).to.deep.equals(new Vector3(2, 0.5, 0));
    const z = new CurveValue([[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]);

    expect(pos.z).to.eql(z.getValue(0.5));
  });

  it('camera rotationOverLifetime', async () => {
    const items = [{
      'name': 'camera',
      'delay': 0,
      'id': 11,
      'model': {
        'options': {
          'type': 1,
          'duration': 5,
          'near': 0.6,
          'far': 25,
          'fov': 60,
          'renderLevel': 'B+',
          'looping': true,
        },
        'transform': {
          'position': [0, 0, 8],
          'rotation': [0, 0, 0],
        },
        'rotationOverLifetime': {
          'rotation': 10,
        },
      },
    }];
    const comp = await player.loadScene(generateScene(items));

    player.gotoAndStop(2.5);
    const ro = comp.camera.rotation;

    expect(new Float32Array(ro.toArray())).to.deep.equals(new Float32Array([10, 10, 10]));
    const separate = [{
      'name': 'separate',
      'delay': 0,
      'id': 11,
      'model': {
        'options': {
          'type': 1,
          'duration': 5,
          'near': 0.6,
          'far': 25,
          'fov': 60,
          'renderLevel': 'B+',
          'looping': true,
        },
        'transform': {
          'position': [0, 0, 8],
          'rotation': [0, 0, 0],
        },
        'rotationOverLifetime': {
          'rotation': 10,
          'separateAxes': true,
          'rotateX': 2,
          'rotateY': ['lines', [[0, 1], [0.5, 0], [1, 1]]],
          'rotateZ': ['curve', [[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]],
        },
      },
    }];
    const comp2 = await player.loadScene(generateScene(separate));

    player.gotoAndStop(2.5);
    const ro2 = comp2.camera.rotation;

    expect(ro2.x).to.closeTo(2, 0.0001);
    expect(ro2.y).to.closeTo(0, 0.0001);
    const z = new CurveValue([[0, 1, 0, -3], [0.5, 0, 0, 0], [1, 1, 3, 0]]);

    expect(ro2.z).to.closeTo(z.getValue(0.5), 0.00001);
  });

  it('camera position with path', async () => {
    const items = [
      {
        'name': 'constant',
        'delay': 0,
        'id': 11,
        'model': {
          'options': {
            'type': 1,
            'duration': 5,
            'near': 0.2,
            'far': 25,
            'fov': 60,
            'renderLevel': 'B+',
            'looping': true,
          },
          'transform': {
            'position': [0, 0, 0],
            'rotation': [0, 0, 0],
            'path': [1, 1, 1],
          },
        },
      },
    ];
    const comp = await player.loadScene(generateScene(items));

    player.gotoAndStop(2.5);
    const pos = comp.camera.position;

    expect(pos.x).to.eql(1, 'constant path');
    expect(pos.y).to.eql(1, 'constant path');
    expect(pos.z).to.eql(1, 'constant path');

    const linear = [
      {
        'name': 'linear',
        'delay': 0,
        'id': 11,
        'model': {
          'options': {
            'type': 1,
            'duration': 5,
            'near': 0.2,
            'far': 25,
            'fov': 60,
            'renderLevel': 'B+',
            'looping': true,
          },
          'transform': {
            'position': [0, 0, 0],
            'rotation': [0, 0, 0],
            'path': ['path', [[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, 0, 0], [1, 1, 1]]]],
          },
        },
      },
    ];

    const comp1 = await player.loadScene(generateScene(linear));

    player.gotoAndStop(2.5);
    const pos1 = comp1.camera.position;
    const val = new PathSegments([[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, 0, 0], [1, 1, 1]]]).getValue(0.5);

    expect(pos1.x).to.eql(val[0], 'linear path');
    expect(pos1.y).to.eql(val[1], 'linear path');
    expect(pos1.z).to.eql(val[2], 'linear path');

    const curve = [
      {
        'name': 'curve',
        'delay': 0,
        'id': 11,
        'model': {
          'options': {
            'type': 1,
            'duration': 5,
            'near': 0.2,
            'far': 25,
            'fov': 60,
            'renderLevel': 'B+',
            'looping': true,
          },
          'transform': {
            'position': [0, 0, 0],
            'rotation': [0, 0, 0],
            'path': ['bezier', [[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, 0, 0], [3, 1, 0]], [[1, 1, 0], [2, 1, 0]]]],
          },
        },
      }];

    const comp2 = await player.loadScene(generateScene(curve));

    player.gotoAndStop(2.5);
    const pos2 = comp2.camera.position;
    const val2 = new BezierSegments([[[0, 0, 1, 1], [1, 1, 1, 1]], [[0, 0, 0], [3, 1, 0]], [[1, 1, 0], [2, 1, 0]]]).getValue(0.5);

    expect(pos2.x).to.eql(val2[0], 'bezier path');
    expect(pos2.y).to.eql(val2[1], 'bezier path');
    expect(pos2.z).to.eql(val2[2], 'bezier path');
  });

  it('camera 2D item affected by parent', async () => {
    const json = {
      'images': [],
      'spines': [],
      'version': '1.5',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      'compositions': [
        {
          'id': '13',
          'name': '新建合成10',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 1,
          'previewSize': [
            750,
            1624,
          ],
          'items': [
            {
              'id': '2',
              'name': 'camera_2',
              'duration': 5,
              'type': '6',
              'parentId': '3',
              'visible': true,
              'endBehavior': 0,
              'delay': 1,
              'renderLevel': 'B+',
              'content': {
                'options': {
                  'fov': 60,
                  'far': 40,
                  'near': 0.1,
                  'clipMode': 1,
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
              'id': '3',
              'name': 'null_3',
              'duration': 5,
              'type': '3',
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
                'positionOverLifetime': {},
              },
              'transform': {
                'position': [
                  0,
                  0,
                  12,
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
            'clipMode': 1,
          },
        },
      ],
      'requires': [],
      'compositionId': '13',
      'bins': [],
      'textures': [],
    };
    const comp = await player.loadScene(json);
    const camera = comp.camera;

    expect(camera.position).to.deep.equals(new Vector3(0, 0, 8));
    player.gotoAndStop(2.2);
    expect(camera.position).to.deep.equals(new Vector3(0, 0, 12));
  });
});

describe('camera math', () => {
  // FIXME 相机旋转四元数的共轭逻辑去掉了 这部分单测先注释
  // it('camera quat star', () => {
  //   const camera = new Camera('x');
  //
  //   camera.rotation = [0, 30, 0];
  //   const inverseViewMatrix = new Float32Array(camera.getInverseViewMatrix());
  //   const expectMatrix = new Float32Array([0.8660253882408142, 0, 0.5, 0, 0, 1, 0, 0, -0.5, 0, 0.8660253882408142, 0, 0, 0, 0, 1]);
  //
  //   for (let i = 0; i < inverseViewMatrix.length; i++) {
  //     expect(inverseViewMatrix[i]).to.eql(expectMatrix[i]);
  //   }
  // });
});

const generateScene = items => ({
  'compositionId': 1,
  'requires': [],
  'compositions': [
    {
      'name': 'composition_1',
      'id': 1,
      'duration': 5,
      'camera': {
        'fov': 30,
        'far': 20,
        'near': 0.1,
        'position': [
          0,
          0,
          8,
        ],
        'clipMode': 1,
      },
      'items': items,
      'meta': {
        'previewSize': [
          1024,
          1024,
        ],
      },
    },
  ],
  'gltf': [],
  'images': [],
  'version': '0.8.10-beta.4',
  'shapes': [],
  'plugins': [],
  'type': 'mars',
  '_imgs': {
    '1': [],
  },
});
