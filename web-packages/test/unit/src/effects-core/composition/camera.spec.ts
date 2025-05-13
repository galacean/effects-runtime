import { Player, CameraController, spec, math } from '@galacean/effects';

const { Vector3 } = math;
const { expect } = chai;

describe('core/composition/camera/item', () => {
  let player: Player;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
  });

  after(() => {
    player.dispose();
    /// @ts-expect-error
    player = null;
  });

  it('camera options, type', async () => {
    const items = [{
      'name': 'camera',
      'delay': 0,
      'id': '11',
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
    const { near, fov, far, worldPosition, rotation } = comp.camera;
    const item = comp.getItemByName('camera');

    expect(item?.type).to.eql(spec.ItemType.camera, 'type');
    const cf = item?.getComponent(CameraController);

    expect(cf).to.be.an.instanceof(CameraController);
    expect(near).to.eql(0.6);
    expect(fov).to.eql(60);
    expect(far).to.eql(25);
    expect([+(worldPosition.x.toFixed(0)), +(worldPosition.y.toFixed(0)), +(worldPosition.z.toFixed(0))]).to.eql([10, 2, 12]);
    expect([+(rotation.x.toFixed(0)), +(rotation.y.toFixed(0)), +(rotation.z.toFixed(0))]).to.eql([10, 60, 30]);
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

    expect(camera.worldPosition).to.deep.equals(new Vector3(0, 0, 8));
    player.gotoAndStop(2.2);
    expect(camera.worldPosition).to.deep.equals(new Vector3(0, 0, 12));
  });
});

const generateScene = (items: any) => ({
  'compositionId': 1,
  'requires': [],
  'compositions': [{
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
  }],
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
