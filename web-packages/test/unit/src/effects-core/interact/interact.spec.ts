// @ts-nocheck
import { Player, EVENT_TYPE_CLICK, spec, math } from '@galacean/effects';
const { Vector3 } = math;

const { expect } = chai;

describe('interact item', () => {
  let player: Player;
  const canvas = document.createElement('canvas');
  const width = 512, height = 512;

  canvas.width = width;
  canvas.height = height;
  let clicked = false, messagePhrase = undefined, hitPositions = [];
  const config = {
    canvas,
    pixelRatio: 1,
    interactive: true,
    onItemClicked: data => {
      clicked = true;
      hitPositions = data.hitPositions;
    },
    onMessageItem: data => {
      messagePhrase = data.phrase;
    },
  };

  beforeEach(() => {
    player = new Player({ ...config });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('click item', async () => {
    const width = 1;
    const height = 1;
    const items = [
      {
        'name': 'ui_10',
        'delay': 0,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': width + 0.1,
            'height': height + 0.1,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
          'transform': { 'position': [0, 0, 0] },
        },
      },
    ];

    const composition = await generateComposition(items, player, {});
    const vp = composition.camera.getViewProjectionMatrix();
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];

    clicked = false;
    edgePoints.forEach(p => {
      const inPos = vp.projectPoint(new Vector3(p[0], p[1], 0), new Vector3());

      composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: inPos.x, y: inPos.y });
      expect(clicked).to.be.true;
      clicked = false;
    });
    const outPos = vp.projectPoint(new Vector3(width / 2 + 0.2, height / 2 + 0.2), new Vector3());

    composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: outPos.x, y: outPos.y });
    expect(clicked).to.be.false;
  });

  it('click item transform by parent', async () => {
    const width = 1;
    const height = 2;
    const items = [
      {
        'name': 'null_15',
        'delay': 0,
        'id': 16,
        'cal': {
          'options': {
            'duration': 2,
            'startSize': 1,
            'sizeAspect': 1,
            'relative': true,
            'renderLevel': 'B+',
            'looping': true,
          },
          'transform': {
            'position': [-1, 1, 0],
            'rotation': [
              0,
              0,
              90,
            ],
          },
        },
      },
      {
        'name': 'ui_14',
        'delay': 0,
        'id': 15,
        'parentId': 16,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': width + 0.01,
            'height': height + 0.01,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
        },
      },
    ];
    const composition = await generateComposition(items, player, {});
    const vp = composition.camera.getViewProjectionMatrix();
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];

    clicked = false;
    edgePoints.forEach(p => {
      const inPos = vp.projectPoint(new Vector3(p[1] - 1, p[0] + 1, 0), new Vector3());
      const outPos = vp.projectPoint(new Vector3(p[0] - 1, p[1] + 1, 0), new Vector3());

      composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: outPos.x, y: outPos.y });
      expect(clicked).to.be.false;
      composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: inPos.x, y: inPos.y });
      expect(clicked).to.be.true;
      clicked = false;
    });
  });

  it('click rotate and transform item', async () => {
    const items = [
      {
        'name': 'ui_10',
        'delay': 0,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': 1,
            'height': 1,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
          'transform': {
            'position': [1, 1, 0],
            'rotation': [0, 0, 45],
          },
        },
      },
    ];
    const composition = await generateComposition(items, player, {});
    const vp = composition.camera.getViewProjectionMatrix();
    const inPos = vp.projectPoint(new Vector3(1, 1, 0), new Vector3());

    clicked = false;
    composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: inPos.x, y: inPos.y });
    expect(clicked).to.be.true;
    clicked = false;
    const outPos = vp.projectPoint(new Vector3(0.5, 0.5, 0), new Vector3());

    composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: outPos.x, y: outPos.y });
    expect(clicked).to.be.false;
  });

  it('click item with camera model', async () => {
    const items = [
      {
        'name': '3DModel_1',
        'delay': 0,
        'id': 2,
        'type': '6',
        'model': {
          'options': {
            'type': 1,
            'duration': 5,
            'near': 0.1,
            'far': 20,
            'fov': 30,
            'renderLevel': 'B+',
          },
          'transform': { 'position': [0, 0, 8] },
          'velocityOverLifetime': { 'translateX': ['lines', [[0, 0], [1, 3]]] },
        },
      },
      {
        'name': 'ui',
        'delay': 0,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': 1,
            'height': 1,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
        },
      },
    ];
    // 相机位置改变 不用世界坐标作为点击点 用屏幕坐标作为点击测试点
    const composition = await generateScene(items, player);

    player.gotoAndPlay(0.1);

    clicked = false;
    composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: 0, y: 0 });
    expect(clicked).to.be.true;
    player.gotoAndPlay(2.0);
    clicked = false;
    composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: 0, y: 0 });
    expect(clicked).to.be.false;
  });

  it('click item with editor transform', async () => {
    const width = 1, height = 2;
    const items = [
      {
        'name': 'ui_10',
        'delay': 0,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': width + 0.01,
            'height': height + 0.01,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
          'transform': { 'position': [0, 0, 0] },
        },
      },
    ];
    const composition = await generateComposition(items, player, {});
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];
    const vp = composition.camera.getViewProjectionMatrix();
    const dx = 0.5, dy = 0.3, scale = 0.5;

    composition.setEditorTransform(scale, dx, dy);
    edgePoints.forEach(p => {
      clicked = false;
      const inPos = vp.projectPoint(new Vector3(p[0], p[1], 0), new Vector3());

      composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: scale * inPos.x + dx, y: scale * inPos.y + dy });
      expect(clicked).to.be.true;
    });
  });

  it('click item overlapping', async () => {
    const width = 1;
    const height = 1;
    const items = [
      {
        'name': 'ui_10',
        'delay': 0,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': width + 0.01,
            'height': height + 0.01,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
          'transform': { 'position': [0, 0, 0] },
        },
      },
      {
        'name': 'ui_1',
        'delay': 0,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': width + 0.01,
            'height': height + 0.01,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
          'transform': { 'position': [0.5, 0, 0] },
        },
      },
    ];
    const composition = await generateComposition(items, player, { currentTime: 1 });
    const vp = composition.camera.getViewProjectionMatrix();
    const edgePoints = [[0, height / 2], [width / 2, height / 2], [0, -height / 2], [width / 2, -height / 2]];

    edgePoints.forEach(p => {
      const inPos = vp.projectPoint(new Vector3(p[0], p[1], 0), new Vector3());

      composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: inPos.x, y: inPos.y });
      expect(hitPositions.length).to.eql(2);
    });
  });

  it('click item before lifetime begin', async () => {
    const width = 1;
    const height = 1;
    const items = [
      {
        'name': 'ui_10',
        'delay': 2,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': width + 0.1,
            'height': height + 0.1,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
          'transform': { 'position': [0, 0, 0] },
        },
      },
    ];
    const composition = await generateComposition(items, player, { currentTime: 1 });
    const vp = composition.camera.getViewProjectionMatrix();
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];

    edgePoints.forEach(p => {
      clicked = false;
      const inPos = vp.projectPoint(new Vector3(p[0], p[1], 0), new Vector3());

      composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: inPos.x, y: inPos.y });
      expect(clicked).to.be.false;
    });
  });

  it('click item with skip function', async () => {
    const width = 1;
    const height = 1;
    const items = [
      {
        'name': 'ui_10',
        'delay': 0,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': width + 0.1,
            'height': height + 0.1,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
          'transform': { 'position': [0, 0, 0] },
        },
      },
      {
        'name': 'ui_2',
        'delay': 0,
        'id': 11,
        'ui': {
          'options': {
            'duration': 2,
            'type': 'click',
            'width': width + 0.1,
            'height': height + 0.1,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
          'transform': { 'position': [0, 0, 0] },
        },
      },
    ];
    const composition = await generateComposition(items, player, {});
    const skipFunc = item => item.name === 'ui_10';
    const vp = composition.camera.getViewProjectionMatrix();
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];

    edgePoints.forEach(p => {
      const inPos = vp.projectPoint(new Vector3(p[0], p[1], 0), new Vector3());

      const ret = composition.hitTest(inPos.x, inPos.y, false, { skip: skipFunc });

      expect(ret.length).to.eql(1);
    });
  });

  it('click item with parent velocityOverLifetime', async () => {
    const width = 1, height = 2, currentTime = 0.3, duration = 2;
    const items = [
      {
        'name': 'null_15',
        'delay': 0,
        'id': 16,
        'cal': {
          'options': {
            'duration': duration,
            'startSize': 1,
            'sizeAspect': 1,
            'relative': true,
            'renderLevel': 'B+',
            'looping': true,
          },
          'velocityOverLifetime': {
            'asMovement': false,
            'linearX': 0.2,
            'linearY': [
              'lines',
              [
                [
                  0,
                  0,
                ],
                [
                  1,
                  1,
                ],
              ],
            ],
          },
        },
      },
      {
        'name': 'ui_14',
        'delay': 0,
        'id': 15,
        'parentId': 16,
        'ui': {
          'options': {
            'duration': duration,
            'type': 'click',
            'width': width + 0.01,
            'height': height + 0.01,
            'showPreview': true,
            'previewColor': ['color', [224, 17, 17, 1]],
          },
        },
      },
    ];
    const composition = await generateComposition(items, player, { currentTime });
    const vp = composition.camera.getViewProjectionMatrix();
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];

    clicked = false;
    edgePoints.forEach(p => {
      const inPos = vp.projectPoint(new Vector3(p[0] + 0.2 * currentTime, p[1] + currentTime * currentTime / 2 / duration, 0), new Vector3());
      const outPos = vp.projectPoint(new Vector3(p[1] + 0.2 * currentTime, p[0] + currentTime * currentTime / 2 / duration, 0), new Vector3());

      composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: outPos.x, y: outPos.y });
      expect(clicked).to.be.false;
      composition.event.dispatchEvent(EVENT_TYPE_CLICK, { x: inPos.x, y: inPos.y });
      expect(clicked).to.be.true;
      clicked = false;
    });
  });

  it('message item', async () => {
    const items = [
      {
        'name': 'ui_11',
        'delay': 0,
        'id': 12,
        'ui': {
          'options': {
            'duration': 1,
            'type': 'message',
            'width': 0.6,
            'height': 0.4,
            'showPreview': true,
          },
        },
      },
    ];

    const scene = await generateScene(items, player);

    player.gotoAndPlay(0.1);
    expect(messagePhrase).to.eql(spec.MESSAGE_ITEM_PHRASE_BEGIN, 'MESSAGE_ITEM_PHRASE_BEGIN');
    player.gotoAndPlay(1.1);

    expect(messagePhrase).to.eql(spec.MESSAGE_ITEM_PHRASE_END, 'MESSAGE_ITEM_PHRASE_END');

  });

  it('prevent event if clicked', async () => {
    const container = document.createElement('div');

    container.style.width = '200px';
    container.style.height = '200px';
    document.body.appendChild(container);
    const spy = chai.spy('player-clicked');

    player.dispose();
    player = null;
    player = new Player({
      container,
      interactive: true,
      onItemClicked () {
        spy();
      },
    });
    await player.createComposition({ 'images': [], 'spines': [], 'version': '1.5', 'shapes': [], 'plugins': [], 'type': 'mars', 'compositions': [{ 'id': '3', 'name': '点击', 'duration': 5, 'startTime': 0, 'endBehavior': 1, 'previewSize': [750, 1624], 'items': [{ 'id': '1', 'name': 'sprite_1', 'duration': 2, 'type': '1', 'visible': true, 'endBehavior': 0, 'delay': 0, 'renderLevel': 'B+', 'content': { 'options': { 'startColor': [0.9411764705882353, 0.027450980392156862, 0.027450980392156862, 1] }, 'renderer': { 'renderMode': 1 }, 'positionOverLifetime': { 'direction': [0, 0, 0], 'startSpeed': 0, 'gravity': [0, 0, 0], 'gravityOverLifetime': [0, 1] } }, 'transform': { 'position': [0, 0, 0], 'rotation': [0, 0, 0], 'scale': [10.571346913648894, 10.571346913648894, 1] } }, { 'id': '2', 'name': 'interact_2', 'duration': 2, 'type': '4', 'visible': true, 'endBehavior': 0, 'delay': 0, 'renderLevel': 'B+', 'content': { 'options': { 'type': 0, 'showPreview': true, 'previewColor': [8, [255, 255, 255, 1]], 'behavior': 0 } }, 'transform': { 'position': [-0.03922057358071454, 0, 0], 'rotation': [0, 0, -0.23899999999999172], 'scale': [17.999999999999996, 12, 1] } }], 'camera': { 'fov': 60, 'far': 40, 'near': 0.1, 'position': [0, 0, 8], 'rotation': [0, 0, 0], 'clipMode': 1 } }], 'requires': [], 'compositionId': '3', 'bins': [], 'textures': [] });

    container.style.position = 'relative';

    const cvsBounding = player.canvas.getBoundingClientRect();

    expect(cvsBounding.width).to.be.closeTo(200, 0.0001);
    expect(cvsBounding.height).to.be.closeTo(200, 0.0001);
    const clickSpy = chai.spy('first-click');

    container.addEventListener('mouseup', clickSpy);
    const eventArg = {
      cancelable: true,
      bubbles: true,
      clientX: cvsBounding.left + cvsBounding.width / 2,
      clientY: cvsBounding.top + cvsBounding.height / 2,
    };

    player.canvas.dispatchEvent(new MouseEvent('mouseup', eventArg));
    expect(clickSpy).to.has.been.called.once;
    player.gotoAndPlay(0.01);
    player.canvas.dispatchEvent(new MouseEvent('mousedown', eventArg));
    const mouseUpEvent = new MouseEvent('mouseup', eventArg);

    player.canvas.dispatchEvent(mouseUpEvent);
    expect(spy).to.has.been.called.once;
    expect(mouseUpEvent.defaultPrevented).to.be.true;
    expect(clickSpy).to.has.been.called.once;
  });

  after(() => {
    player && player.dispose();
    player = null;
  });
});

function generateScene (items, player) {
  const json = {
    'compositionId': 5,
    'requires': [],
    'compositions': [
      {
        'name': '1',
        'id': 5,
        'duration': 5,
        'camera': {
          'fov': 60,
          'far': 20,
          'near': 2,
          'position': [0, 0, 8],
          'clipMode': 0,
          'z': 8,
        },
        'items': items,
        'meta': {
          'previewSize': [
            0,
            0,
          ],
        },
      },
    ],
    'gltf': [],
    'images': [
      'https://gw.alipayobjects.com/zos/gltf-asset/mars-cli/POLXSVXJBMPG/1891211877-da663.png',
    ],
    'version': '0.1.47',
    'shapes': [],
    'plugins': [],
    'type': 'mars',
    '_imgs': {
      '5': [
        0,
      ],
    },
    'imageTags': [
      'B+',
    ],
  };

  return player.createComposition(json);
}

async function generateComposition (items, player, playerOptions) {
  const scene = await generateScene(items, player);

  await player.gotoAndPlay(0.01 + (playerOptions.currentTime ?? 0));

  return scene;
}
