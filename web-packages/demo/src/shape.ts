import { Player, ShapeComponent } from '@galacean/effects';

const json = {
  'playerVersion': {
    'web': '2.0.4',
    'native': '0.0.1.202311221223',
  },
  'images': [],
  'fonts': [],
  'version': '3.0',
  'shapes': [],
  'plugins': [],
  'type': 'ge',
  'compositions': [
    {
      'id': '1',
      'name': '新建合成1',
      'duration': 6,
      'startTime': 0,
      'endBehavior': 4,
      'previewSize': [
        750,
        1624,
      ],
      'items': [
        {
          'id': '21135ac68dfc49bcb2bc7552cbb9ad07',
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
      ],
      'timelineAsset': {
        'id': 'dd50ad0de3f044a5819576175acf05f7',
      },
    },
  ],
  'components': [
    {
      'id': 'b7890caa354a4c279ff9678c5530cd83',
      'item': {
        'id': '21135ac68dfc49bcb2bc7552cbb9ad07',
      },
      'dataType': 'ShapeComponent',
      'type': 0,
      'points': [
        {
          'x': -1,
          'y': -1,
          'z': 0,
        },
        {
          'x': 1,
          'y': -1,
          'z': 0,
        },
        {
          'x': 0,
          'y': 1,
          'z': 0,
        },
      ],
      'easingIns': [
        {
          'x': -1,
          'y': -0.5,
          'z': 0,
        },
        {
          'x': 0.5,
          'y': -1.5,
          'z': 0,
        },
        {
          'x': 0.5,
          'y': 1,
          'z': 0,
        },
      ],
      'easingOuts': [
        {
          'x': -0.5,
          'y': -1.5,
          'z': 0,
        },
        {
          'x': 1,
          'y': -0.5,
          'z': 0,
        },
        {
          'x': -0.5,
          'y': 1,
          'z': 0,
        },
      ],
      'shapes': [
        {
          'verticalToPlane': 'z',
          'indexes': [
            {
              'point': 0,
              'easingIn': 0,
              'easingOut': 0,
            },
            {
              'point': 1,
              'easingIn': 1,
              'easingOut': 1,
            },
            {
              'point': 2,
              'easingIn': 2,
              'easingOut': 2,
            },
          ],
          'close': true,
          'fill': {
            'color': { 'r':1, 'g':0.7, 'b':0.5, 'a':1 },
          },
        },
      ],
      'renderer': {
        'renderMode': 1,
      },
    },
  ],
  'geometries': [],
  'materials': [],
  'items': [
    {
      'id': '21135ac68dfc49bcb2bc7552cbb9ad07',
      'name': 'Shape',
      'duration': 5,
      'type': '1',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': 'b7890caa354a4c279ff9678c5530cd83',
        },
      ],
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
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
        'size': {
          'x': 1.2,
          'y': 1.2,
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
      'id': 'dd50ad0de3f044a5819576175acf05f7',
      'dataType': 'TimelineAsset',
      'tracks': [
      ],
    },
  ],
  'compositionId': '1',
};
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    const composition = await player.loadScene(json);
    const item = composition.getItemByName('Shape');
    const shapeComponent = item?.getComponent(ShapeComponent);
  } catch (e) {
    console.error('biz', e);
  }
})();
