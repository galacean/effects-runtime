import type { Texture2DSourceOptionsVideo } from '@galacean/effects';
import { Player, Texture, spec } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

const json = {
  'playerVersion': {
    'web': '2.0.4',
    'native': '0.0.1.202311221223',
  },
  'images': [
    {
      'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*A-EoQ6SHJBgAAAAAAAAAAAAADlB4AQ/original',
      'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*y0ihQrDikLUAAAAAAAAAAAAADlB4AQ/original',
      'id': 'e3b1624a497b4c94bdfc9d4224434a95',
      'renderLevel': 'B+',
    },
  ],
  'fonts': [],
  'version': '3.0',
  'shapes': [],
  'plugins': ['video'],
  videos: [
    {
      url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/y8bSQJSAwAYAAAAAAAAAABAADnV5AQBr',
      // url: 'https://mass-office.alipay.com/huamei_koqzbu/afts/file/9u_BRo0t6bsAAAAAAAAAABAADnV5AQBr',
      id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      renderLevel: 'B+',
    },
  ],
  'type': 'ge',
  'compositions': [
    {
      'id': '5',
      'name': 'comp1',
      'duration': 10,
      'startTime': 0,
      'endBehavior': 4,
      'previewSize': [750, 1624],
      'items': [
        {
          'id': '14b3d069cbad4cbd81d0a8731cc4aba7',
        },
        {
          'id': '8b526e86ce154031a76f9176e7224f89',
        },
      ],
      'camera': {
        'fov': 60,
        'far': 40,
        'near': 0.1,
        'clipMode': 1,
        'position': [0, 0, 8],
        'rotation': [0, 0, 0],
      },
      'sceneBindings': [
        {
          'key': {
            'id': '75f0686d9d8341bf90a1711610e1d2fd',
          },
          'value': {
            'id': '14b3d069cbad4cbd81d0a8731cc4aba7',
          },
        },
        {
          'key': {
            'id': 'cb6a906e43204b198ecdd323b6a4965e',
          },
          'value': {
            'id': '8b526e86ce154031a76f9176e7224f89',
          },
        },
      ],
      'timelineAsset': {
        'id': 'b2cf025ce3b44b5f97759b4679e9598e',
      },
    },
  ],
  'components': [
    {
      'id': 'e45437d799364b7cad14b2222669d604',
      'item': {
        'id': '14b3d069cbad4cbd81d0a8731cc4aba7',
      },
      'dataType': 'VideoComponent',
      'options': {
        'startColor': [1, 1, 1, 1],
        video: {
          id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      },
      'renderer': {
        'renderMode': 1,
        'texture': {
          'id': 'b582d21fdd524c4684f1c057b220ddd0',
        },
      },
      'splits': [
        [0, 0, 1, 1, 0],
      ],
    },
    {
      'id': '295331279c0f472983f949b08cf3838a',
      'item': {
        'id': '8b526e86ce154031a76f9176e7224f89',
      },
      'dataType': 'ParticleSystem',
      'shape': {
        'type': 1,
        'radius': 1,
        'arc': 360,
        'arcMode': 0,
        'alignSpeedDirection': false,
        'shape': 'Sphere',
      },
      'renderer': {
        'renderMode': 1,
        'anchor': [0, 0],
      },
      'emission': {
        'rateOverTime': [0, 5],
      },
      'options': {
        'maxCount': 10,
        'startLifetime': [0, 1.2],
        'startDelay': [0, 0],
        'particleFollowParent': false,
        'start3DSize': false,
        'startRotationZ': [0, 0],
        'startColor': [8, [1, 1, 1, 1],
        ],
        'startSize': [0, 0.2],
        'sizeAspect': [0, 1],
      },
      'positionOverLifetime': {
        'startSpeed': [0, 1],
        'gravity': [0, 0, 0],
        'gravityOverLifetime': [0, 1],
      },
    },
  ],
  'geometries': [],
  'materials': [],
  'items': [
    {
      'id': '14b3d069cbad4cbd81d0a8731cc4aba7',
      'name': 'video',
      'duration': 5,
      'type': '1',
      'visible': true,
      'endBehavior': 5,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': 'e45437d799364b7cad14b2222669d604',
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
          'x': 3.1475,
          'y': 3.1475,
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
      'id': '8b526e86ce154031a76f9176e7224f89',
      'name': 'particle_2',
      'duration': 5,
      'type': '2',
      'visible': true,
      'endBehavior': 4,
      'delay': 0,
      'renderLevel': 'B+',
      'content': {
        'dataType': 'ParticleSystem',
        'shape': {
          'type': 1,
          'radius': 1,
          'arc': 360,
          'arcMode': 0,
          'alignSpeedDirection': false,
          'shape': 'Sphere',
        },
        'renderer': {
          'renderMode': 1,
          'anchor': [0, 0],
        },
        'emission': {
          'rateOverTime': [0, 5],
        },
        'options': {
          'maxCount': 10,
          'startLifetime': [0, 1.2],
          'startDelay': [0, 0],
          'particleFollowParent': false,
          'start3DSize': false,
          'startRotationZ': [0, 0],
          'startColor': [8, [1, 1, 1, 1],
          ],
          'startSize': [0, 0.2],
          'sizeAspect': [0, 1],
        },
        'positionOverLifetime': {
          'startSpeed': [0, 1],
          'gravity': [0, 0, 0],
          'gravityOverLifetime': [0, 1],
        },
      },
      'components': [
        {
          'id': '295331279c0f472983f949b08cf3838a',
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
  'textures': [
    {
      'id': 'b582d21fdd524c4684f1c057b220ddd0',
      'source': {
        'id': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      'flipY': true,
    },
  ],
  'animations': [],
  'miscs': [
    {
      'id': 'b2cf025ce3b44b5f97759b4679e9598e',
      'dataType': 'TimelineAsset',
      'tracks': [
        {
          'id': '75f0686d9d8341bf90a1711610e1d2fd',
        },
        {
          'id': 'cb6a906e43204b198ecdd323b6a4965e',
        },
      ],
    },
    {
      'id': 'f1c1e1d9460848fdb035116d63bc2f3f',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': 'c94c61ae3c384ba396261f4f93c5b4fb',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {
        'path': [22, [
          [
            [4, [0, -1],
            ],
            [4, [0.992, 0],
            ],
          ],
          [
            [-3.52496405201993, 0, 0],
            [0, 0, 0],
          ],
          [
            [-2.34997603467995, 0, 0],
            [-1.17498801733998, 0, 0],
          ],
        ],
        ],
      },
    },
    {
      'id': '75ae320c918345e994898d378cbc4b5a',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [1, 1, 1, 1],
    },
    {
      'id': '11111878de5e49e198c062f29f3c6c38',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 5,
          'asset': {
            'id': 'f1c1e1d9460848fdb035116d63bc2f3f',
          },
        },
      ],
    },
    {
      'id': '5ff36d3c30964b83b3ba8f4819f45d93',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 5,
          'asset': {
            'id': 'c94c61ae3c384ba396261f4f93c5b4fb',
          },
        },
      ],
    },
    {
      'id': '7695800886c846308d5436acade4c8df',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 5,
          'asset': {
            'id': '75ae320c918345e994898d378cbc4b5a',
          },
        },
      ],
    },
    {
      'id': '75f0686d9d8341bf90a1711610e1d2fd',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '11111878de5e49e198c062f29f3c6c38',
        },
        {
          'id': '5ff36d3c30964b83b3ba8f4819f45d93',
        },
        {
          'id': '7695800886c846308d5436acade4c8df',
        },
      ],
      'clips': [],
    },
    {
      'id': 'e5a205def3dd43d6b5ab1984962e3a90',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': '3f9afeb4198043af90c2c8579f111901',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 5,
          'endBehavior': 4,
          'asset': {
            'id': 'e5a205def3dd43d6b5ab1984962e3a90',
          },
        },
      ],
    },
    {
      'id': 'cb6a906e43204b198ecdd323b6a4965e',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': '3f9afeb4198043af90c2c8579f111901',
        },
      ],
      'clips': [],
    },
  ],
  'compositionId': '5',
};
let player: Player;
const container = document.getElementById('J-container');
const addButton = document.getElementById('J-add');
const updateButton = document.getElementById('J-update');
const inputEle = document.getElementById('J-input') as HTMLInputElement;

(async () => {
  try {
    player = new Player({
      container,
      fps: 130,
    });

    await player.loadScene(json, { renderLevel: spec.RenderLevel.B });
  } catch (e) {
    console.error('biz', e);
  }
})();

addButton?.addEventListener('click', async () => {
  const input = (document.getElementById('J-input') as HTMLInputElement).value;

  if (input) {
    const item = player.getCompositionByName('comp1')?.getItemByName('video');
    const texture = await Texture.fromVideo(input, player.renderer.engine);

    if (!item) { return; }

    const videoComponent = item.addComponent(VideoComponent);

    item.composition?.textures.push(texture);
    videoComponent.item = item;
    videoComponent.fromData({
      options: {
        video: {
          //@ts-expect-error
          data: (texture.source as Texture2DSourceOptionsVideo).video,
        },
      },
      renderer: {
        mask: 0,
        texture,
      },
    });
  }
});

updateButton?.addEventListener('click', async () => {
  const value = inputEle.value;

  if (value) {
    const videoComponent = player.getCompositionByName('comp1')?.getItemByName('video')?.getComponent(VideoComponent);

    if (videoComponent) {
      const texture = await Texture.fromVideo(value, player.renderer.engine);

      videoComponent.setTexture(texture);
    }
  }
});
