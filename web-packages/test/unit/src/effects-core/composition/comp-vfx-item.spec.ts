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
                  'texture': 0,
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
