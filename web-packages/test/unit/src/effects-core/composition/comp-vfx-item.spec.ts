// @ts-nocheck
import { Player } from '@galacean/effects';

const { expect } = chai;

describe('comp-vfxItem', () => {
  let player: Player;

  before(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  // composition生命周期开始后，会根据父子关系构建 itemTree
  it('build item tree', async () => {
    const items = [
      {
        'id': '3',
        'name': 'sprite_3',
        'duration': 5,
        'type': '1',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'options': {
            'startColor': [
              0.9725490196078431,
              0.00392156862745098,
              0.00392156862745098,
              1,
            ],
          },
          'renderer': {
            'renderMode': 1,
          },
          'positionOverLifetime': {
            'asMovement': true,
            'linearX': [
              6,
              [
                [
                  0,
                  -2,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  1,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'linearY': [
              6,
              [
                [
                  0,
                  -3,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  3,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'linearZ': [
              0,
              0,
            ],
            'asRotation': false,
            'orbitalX': [
              0,
              30,
            ],
            'orbitalY': [
              0,
              10,
            ],
            'orbitalZ': [
              6,
              [
                [
                  0.6,
                  0,
                  0,
                  -0.5087889084497375,
                ],
                [
                  1,
                  180,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'orbCenter': [
              0,
              1,
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
              6,
              [
                [
                  0,
                  1,
                  0,
                  -0.20351556337989518,
                ],
                [
                  1,
                  2,
                  -0.20351556337989501,
                  0,
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              6,
              [
                [
                  0,
                  1,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  2,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'y': [
              6,
              [
                [
                  0.6,
                  2,
                  0,
                  0.5087889084497375,
                ],
                [
                  1,
                  1,
                  0.508788908449736,
                  0,
                ],
              ],
            ],
          },
          'rotationOverLifetime': {
            'asRotation': true,
            'z': [
              6,
              [
                [
                  0,
                  0,
                  0,
                  -1.1378471272749235,
                ],
                [
                  0.2,
                  180,
                  0.8140789713468023,
                  -0.8686542781565569,
                ],
                [
                  0.4,
                  0,
                  1.0262827410807962,
                  0,
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              0,
              0,
            ],
          },
        },
        'transform': {
          'position': [
            0,
            -1.967841651887196,
            0,
          ],
          'rotation': [
            0,
            0,
            30,
          ],
          'scale': [
            2,
            1,
            1,
          ],
        },
      },
      {
        'id': '4',
        'name': 'sprite_4',
        'duration': 5,
        'type': '1',
        'parentId': '3',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'options': {
            'startColor': [
              0.3764705882352941,
              0.5568627450980392,
              0.8666666666666667,
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
            1.919288582623174,
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
      {
        'id': '7',
        'name': '火焰',
        'duration': 5,
        'type': '2',
        'parentId': '3',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'shape': {
            'shape': 'Cone',
            'radius': 0.1,
            'arc': 360,
            'angle': 10,
            'type': 2,
            'alignSpeedDirection': false,
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
            'maxCount': 50,
            'startLifetime': [
              4,
              [
                1.2,
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
                0.4,
                0.45,
              ],
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
            'particleFollowParent': true,
          },
          'renderer': {
            'renderMode': 0,
            'texture': 0,
            'blending': 0,
          },
          'emission': {
            'rateOverTime': [
              0,
              20,
            ],
          },
          'positionOverLifetime': {
            'startSpeed': [
              4,
              [
                1,
                1.4,
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
                  0.8088235294117646,
                  0,
                  0.9999953703918043,
                ],
                [
                  1,
                  2.5,
                  0.9999953703918034,
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
                  0.2435064935064935,
                  255,
                  145,
                  55,
                  255,
                ],
                [
                  0.3181818181818182,
                  255,
                  93,
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
          'textureSheetAnimation': {
            'col': 2,
            'row': 2,
          },
        },
        'transform': {
          'position': [
            0,
            -1.178928875011084,
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
      {
        'id': '10',
        'name': 'sprite_10',
        'duration': 5,
        'type': '1',
        'parentId': '8',
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
            -2.1880419439202354,
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
        'id': '8',
        'name': 'null_8',
        'duration': 5,
        'type': '3',
        'visible': true,
        'parentId': '3',
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
      {
        'id': '9',
        'name': 'interact_9',
        'type': '4',
        'visible': true,
        'parentId': '3',
        'duration': 1,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': [
            0,
            -2.157857579734369,
            0,
          ],
          'rotation': [
            0,
            0,
            0,
          ],
          'scale': [
            0.6,
            0.4,
            1,
          ],
        },
        'content': {
          'options': {
            'type': 0,
            'showPreview': true,
            'previewColor': [
              8,
              [
                255,
                255,
                255,
                1,
              ],
            ],
            'behavior': 0,
          },
        },
      },
    ];
    const comp = await player.loadScene(generateScene(items));

    player.gotoAndStop(0.1);
    const itemTree = comp.content.itemTree;
    const itemMap = comp.content.itemCacheMap;

    expect(itemTree.length).to.eql(1);
    expect(itemMap.size).to.eql(6);
    const nodeItem = itemTree[0];

    expect(nodeItem.id).to.eql('3');
    const child = itemMap.get('8');

    expect(child.children[0].id).to.eql('10');
    player.gotoAndStop(2);
    expect(itemMap.get('9')).to.eql(undefined);
  });

  // 根据父子关系给元素的 transform 设置正确的 parentTransform
  it('item has set the correct parentTransform', async () => {
    const items = [
      {
        'id': '3',
        'name': 'sprite_3',
        'duration': 5,
        'type': '1',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'options': {
            'startColor': [
              0.9725490196078431,
              0.00392156862745098,
              0.00392156862745098,
              1,
            ],
          },
          'renderer': {
            'renderMode': 1,
          },
          'positionOverLifetime': {
            'asMovement': true,
            'linearX': [
              6,
              [
                [
                  0,
                  -2,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  1,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'linearY': [
              6,
              [
                [
                  0,
                  -3,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  3,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'linearZ': [
              0,
              0,
            ],
            'asRotation': false,
            'orbitalX': [
              0,
              30,
            ],
            'orbitalY': [
              0,
              10,
            ],
            'orbitalZ': [
              6,
              [
                [
                  0.6,
                  0,
                  0,
                  -0.5087889084497375,
                ],
                [
                  1,
                  180,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'orbCenter': [
              0,
              1,
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
              6,
              [
                [
                  0,
                  1,
                  0,
                  -0.20351556337989518,
                ],
                [
                  1,
                  2,
                  -0.20351556337989501,
                  0,
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              6,
              [
                [
                  0,
                  1,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  2,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'y': [
              6,
              [
                [
                  0.6,
                  2,
                  0,
                  0.5087889084497375,
                ],
                [
                  1,
                  1,
                  0.508788908449736,
                  0,
                ],
              ],
            ],
          },
          'rotationOverLifetime': {
            'asRotation': true,
            'z': [
              6,
              [
                [
                  0,
                  0,
                  0,
                  -1.1378471272749235,
                ],
                [
                  0.2,
                  180,
                  0.8140789713468023,
                  -0.8686542781565569,
                ],
                [
                  0.4,
                  0,
                  1.0262827410807962,
                  0,
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              0,
              0,
            ],
          },
        },
        'transform': {
          'position': [
            0,
            -1.967841651887196,
            0,
          ],
          'rotation': [
            0,
            0,
            30,
          ],
          'scale': [
            2,
            1,
            1,
          ],
        },
      },
      {
        'id': '4',
        'name': 'sprite_4',
        'duration': 5,
        'type': '1',
        'parentId': '3',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'options': {
            'startColor': [
              0.3764705882352941,
              0.5568627450980392,
              0.8666666666666667,
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
            1.919288582623174,
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
      {
        'id': '7',
        'name': '火焰',
        'duration': 5,
        'type': '2',
        'parentId': '3',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'shape': {
            'shape': 'Cone',
            'radius': 0.1,
            'arc': 360,
            'angle': 10,
            'type': 2,
            'alignSpeedDirection': false,
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
            'maxCount': 50,
            'startLifetime': [
              4,
              [
                1.2,
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
                0.4,
                0.45,
              ],
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
            'particleFollowParent': true,
          },
          'renderer': {
            'renderMode': 0,
            'texture': 0,
            'blending': 0,
          },
          'emission': {
            'rateOverTime': [
              0,
              20,
            ],
          },
          'positionOverLifetime': {
            'startSpeed': [
              4,
              [
                1,
                1.4,
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
                  0.8088235294117646,
                  0,
                  0.9999953703918043,
                ],
                [
                  1,
                  2.5,
                  0.9999953703918034,
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
                  0.2435064935064935,
                  255,
                  145,
                  55,
                  255,
                ],
                [
                  0.3181818181818182,
                  255,
                  93,
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
          'textureSheetAnimation': {
            'col': 2,
            'row': 2,
          },
        },
        'transform': {
          'position': [
            0,
            -1.178928875011084,
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
      {
        'id': '10',
        'name': 'sprite_10',
        'duration': 5,
        'type': '1',
        'parentId': '8',
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
            -2.1880419439202354,
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
        'id': '8',
        'name': 'null_8',
        'duration': 5,
        'type': '3',
        'visible': true,
        'parentId': '3',
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
      {
        'id': '9',
        'name': 'interact_9',
        'type': '4',
        'visible': true,
        'parentId': '3',
        'duration': 5,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': [
            0,
            -2.157857579734369,
            0,
          ],
          'rotation': [
            0,
            0,
            0,
          ],
          'scale': [
            0.6,
            0.4,
            1,
          ],
        },
        'content': {
          'options': {
            'type': 0,
            'showPreview': true,
            'previewColor': [
              8,
              [
                255,
                255,
                255,
                1,
              ],
            ],
            'behavior': 0,
          },
        },
      },
    ];
    const comp = await player.loadScene(generateScene(items));

    player.gotoAndStop(0.1);
    const itemTree = comp.content.itemTree;

    expect(itemTree.length).to.eql(1);
    const nodeItem = itemTree[0];
    const nodeTransform = nodeItem.item.transform;

    nodeItem.children.map(child => {
      expect(child.item.transform.parentTransform).to.eql(nodeTransform);
    });
  });

  // 父元素销毁后，子元素的 parentTransform 变更为更上级的 transform
  it('item will be remove after ended', async () => {
    const items = [
      {
        'id': '3',
        'name': 'sprite_3',
        'duration': 3,
        'type': '1',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'options': {
            'startColor': [
              0.9725490196078431,
              0.00392156862745098,
              0.00392156862745098,
              1,
            ],
          },
          'renderer': {
            'renderMode': 1,
          },
          'positionOverLifetime': {
            'asMovement': true,
            'linearX': [
              6,
              [
                [
                  0,
                  -2,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  1,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'linearY': [
              6,
              [
                [
                  0,
                  -3,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  3,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'linearZ': [
              0,
              0,
            ],
            'asRotation': false,
            'orbitalX': [
              0,
              30,
            ],
            'orbitalY': [
              0,
              10,
            ],
            'orbitalZ': [
              6,
              [
                [
                  0.6,
                  0,
                  0,
                  -0.5087889084497375,
                ],
                [
                  1,
                  180,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'orbCenter': [
              0,
              1,
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
              6,
              [
                [
                  0,
                  1,
                  0,
                  -0.20351556337989518,
                ],
                [
                  1,
                  2,
                  -0.20351556337989501,
                  0,
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              6,
              [
                [
                  0,
                  1,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  2,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'y': [
              6,
              [
                [
                  0.6,
                  2,
                  0,
                  0.5087889084497375,
                ],
                [
                  1,
                  1,
                  0.508788908449736,
                  0,
                ],
              ],
            ],
          },
          'rotationOverLifetime': {
            'asRotation': true,
            'z': [
              6,
              [
                [
                  0,
                  0,
                  0,
                  -1.1378471272749235,
                ],
                [
                  0.2,
                  180,
                  0.8140789713468023,
                  -0.8686542781565569,
                ],
                [
                  0.4,
                  0,
                  1.0262827410807962,
                  0,
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              0,
              0,
            ],
          },
        },
        'transform': {
          'position': [
            0,
            -1.967841651887196,
            0,
          ],
          'rotation': [
            0,
            0,
            30,
          ],
          'scale': [
            2,
            1,
            1,
          ],
        },
      },
      {
        'id': '8',
        'name': 'null_8',
        'duration': 1,
        'type': '3',
        'visible': true,
        'parentId': '3',
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
      {
        'id': '9',
        'name': 'interact_9',
        'type': '4',
        'visible': true,
        'parentId': '8',
        'duration': 5,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': [
            0,
            -2.157857579734369,
            0,
          ],
          'rotation': [
            0,
            0,
            0,
          ],
          'scale': [
            0.6,
            0.4,
            1,
          ],
        },
        'content': {
          'options': {
            'type': 0,
            'showPreview': true,
            'previewColor': [
              8,
              [
                255,
                255,
                255,
                1,
              ],
            ],
            'behavior': 0,
          },
        },
      },
    ];
    const comp = await player.loadScene(generateScene(items));

    player.gotoAndStop(0.1);
    const itemTree = comp.content.itemTree;
    const itemMap = comp.content.itemCacheMap;
    const item3 = itemMap.get('3');
    const item8 = itemMap.get('8');
    const item9 = itemMap.get('9');

    expect(item9.item.parentId).to.eql('8');
    expect(item9.parentId).to.eql('8');
    expect(comp.getItemCurrentParent(item9.item)).to.eql(item8.item);
    expect(item9.item.transform.parentTransform).to.eql(item8.item.transform);
    expect(itemTree[0].id).to.eql('3');

    player.gotoAndStop(2.2);
    expect(item9.item.parentId).to.eql('8');
    expect(item9.parentId).to.eql('3');
    expect(comp.getItemCurrentParent(item9.item)).to.eql(item3.item);
    expect(item9.item.transform.parentTransform).to.eql(item3.item.transform);
    expect(itemTree[0].id).to.eql('3');

    player.gotoAndStop(4.1);
    expect(item9.item.parentId).to.eql('8');
    expect(item9.parentId).to.eql(undefined);
    expect(comp.getItemCurrentParent(item9.item)).to.eql(undefined);
    expect(item9.item.transform.parentTransform).to.eql(comp.transform);
    expect(item9).to.eql(comp.content.itemTree[0]);
    expect(itemTree[0].id).to.eql('9');
  });

  // 合成结束后清空itemTree and itemCacheMap
  it('itemTree and itemCacheMap will be empty after ended', async () => {
    const items = [
      {
        'id': '3',
        'name': 'sprite_3',
        'duration': 3,
        'type': '1',
        'visible': true,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'content': {
          'options': {
            'startColor': [
              0.9725490196078431,
              0.00392156862745098,
              0.00392156862745098,
              1,
            ],
          },
          'renderer': {
            'renderMode': 1,
          },
          'positionOverLifetime': {
            'asMovement': true,
            'linearX': [
              6,
              [
                [
                  0,
                  -2,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  1,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'linearY': [
              6,
              [
                [
                  0,
                  -3,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  3,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'linearZ': [
              0,
              0,
            ],
            'asRotation': false,
            'orbitalX': [
              0,
              30,
            ],
            'orbitalY': [
              0,
              10,
            ],
            'orbitalZ': [
              6,
              [
                [
                  0.6,
                  0,
                  0,
                  -0.5087889084497375,
                ],
                [
                  1,
                  180,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'orbCenter': [
              0,
              1,
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
              6,
              [
                [
                  0,
                  1,
                  0,
                  -0.20351556337989518,
                ],
                [
                  1,
                  2,
                  -0.20351556337989501,
                  0,
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              6,
              [
                [
                  0,
                  1,
                  0,
                  -0.5087889084497375,
                ],
                [
                  0.4,
                  2,
                  -0.508788908449736,
                  0,
                ],
              ],
            ],
            'y': [
              6,
              [
                [
                  0.6,
                  2,
                  0,
                  0.5087889084497375,
                ],
                [
                  1,
                  1,
                  0.508788908449736,
                  0,
                ],
              ],
            ],
          },
          'rotationOverLifetime': {
            'asRotation': true,
            'z': [
              6,
              [
                [
                  0,
                  0,
                  0,
                  -1.1378471272749235,
                ],
                [
                  0.2,
                  180,
                  0.8140789713468023,
                  -0.8686542781565569,
                ],
                [
                  0.4,
                  0,
                  1.0262827410807962,
                  0,
                ],
              ],
            ],
            'separateAxes': true,
            'x': [
              0,
              0,
            ],
          },
        },
        'transform': {
          'position': [
            0,
            -1.967841651887196,
            0,
          ],
          'rotation': [
            0,
            0,
            30,
          ],
          'scale': [
            2,
            1,
            1,
          ],
        },
      },
      {
        'id': '8',
        'name': 'null_8',
        'duration': 1,
        'type': '3',
        'visible': true,
        'parentId': '3',
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
      {
        'id': '9',
        'name': 'interact_9',
        'type': '4',
        'visible': true,
        'parentId': '8',
        'duration': 5,
        'endBehavior': 0,
        'delay': 0,
        'renderLevel': 'B+',
        'transform': {
          'position': [
            0,
            -2.157857579734369,
            0,
          ],
          'rotation': [
            0,
            0,
            0,
          ],
          'scale': [
            0.6,
            0.4,
            1,
          ],
        },
        'content': {
          'options': {
            'type': 0,
            'showPreview': true,
            'previewColor': [
              8,
              [
                255,
                255,
                255,
                1,
              ],
            ],
            'behavior': 0,
          },
        },
      },
    ];

    const comp = await player.loadScene(generateScene(items));

    player.gotoAndPlay(5);

    expect(comp.content.itemTree.length).to.eql(0);
    expect(comp.content.itemCacheMap.size).to.eql(0);
  });
});

const generateScene = items => ({
  'compositionId': 1,
  'requires': [],
  'compositions': [
    {
      'name': 'composition_1',
      'id': 1,
      'duration': 5,
      'endBehavior': 0,
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
  'version': '2.0',
  'shapes': [],
  'plugins': [],
  'type': 'mars',
  '_imgs': {
    '1': [],
  },
});
