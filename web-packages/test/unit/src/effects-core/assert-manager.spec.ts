import { Player } from '@galacean/effects';

const { expect } = chai;

describe('asset manager', () => {
  let player: Player | null;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  after(() => {
    player!.dispose();
    player = null;
  });

  it('templateV2 video', async () => {
    player = player!;
    const assets = {
      'images': [
        {
          'template': {
            'v': 2,
            'variables': {
              'test': 'https://mdn.alipayobjects.com/huamei_p0cigc/afts/file/A*ZOgXRbmVlsIAAAAAAAAAAAAADoB5AQ',
            },
            'width': 126,
            'height': 130,
            'background': {
              'type': 'video',
              'name': 'test',
              'url': 'https://mdn.alipayobjects.com/huamei_p0cigc/afts/file/A*ZOgXRbmVlsIAAAAAAAAAAAAADoB5AQ',
            },
          },
          'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*oKwARKdkWhEAAAAAAAAAAAAADlB4AQ/original',
          'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*eOLVQpT57FcAAAAAAAAAAAAADlB4AQ/original',
          'renderLevel': 'B+',
        },
      ],
      'fonts': [],
      'spines': [],
      'shapes': [],
    };

    const comp = await player.loadScene(generateScene(assets));

    const textureOptions = comp.compositionSourceManager.textureOptions;

    expect(textureOptions.length).to.deep.equals(1);
    expect(textureOptions[0]).to.haveOwnProperty('video');
    const videoElement = textureOptions[0].video;

    expect(videoElement).to.be.an.instanceOf(HTMLVideoElement);

    player.gotoAndStop(0.1);

  });

  it('templateV2 video variables', async () => {
    player = player!;
    const assets = {
      'images': [
        {
          'template': {
            'v': 2,
            'variables': {
              'test': 'https://mdn.alipayobjects.com/huamei_p0cigc/afts/file/A*ZOgXRbmVlsIAAAAAAAAAAAAADoB5AQ',
            },
            'width': 126,
            'height': 130,
            'background': {
              'type': 'video',
              'name': 'test',
              'url': 'https://mdn.alipayobjects.com/huamei_p0cigc/afts/file/A*ZOgXRbmVlsIAAAAAAAAAAAAADoB5AQ',
            },
          },
          'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*oKwARKdkWhEAAAAAAAAAAAAADlB4AQ/original',
          'webp': 'https://mdn.alipayobjects.com/mars/afts/img/A*eOLVQpT57FcAAAAAAAAAAAAADlB4AQ/original',
          'renderLevel': 'B+',
        },
      ],
      'fonts': [],
      'spines': [],
      'shapes': [],
    };

    const comp = await player.loadScene(generateScene(assets), {
      variables: {
        // 视频地址
        test: 'https://gw.alipayobjects.com/v/huamei_p0cigc/afts/video/A*dftzSq2szUsAAAAAAAAAAAAADtN3AQ',
      },
    });

    const textureOptions = comp.compositionSourceManager.textureOptions;

    expect(textureOptions.length).to.deep.equals(1);
    expect(textureOptions[0]).to.haveOwnProperty('video');
    const videoElement = textureOptions[0].video;

    expect(videoElement).to.be.an.instanceOf(HTMLVideoElement);

    player.gotoAndStop(0.1);

  });
});

//@ts-expect-error
const generateScene = assets => {
  const res = {
    'playerVersion': {
      'web': '1.2.1',
      'native': '0.0.1.202311221223',
    },
    'version': '2.2',
    'type': 'ge',
    'compositions': [
      {
        'id': '1',
        'name': '新建合成1',
        'duration': 5,
        'startTime': 0,
        'endBehavior': 0,
        'previewSize': [750, 1624],
        'items': [
          {
            'id': '1',
            'name': 'sprite_1',
            'duration': 5,
            'type': '1',
            'visible': true,
            'endBehavior': 0,
            'delay': 0,
            'renderLevel': 'B+',
            'content': {
              'options': {
                'startColor': [0.9529, 1, 0.0431, 1],
              },
              'renderer': {
                'renderMode': 1,
                'texture': 0,
              },
              'positionOverLifetime': {
                'path': [12, [
                  [
                    [0, 0, 0, 2.3256],
                    [0.43, 1, 2.3256, 3.4483],
                    [0.72, 2, 3.4483, 0],
                  ],
                  [
                    [0, 0, 0],
                    [0, 7.79, 0],
                    [3.3269, 7.79, 0],
                  ],
                  [
                    [0, 1.9475, 0],
                    [0, 5.8425, 0],
                    [0.8317, 7.79, 0],
                    [2.4952, 7.79, 0],
                  ],
                ],
                ],
                'direction': [0, 0, 0],
                'startSpeed': 0,
                'gravity': [0, 0, 0],
                'gravityOverLifetime': [0, 1],
              },
              'sizeOverLifetime': {
                'size': [6, [
                  [0.126, 1.2055, 0, 1.6835],
                  [0.72, 2.5395, 1.6835, 0],
                ],
                ],
              },
              'colorOverLifetime': {
                'opacity': [6, [
                  [0, 0, 0, 1.3889],
                  [0.72, 1, 1.3889, 0],
                ],
                ],
              },
            },
            'transform': {
              'position': [0, 0, 0],
              'rotation': [0, 0, 0],
              'scale': [1.5492, 1.5984, 1],
            },
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
      },
    ],
    'requires': [],
    'compositionId': '1',
    'bins': [],
    'textures': [
      {
        'source': 0,
        'flipY': true,
      },
    ],
  };

  return { ...res, ...assets };
};
