import { getBackgroundImage, spec } from '@galacean/effects';
import { combineImageTemplate, Player } from '@galacean/effects';

const json =
  { 'playerVersion': { 'web': '2.0.0-alpha.27', 'native': '0.0.1.202311221223' }, 'images': [{ 'url': 'https://mdn.alipayobjects.com/graph_jupitercyc/uri/file/as/20240730121255232/4%2Bee6a6d29730e47e8966b74837597b688.png', 'webp': 'https://mdn.alipayobjects.com/graph_jupitercyc/uri/file/as/20240730121254883/4%2Bee6a6d29730e47e8966b74837597b688.webp', 'id': 'cd4e04706e6549cb92282d09f785c68f', 'renderLevel': 'B+' }], 'fonts': [{ 'fontFamily': 'AlibabaSans-Black', 'fontURL': 'https://mdn.alipayobjects.com/rms/uri/file/as/0.0.2/fonts/AlibabaSans-Black.ttf' }], 'version': '3.0', 'shapes': [], 'plugins': [], 'type': 'ge', 'compositions': [{ 'id': '4', 'name': '八个彩蛋(排版1)-t1', 'duration': 7.2, 'startTime': 0, 'endBehavior': 4, 'previewSize': [750, 1334], 'items': [{ 'id': 'ee6a6d29730e47e8966b74837597b688' }, { 'id': 'd883d98a0e864c1c86e8a28f0e7a2b10' }], 'camera': { 'fov': 38, 'far': 100, 'near': 0.1, 'clipMode': 0, 'position': [0, 0, 23], 'rotation': [0, 0, 0] }, 'sceneBindings': [{ 'key': { 'id': '70eeccfd99e04705a04233aa131de497' }, 'value': { 'id': 'ee6a6d29730e47e8966b74837597b688' } }, { 'key': { 'id': '9b035457a9444d3b8dcdfb5be5e91d8e' }, 'value': { 'id': 'd883d98a0e864c1c86e8a28f0e7a2b10' } }], 'timelineAsset': { 'id': '768a32ffd067425691c350d7c4a94bdd' } }], 'components': [{ 'id': '7e4884cf54f54f3aabeb192d92d3cbf6', 'item': { 'id': 'ee6a6d29730e47e8966b74837597b688' }, 'dataType': 'SpriteComponent', 'options': { 'startColor': [1, 1, 1, 1] }, 'renderer': { 'renderMode': 1, 'texture': { 'id': 'de3a35e60a184f0599423e1672492144' } }, 'splits': [[0, 0, 1, 1, 0]] }, { 'id': 'fc18b216299b4950a93d099895f3c968', 'item': { 'id': 'd883d98a0e864c1c86e8a28f0e7a2b10' }, 'dataType': 'TextComponent', 'options': { 'text': '财', 'fontFamily': 'AlibabaSans-Black', 'fontSize': 68, 'textColor': [255, 255, 255, 1], 'fontWeight': 'normal', 'letterSpace': 0, 'textAlign': 1, 'fontStyle': 'normal', 'autoWidth': false, 'textWidth': 128, 'textHeight': 107, 'lineHeight': 106.862, 'size': [1.5184228280043675, 1.2693065827849037] }, 'renderer': { 'renderMode': 1 } }], 'geometries': [], 'materials': [], 'items': [{ 'id': 'ee6a6d29730e47e8966b74837597b688', 'name': '财底色动效', 'duration': 1, 'type': '1', 'visible': true, 'endBehavior': 0, 'delay': 0.31, 'renderLevel': 'B+', 'components': [{ 'id': '7e4884cf54f54f3aabeb192d92d3cbf6' }], 'transform': { 'position': { 'x': 2.4, 'y': -2.8, 'z': 0 }, 'eulerHint': { 'x': 0, 'y': 0, 'z': 0 }, 'anchor': { 'x': 0, 'y': 0 }, 'size': { 'x': 1.5184, 'y': 1.5184 }, 'scale': { 'x': 1, 'y': 1, 'z': 1 } }, 'dataType': 'VFXItemData' }, { 'id': 'd883d98a0e864c1c86e8a28f0e7a2b10', 'name': '财', 'duration': 1, 'type': 'text', 'parentId': 'ee6a6d29730e47e8966b74837597b688', 'visible': true, 'endBehavior': 0, 'delay': 0.31, 'renderLevel': 'B+', 'transform': { 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'eulerHint': { 'x': 0, 'y': 0, 'z': 0 }, 'scale': { 'x': 1.5184, 'y': 1.2693, 'z': 1 } }, 'components': [{ 'id': 'fc18b216299b4950a93d099895f3c968' }], 'dataType': 'VFXItemData' }], 'shaders': [], 'bins': [], 'textures': [{ 'id': 'de3a35e60a184f0599423e1672492144', 'source': { 'id': 'cd4e04706e6549cb92282d09f785c68f' }, 'flipY': true }], 'animations': [], 'miscs': [{ 'id': '768a32ffd067425691c350d7c4a94bdd', 'dataType': 'TimelineAsset', 'tracks': [{ 'id': '70eeccfd99e04705a04233aa131de497' }, { 'id': '9b035457a9444d3b8dcdfb5be5e91d8e' }] }, { 'id': '8d12670e9e9d4333ad7e7e839456c4f1', 'dataType': 'ActivationPlayableAsset' }, { 'id': '6db7bc67ed884d13b4c5021e182c597e', 'dataType': 'TransformPlayableAsset', 'positionOverLifetime': { 'speedOverLifetime': [0, 0], 'asMovement': false, 'path': [22, [[[3, [0, 0.03, 0.2333333333333333, 0.27444]], [1, [0.4666666666666667, 0.6627200000000001, 0.7, 0.88, 0.7999999999999999, 0.97312]], [2, [0.9, 0.99806, 1, 1]]], [[-0.8, 6.8, 0], [0, -0.7, 0], [0, 0, 0]], [[0.8, 10, 0], [0.5, 3.547, 0], [0, -0.7, 0], [0, -0.7, 0]]]] }, 'sizeOverLifetime': { 'size': [21, [[3, [0, 0, 0.017766666666666667, 0.029396726666666668]], [1, [0.03553333333333333, 0.39865032666666667, 0.0533, 0.4443, 0.1896, 0.7945092199999999]], [1, [0.32589999999999997, 1, 0.4622, 1, 0.6414666666666666, 1]], [2, [0.8207333333333333, 0.9976846533333333, 1, 0.9998]]]] } }, { 'id': 'b8ff33e719c44dab8975f0aace9489c5', 'dataType': 'SpriteColorPlayableAsset', 'startColor': [1, 1, 1, 1] }, { 'id': '24186adc26da42d588847dfca6288bdf', 'dataType': 'ActivationTrack', 'children': [], 'clips': [{ 'start': 0.31, 'duration': 1, 'endBehavior': 0, 'asset': { 'id': '8d12670e9e9d4333ad7e7e839456c4f1' } }] }, { 'id': 'ae76e3e4f99340c9b4e556c4b011b9bf', 'dataType': 'TransformTrack', 'children': [], 'clips': [{ 'start': 0.31, 'duration': 1, 'endBehavior': 0, 'asset': { 'id': '6db7bc67ed884d13b4c5021e182c597e' } }] }, { 'id': '75a3591b648042d081181ac2d099886b', 'dataType': 'SpriteColorTrack', 'children': [], 'clips': [{ 'start': 0.312, 'duration': 1, 'endBehavior': 0, 'asset': { 'id': 'b8ff33e719c44dab8975f0aace9489c5' } }] }, { 'id': '70eeccfd99e04705a04233aa131de497', 'dataType': 'ObjectBindingTrack', 'children': [{ 'id': '24186adc26da42d588847dfca6288bdf' }, { 'id': 'ae76e3e4f99340c9b4e556c4b011b9bf' }, { 'id': '75a3591b648042d081181ac2d099886b' }], 'clips': [] }, { 'id': '06866822495e4a69a7a66793e0f36002', 'dataType': 'ActivationPlayableAsset' }, { 'id': '91003f02655c450a8db75f4eaa39ed94', 'dataType': 'TransformPlayableAsset', 'positionOverLifetime': {} }, { 'id': '0ebc56e082c24b32a23c0e541afbb566', 'dataType': 'SpriteColorPlayableAsset', 'colorOverLifetime': { 'opacity': [21, [[4, [0.000002399999999513902, 1]], [4, [6.0000024, 0]]]] } }, { 'id': '81b2d0a4e4014ae5b8affd5c968dc6b1', 'dataType': 'ActivationTrack', 'children': [], 'clips': [{ 'start': 0.31, 'duration': 1, 'endBehavior': 0, 'asset': { 'id': '06866822495e4a69a7a66793e0f36002' } }] }, { 'id': '8d8ef69c793e48c5aa4f0c8d4fb5c068', 'dataType': 'TransformTrack', 'children': [], 'clips': [{ 'start': 0.31, 'duration': 1, 'endBehavior': 0, 'asset': { 'id': '91003f02655c450a8db75f4eaa39ed94' } }] }, { 'id': '644d50b1c09542c18b80ba50c0e4e336', 'dataType': 'SpriteColorTrack', 'children': [], 'clips': [{ 'start': 0.31, 'duration': 1, 'endBehavior': 0, 'asset': { 'id': '0ebc56e082c24b32a23c0e541afbb566' } }] }, { 'id': '9b035457a9444d3b8dcdfb5be5e91d8e', 'dataType': 'ObjectBindingTrack', 'children': [{ 'id': '81b2d0a4e4014ae5b8affd5c968dc6b1' }, { 'id': '8d8ef69c793e48c5aa4f0c8d4fb5c068' }, { 'id': '644d50b1c09542c18b80ba50c0e4e336' }], 'clips': [] }], 'compositionId': '4' };
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });
    // const image1 = new Image();

    // image1.src = 'https://mdn.alipayobjects.com/graph_jupitercyc/uri/file/as/20240730121255232/4%2Bee6a6d29730e47e8966b74837597b688.png';

    const template: spec.TemplateContent = {
      variables: {
        '123': 'https://mdn.alipayobjects.com/graph_jupitercyc/uri/file/as/20240730121255232/4%2Bee6a6d29730e47e8966b74837597b688.png',
      },
      background: {
        type: spec.BackgroundType.image,
        name: '123',
        url: 'https://mdn.alipayobjects.com/mars/afts/img/A*GohLSYmgvVAAAAAAAAAAAAAADlB4AQ/original',
      },
      width: 128,
      height: 128,
    };

    // const image = await combineImageTemplate('https://mdn.alipayobjects.com/mars/afts/img/A*GohLSYmgvVAAAAAAAAAAAAAADlB4AQ/original', template, template.variables);
    const a = getBackgroundImage(template, template.variables);

    // 获取HTML文档中的容器
    // const container1 = document.getElementById('image-container');

    // 将Image对象添加到容器中
    // container1.appendChild(image);
    await player.loadScene(json);

    // player.gotoAndStop(0.31);
  } catch (e) {
    console.error('biz', e);
  }
})();
