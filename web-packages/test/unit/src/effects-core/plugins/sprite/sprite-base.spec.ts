// @ts-nocheck
import { CompositionComponent, Player, SpriteComponent, StaticValue, math } from '@galacean/effects';
import { generateSceneJSON } from './utils';

const Vector3 = math.Vector3;
const Quaternion = math.Quaternion;

const { expect } = chai;

describe('sprite item base options', () => {
  let player: Player;
  const canvas = document.createElement('canvas');
  const renderOptions = {
    canvas,
    pixelRatio: 1,
    manualRender: true,
    interactive: true,
  };

  before(() => {
    const canvas = document.createElement('canvas');
    const renderOptions = {
      canvas,
      pixelRatio: 1,
      manualRender: true,
      interactive: true,
    };

    player = new Player({ ...renderOptions });
  });

  after(() => {
    player && player.dispose();
  });

  // 初始颜色和颜色/透明度随时间渐变
  it('sprite color and opacity OverLifetime', async () => {
    const startColor = [0.3, 0.2, 0.2, 1];
    const color0 = [0, 124, 183, 187, 255];
    const color1 = [1, 160, 47, 194, 255];
    const opacity = [0, 0.3];
    const json = `[{"id":"140","name":"sprite_1","duration":2,"type":"1","visible":true,"endBehavior":0,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[${startColor}]},"renderer":{"renderMode":1},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"colorOverLifetime":{"color":[9,[[${color0}],[${color1}]]],"opacity":[${opacity}]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1.2,1.2,1]}}]`;
    const comp = await player.loadScene(generateSceneJSON(JSON.parse(json)));

    player.gotoAndPlay(0.01);
    const spriteItem = comp.getItemByName('sprite_1').getComponent(SpriteComponent);
    const sprite1 = comp.getItemByName('sprite_1');
    let spriteBindingTrack;
    let spriteColorTrack;

    for (const track of comp.rootItem.getComponent(CompositionComponent).masterTracks) {
      if (track.bindingItem === sprite1) {
        spriteBindingTrack = track;
      }
    }

    for (const subTrack of spriteBindingTrack.getChildTracks()) {
      if (subTrack.name === 'SpriteColorTrack') {
        spriteColorTrack = subTrack;
      }
    }
    const spriteColorClip = spriteColorTrack.findClip('SpriteColorClip').playable;

    const color = spriteItem.material.getVector4('_Color').toArray();

    expect(spriteColorClip.startColor).to.eql([0.3, 0.2, 0.2, 1], 'startColor');
    expect(spriteColorClip.colorOverLifetime).to.eql([
      { stop: 0, color: [124, 183, 187, 255] },
      { stop: 1, color: [160, 47, 194, 255] },
    ], 'colorOverLifetime');
    expect(color[0]).to.be.closeTo(124 / 255 * startColor[0], 0.0001);
    expect(color[1]).to.be.closeTo(183 / 255 * startColor[1], 0.0001);
    expect(color[2]).to.be.closeTo(187 / 255 * startColor[2], 0.0001);
    expect(color[3]).to.eql(opacity[1]);
  });

  // 尺寸随时间变换
  it('sprite sizeOverLifetime', async () => {
    const items = [
      {
        'id': '5',
        'name': 'item',
        'duration': 5,
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
            'texture': 0,
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
              21,
              [
                [
                  4,
                  [
                    0,
                    1,
                  ],
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              21,
              [
                [
                  4,
                  [
                    0,
                    2,
                  ],
                ],
              ],
            ],
          },
          'splits': [
            [
              0,
              0,
              1,
              1,
              0,
            ],
          ],
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
            12.5965,
            12.5965,
            1,
          ],
        },
      },
    ];
    const comp = await player.loadScene(generateSceneJSON(items));

    player.gotoAndPlay(0.01);

    expect(spriteItem.sizeSeparateAxes, 'sizeSeparateAxes').to.be.true;
    expect(sizeX, 'sizeXOverLifetime').to.be.an.instanceof(StaticValue);
    expect(sizeY, 'sizeYOverLifetime').to.be.an.instanceof(StaticValue);
    expect(sizeX.getValue(0), 'sizeXOverLifetime').to.eql(2);
    expect(sizeY.getValue(0), 'sizeYOverLifetime').to.eql(1);
    expect(sizeZ.getValue(0), 'sizeZOverLifetime').to.eql(1);
  });

  // 帧动画测试
  it('sprite sheet animation', async () => {
    const json = '{"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*pMoUS5aQU8UAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*31h5T7SiZrIAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"spines":[],"version":"1.5","shapes":[],"plugins":[],"type":"mars","compositions":[{"id":"14","name":"帧动画","duration":5,"startTime":0,"endBehavior":1,"previewSize":[750,1624],"items":[{"id":"42","name":"日历逐帧","duration":1,"type":"1","visible":true,"endBehavior":4,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"occlusion":false},"positionOverLifetime":{"startSpeed":0},"textureSheetAnimation":{"col":8,"row":8,"animate":true,"cycles":0,"blend":false,"animationDuration":2,"animationDelay":0,"total":59}},"transform":{"position":[-0.6295,-0.0166,0],"rotation":[0,0,0],"scale":[2.4177,2.4177,1]}}],"camera":{"fov":60,"far":20,"near":0.1,"position":[0,0,8],"rotation":[0,0,0],"clipMode":0}}],"requires":[],"compositionId":"14","bins":[],"textures":[{"source":0,"flipY":true}]}';
    const comp = await player.loadScene(JSON.parse(json));

    player.gotoAndStop(0);
    const spriteItem = comp.getItemByName('日历逐帧').getComponent(SpriteComponent);

    spriteItem.update();
    const texOffset0 = spriteItem.material.getVector4('_TexOffset').clone().toArray();
    let spriteColorTrack;

    for (const track of comp.rootItem.getComponent(CompositionComponent).masterTracks) {
      if (track.bindingItem === spriteItem) {
        spriteColorTrack = track;
      }
    }
    spriteColorTrack.setTime(0.2);
    spriteItem.update();

    const texOffset2 = spriteItem.material.getVector4('_TexOffset').clone().toArray();

    expect(texOffset0[0]).to.be.closeTo(0.0004, 0.001);
    expect(texOffset0[1]).to.be.closeTo(0.8746, 0.001);
    expect(texOffset0[2]).to.be.closeTo(0.1249, 0.001);
    expect(texOffset0[3]).to.be.closeTo(0.1249, 0.001);
    expect(texOffset2[0]).to.be.closeTo(0.5, 0.001);
    expect(texOffset2[1]).to.be.closeTo(0.7497, 0.001);
    expect(texOffset2[2]).to.be.closeTo(0.1248, 0.001);
    expect(texOffset2[3]).to.be.closeTo(0.1249, 0.001);
  });

  // 位置、大小受父节点影响
  it('transform affected by parent', async () => {
    const selfColor = [0.1, 0.8, 0.8, 1];
    const currentTime = 2;
    const json = {
      'images': [],
      'spines': [],
      'version': '1.5',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      'compositions': [
        {
          'id': '2',
          'name': '新建合成2',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 1,
          'previewSize': [
            750,
            1624,
          ],
          'items': [
            {
              'id': '1',
              'name': 'sprite_3',
              'duration': 5,
              'type': '1',
              'parentId': '2',
              'visible': true,
              'endBehavior': 0,
              'delay': 0,
              'renderLevel': 'B+',
              'content': {
                'options': {
                  'startColor': selfColor,
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
                    0,
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
                  1,
                  1,
                  1,
                ],
              },
            },
            {
              'id': '2',
              'name': 'null_2',
              'duration': 5,
              'type': '3',
              'visible': true,
              'endBehavior': 0,
              'delay': 0,
              'renderLevel': 'B+',
              'content': {
                'options': {
                  'startColor': [0.95, 0.93, 0.93, 1],
                },
                'positionOverLifetime': {},
              },
              'transform': {
                'position': [
                  2,
                  1,
                  1,
                ],
                'rotation': [
                  0,
                  0,
                  30,
                ],
                'scale': [
                  2,
                  2,
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
      'compositionId': '2',
      'bins': [],
      'textures': [],
    };
    const comp = await player.loadScene(json);

    player.gotoAndPlay(currentTime);
    const spriteItem = comp.getItemByName('sprite_3').getComponent(SpriteComponent);
    const spriteTransform = spriteItem.transform;
    const scale = spriteTransform.getWorldScale().toArray();
    const position = spriteTransform.getWorldPosition().toArray();
    const rotation = spriteTransform.getWorldRotation().toArray();

    expect(scale[0]).to.be.closeTo(2, 0.0001);
    expect(scale[1]).to.be.closeTo(2, 0.0001);
    expect(position[0]).to.be.closeTo(2, 0.0001);
    expect(position[1]).to.be.closeTo(1, 0.0001);
    expect(position[2]).to.be.closeTo(1, 0.0001);
    expect(rotation[2]).to.be.closeTo(30, 0.0001);
  });

  // 大小受多级父节点同时影响
  it('size affected by parent and grandParent', async () => {
    const json = '[{"id":"3","name":"sprite_3","duration":2,"type":"1","parentId":"7","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":1},"splits":[[0.0078125,0.0078125,0.6015625,0.6015625,0]]},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}},{"id":"7","name":"null_7","duration":2,"type":"3","parentId":"8","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"positionOverLifetime":{},"colorOverLifetime":{"color":[9,[[0,242,17,17,255],[1,14,250,73,255]]],"opacity":[0,1]}},"transform":{"position":[2,1,1],"rotation":[0,0,0],"scale":[3,3,1]}},{"id":"8","name":"null_8","duration":2,"type":"3","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[0.4,0.6,0.5,1]},"positionOverLifetime":{},"colorOverLifetime":{"opacity":[5,[[0,0],[1,1]]]}},"transform":{"position":[-2,-1,-3],"rotation":[0,0,0],"scale":[2,2,1]}}]';
    const currentTime = 1;
    const comp = await player.loadScene(generateSceneJSON(JSON.parse(json)));

    player.gotoAndPlay(currentTime);
    const spriteItem = comp.getItemByName('sprite_3').getComponent(SpriteComponent);
    const size = new Vector3();

    spriteItem.item.transform.assignWorldTRS(new Vector3(), new Quaternion(), size);
    // size
    expect(size.x).to.eql(6);
    expect(size.y).to.eql(6);
  });

  // 图层作为父元素时基础属性的继承
  it('set sprite item as parent for basic transform', async () => {
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
              'id': '4',
              'name': 'sprite_4',
              'duration': 5,
              'type': '1',
              'parentId': '6',
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
                  1.2,
                  1.2,
                  1,
                ],
              },
            },
            {
              'id': '6',
              'name': 'sprite_6',
              'duration': 2,
              'type': '1',
              'parentId': '5',
              'visible': true,
              'endBehavior': 0,
              'delay': 1,
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
              },
              'transform': {
                'position': [
                  1,
                  4,
                  3,
                ],
                'rotation': [
                  0,
                  0,
                  0,
                ],
                'scale': [
                  1.2,
                  1.2,
                  1,
                ],
              },
            },
            {
              'id': '5',
              'name': 'sprite_5',
              'duration': 5,
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
              },
              'transform': {
                'position': [
                  0,
                  2,
                  0,
                ],
                'rotation': [
                  0,
                  0,
                  0,
                ],
                'scale': [
                  2,
                  2,
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

    player.gotoAndPlay(0.01);

    const item4 = comp.getItemByName('sprite_4');

    expect(item4.transform.getWorldPosition().toArray()).to.eql([0, 2, 0]);
    let scale = item4.transform.getWorldScale().toArray();

    expect(scale[0]).to.be.closeTo(1, 0.0001);
    expect(scale[1]).to.be.closeTo(1, 0.0001);

    player.gotoAndStop(comp.time + 1.5);
    expect(item4.transform.getWorldPosition().toArray()).to.eql([1, 6, 3]);
    scale = item4.transform.getWorldScale().toArray();

    expect(scale[0]).to.be.closeTo(1, 0.0001);
    expect(scale[1]).to.be.closeTo(1, 0.0001);

    player.gotoAndStop(comp.time + 2);
    expect(item4.transform.getWorldPosition().toArray()).to.eql([0, 2, 0]);
    scale = item4.transform.getWorldScale().toArray();

    expect(scale[0]).to.be.closeTo(1, 0.0001);
    expect(scale[1]).to.be.closeTo(1, 0.0001);

  });

  // 图层作为父元素时k帧属性的继承
  it('set sprite item as parent for animation transform', async () => {
    const json = {
      'images': [],
      'spines': [],
      'version': '1.5',
      'shapes': [],
      'plugins': [],
      'type': 'mars',
      'compositions': [
        {
          'id': '14',
          'name': '新建合成9',
          'duration': 5,
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
              'duration': 5,
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
                  'asMovement': true,
                  'linearX': [
                    0,
                    0,
                  ],
                  'linearY': [
                    0,
                    2,
                  ],
                  'linearZ': [
                    0,
                    0,
                  ],
                  'asRotation': false,
                  'orbitalX': [
                    0,
                    0,
                  ],
                  'orbitalY': [
                    0,
                    0,
                  ],
                  'orbitalZ': [
                    0,
                    0,
                  ],
                  'orbCenter': [
                    0,
                    0,
                    0,
                  ],
                  'speedOverLifetime': [
                    0,
                    1,
                  ],
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
                    0,
                    2,
                  ],
                },
                'rotationOverLifetime': {
                  'asRotation': true,
                  'z': [
                    0,
                    0,
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
                  1.2,
                  1.2,
                  1,
                ],
              },
            },
            {
              'id': '2',
              'name': 'sprite_2',
              'duration': 5,
              'type': '1',
              'visible': true,
              'parentId': '1',
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
      'compositionId': '14',
      'bins': [],
      'textures': [],
    };

    const comp = await player.loadScene(json);

    player.gotoAndPlay(5);
    const item2 = comp.getItemByName('sprite_2'); // item4的父元素
    const scale = item2.transform.getWorldScale().toArray();

    expect(scale[0]).to.be.closeTo(2, 0.0001);
    expect(scale[1]).to.be.closeTo(2, 0.0001);
  });

});

