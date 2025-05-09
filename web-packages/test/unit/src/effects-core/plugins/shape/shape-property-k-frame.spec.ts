import { Player, ShapeComponent, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/plugins/shape/shape-property-k-frame', () => {
  let player: Player;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
  });

  after(() => {
    player && player.dispose();
  });

  it('set shape property by path', async () => {
    const json = {
      'playerVersion': {
        'web': '2.3.1',
        'native': '0.0.1.202311221223',
      },
      'images': [],
      'fonts': [],
      'version': '3.2',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': '1',
          'name': '新建合成3',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 5,
          'previewSize': [
            750,
            1624,
          ],
          'items': [
            {
              'id': 'b9ac6b0c8e164747924dd6031a44e293',
            },
            {
              'id': '38fd0a72bd104f4ca0fba8e4919ae7c1',
            },
            {
              'id': '80fffd05dc3d466b9be97b9af0e27b79',
            },
            {
              'id': 'a415e2f558e74a518d1d0d0391db58db',
            },
          ],
          'camera': {
            'fov': 60,
            'far': 40,
            'near': 0.1,
            'clipMode': 1,
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
          'sceneBindings': [
            {
              'key': {
                'id': '6cfdab24c3054bcc81fcc1987f40e844',
              },
              'value': {
                'id': 'b9ac6b0c8e164747924dd6031a44e293',
              },
            },
            {
              'key': {
                'id': '00c271b1bbf7449ca7a5c1303f0b1de0',
              },
              'value': {
                'id': '38fd0a72bd104f4ca0fba8e4919ae7c1',
              },
            },
            {
              'key': {
                'id': 'b9af592b70e74d34a11d8a5daa5701b0',
              },
              'value': {
                'id': '80fffd05dc3d466b9be97b9af0e27b79',
              },
            },
            {
              'key': {
                'id': 'ea1a29f9cc3a4c729ae5d47416fbc016',
              },
              'value': {
                'id': 'a415e2f558e74a518d1d0d0391db58db',
              },
            },
          ],
          'timelineAsset': {
            'id': '156a333a1b734251812ddf2311d2ae4e',
          },
        },
      ],
      'components': [
        {
          'id': 'c94f29a4cedf48d882d40e05d585883c',
          'item': {
            'id': 'b9ac6b0c8e164747924dd6031a44e293',
          },
          'type': 1,
          'dataType': 'ShapeComponent',
          'width': 24.8602,
          'height': 135.4835,
          'roundness': 0,
          'fill': {
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
          'renderer': {
            'renderMode': 1,
          },
        },
        {
          'id': 'dcf8fa07d41749b0addc5b0bcb5d1fae',
          'item': {
            'id': '38fd0a72bd104f4ca0fba8e4919ae7c1',
          },
          'type': 2,
          'dataType': 'ShapeComponent',
          'xRadius': 3.6016,
          'yRadius': 1.6371,
          'fill': {
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
          'renderer': {
            'renderMode': 1,
          },
        },
        {
          'id': 'acb11866d3df4305801622505fd2edd9',
          'item': {
            'id': '80fffd05dc3d466b9be97b9af0e27b79',
          },
          'type': 3,
          'dataType': 'ShapeComponent',
          'pointCount': 5,
          'radius': 3.1456,
          'roundness': 0,
          'fill': {
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
          'renderer': {
            'renderMode': 1,
          },
        },
        {
          'id': '98d9dedb3373479f9c9c66b5116b0444',
          'item': {
            'id': 'a415e2f558e74a518d1d0d0391db58db',
          },
          'type': 4,
          'dataType': 'ShapeComponent',
          'pointCount': 5,
          'innerRadius': 1.1471,
          'outerRadius': 2.2943,
          'innerRoundness': 0,
          'outerRoundness': 0,
          'fill': {
            'color': {
              'r': 1,
              'g': 1,
              'b': 1,
              'a': 1,
            },
          },
          'renderer': {
            'renderMode': 1,
          },
        },
      ],
      'geometries': [],
      'materials': [],
      'items': [
        {
          'id': 'b9ac6b0c8e164747924dd6031a44e293',
          'name': 'rectangle',
          'duration': 5,
          'type': 'shape',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': 'c94f29a4cedf48d882d40e05d585883c',
            },
          ],
          'transform': {
            'position': {
              'x': 0,
              'y': 7.6046,
              'z': 0,
            },
            'eulerHint': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'anchor': {
              'x': 0,
              'y': 0,
            },
            'scale': {
              'x': 0.1766,
              'y': 0.023,
              'z': 1,
            },
          },
          'dataType': 'VFXItemData',
        },
        {
          'id': '38fd0a72bd104f4ca0fba8e4919ae7c1',
          'name': 'ellipse',
          'duration': 5,
          'type': 'shape',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': 'dcf8fa07d41749b0addc5b0bcb5d1fae',
            },
          ],
          'transform': {
            'position': {
              'x': -0.0571,
              'y': 3.0284,
              'z': 0,
            },
            'eulerHint': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'anchor': {
              'x': 0,
              'y': 0,
            },
            'scale': {
              'x': 1,
              'y': 1,
              'z': 1,
            },
          },
          'dataType': 'VFXItemData',
        },
        {
          'id': '80fffd05dc3d466b9be97b9af0e27b79',
          'name': 'polygon',
          'duration': 5,
          'type': 'shape',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': 'acb11866d3df4305801622505fd2edd9',
            },
          ],
          'transform': {
            'position': {
              'x': -0.0571,
              'y': -1.537,
              'z': 0,
            },
            'eulerHint': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'anchor': {
              'x': 0,
              'y': 0,
            },
            'scale': {
              'x': 0.6816,
              'y': 0.6257,
              'z': 1,
            },
          },
          'dataType': 'VFXItemData',
        },
        {
          'id': 'a415e2f558e74a518d1d0d0391db58db',
          'name': 'star',
          'duration': 5,
          'type': 'shape',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
            {
              'id': '98d9dedb3373479f9c9c66b5116b0444',
            },
          ],
          'transform': {
            'position': {
              'x': 0,
              'y': -6.727,
              'z': 0,
            },
            'eulerHint': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'anchor': {
              'x': 0,
              'y': 0,
            },
            'scale': {
              'x': 1,
              'y': 1,
              'z': 1,
            },
          },
          'dataType': 'VFXItemData',
        },
      ],
      'shaders': [],
      'bins': [],
      'textures': [],
      'animations': [],
      'miscs': [
        {
          'id': '156a333a1b734251812ddf2311d2ae4e',
          'dataType': 'TimelineAsset',
          'tracks': [
            {
              'id': '6cfdab24c3054bcc81fcc1987f40e844',
            },
            {
              'id': '00c271b1bbf7449ca7a5c1303f0b1de0',
            },
            {
              'id': 'b9af592b70e74d34a11d8a5daa5701b0',
            },
            {
              'id': 'ea1a29f9cc3a4c729ae5d47416fbc016',
            },
          ],
        },
        {
          'id': '3250ead151e74e21be5595339192c81f',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '1a018755db0d4d19ae09d1e5ab2045bd',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': '41d95df13f09486cb6bd97265513bb11',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '3250ead151e74e21be5595339192c81f',
              },
            },
          ],
        },
        {
          'id': '529384fb5f7d46598e282efbf2700c77',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '1a018755db0d4d19ae09d1e5ab2045bd',
              },
            },
          ],
        },
        {
          'id': '6cfdab24c3054bcc81fcc1987f40e844',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '41d95df13f09486cb6bd97265513bb11',
            },
            {
              'id': '529384fb5f7d46598e282efbf2700c77',
            },
          ],
          'clips': [],
        },
        {
          'id': 'ac28aa004b7c4652b20cb24227ddd585',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': 'd5cd54564811475ab83ad93742bfe216',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': 'f7b21802f1c24c2fb0c30f8a8f23e078',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': 'ac28aa004b7c4652b20cb24227ddd585',
              },
            },
          ],
        },
        {
          'id': '29719941e54041b1a6988ccfd4fa33d7',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': 'd5cd54564811475ab83ad93742bfe216',
              },
            },
          ],
        },
        {
          'id': '00c271b1bbf7449ca7a5c1303f0b1de0',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': 'f7b21802f1c24c2fb0c30f8a8f23e078',
            },
            {
              'id': '29719941e54041b1a6988ccfd4fa33d7',
            },
          ],
          'clips': [],
        },
        {
          'id': '607344e0e1204178a2483efce6c09074',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': 'b01b38c8253241f0988381d81097da3f',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': '17cb683688e648ee9936ea4cb2d0d9bb',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '607344e0e1204178a2483efce6c09074',
              },
            },
          ],
        },
        {
          'id': 'cb8ad244d1f44fdb8cccb4c2fda1bf65',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': 'b01b38c8253241f0988381d81097da3f',
              },
            },
          ],
        },
        {
          'id': 'b9af592b70e74d34a11d8a5daa5701b0',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '17cb683688e648ee9936ea4cb2d0d9bb',
            },
            {
              'id': 'cb8ad244d1f44fdb8cccb4c2fda1bf65',
            },
          ],
          'clips': [],
        },
        {
          'id': '35acc8ec05df489f8daa61d63a72dab0',
          'dataType': 'ActivationPlayableAsset',
        },
        {
          'id': '1bdde216d3a64fed98ea2d44477a0492',
          'dataType': 'TransformPlayableAsset',
          'positionOverLifetime': {},
        },
        {
          'id': '40b2df9a86794244962ae3bb910c560a',
          'dataType': 'ActivationTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '35acc8ec05df489f8daa61d63a72dab0',
              },
            },
          ],
        },
        {
          'id': '766b0a13103046adb282737a0d8a7496',
          'dataType': 'TransformTrack',
          'children': [],
          'clips': [
            {
              'start': 0,
              'duration': 5,
              'endBehavior': 0,
              'asset': {
                'id': '1bdde216d3a64fed98ea2d44477a0492',
              },
            },
          ],
        },
        {
          'id': 'ea1a29f9cc3a4c729ae5d47416fbc016',
          'dataType': 'ObjectBindingTrack',
          'children': [
            {
              'id': '40b2df9a86794244962ae3bb910c560a',
            },
            {
              'id': '766b0a13103046adb282737a0d8a7496',
            },
          ],
          'clips': [],
        },
      ],
      'compositionId': '1',
    };

    const composition = await player.loadScene(json);

    const star = composition.getItemByName('star')?.getComponent(ShapeComponent);
    const polygon = composition.getItemByName('polygon')?.getComponent(ShapeComponent);
    const ellipse = composition.getItemByName('ellipse')?.getComponent(ShapeComponent);
    const rectangle = composition.getItemByName('rectangle')?.getComponent(ShapeComponent);

    const findProperty = (path: string, animatedObject: any)=>{
      const propertyNames = path.split('.');
      let target = animatedObject;

      for (const propertyName of propertyNames) {
        target = target[propertyName];

        if (target === undefined) {
          break;
        }
      }

      return target;
    };

    const checkPropertiesExist = (propertyPaths: string[], animatedObject: any)=>{
      for (const path of propertyPaths) {
        expect(findProperty(path, animatedObject), 'Property ' + path + ' should exist').to.exist;
      }
    };

    const starPaths = [
      'shape.pointCount',
      'shape.innerRadius',
      'shape.outerRadius',
      'shape.innerRoundness',
      'shape.outerRoundness',
    ];
    const polygonPaths = [
      'shape.pointCount',
      'shape.radius',
      'shape.roundness',
    ];
    const ellipsePaths = [
      'shape.xRadius',
      'shape.yRadius',
    ];
    const rectanglePaths = [
      'shape.width',
      'shape.height',
      'shape.roundness',
    ];

    checkPropertiesExist(starPaths, star);
    checkPropertiesExist(polygonPaths, polygon);
    checkPropertiesExist(ellipsePaths, ellipse);
    checkPropertiesExist(rectanglePaths, rectangle);
  });
});