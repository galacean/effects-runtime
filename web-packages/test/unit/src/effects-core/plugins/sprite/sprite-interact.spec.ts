// @ts-nocheck
import { Player, EVENT_TYPE_CLICK, math, spec } from '@galacean/effects';
import { loadSceneAndPlay } from './utils';

const { Vector3 } = math;
const { expect } = chai;

describe('sprite interaction', async () => {
  const canvas = document.createElement('canvas');
  const width = 512, height = 512;

  canvas.width = width;
  canvas.height = height;
  let hitSuccess = false, hitPositions = []; // 测试是否点击中华 点击中的位置
  let player, x, y;
  const bounding = canvas.getBoundingClientRect();

  before(() => {
    const renderOptions = {
      canvas,
      pixelRatio: 1,
      manualRender: true,
      interactive: true, // player交互开启
      onItemClicked: props => {
        hitSuccess = true;
        hitPositions = props.hitPositions;
      },
    };

    player = new Player({ ...renderOptions });
  });

  after(() => {
    player?.dispose();
    player = null;
  });

  // 图层交互 模拟编辑器 使用force属性
  it('sprite hit test with force', async () => {
    const size = 1;
    const aspect = 2;
    const json = `[{"id":"1","name":"sprite_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[${[size + 0.001, (size + 0.001) / aspect, 1]}]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), { currentTime:0.01 });
    const width = size, height = size / aspect;
    const vp = comp.camera.getInverseViewProjectionMatrix(); // 屏幕转世界坐标
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];

    edgePoints.map(p => {
      const inPos = vp.projectPoint(Vector3.fromArray([p[0], p[1], 0]), new Vector3());
      const res = comp.hitTest(inPos.x, inPos.y, true);

      expect(res.length).to.eql(1);
    });
    const outPos = vp.projectPoint(Vector3.fromArray([width / 2 + 0.2, height / 2 + 0.2]), new Vector3());

    comp.event.dispatchEvent(EVENT_TYPE_CLICK, { x: outPos.x, y: outPos.y });
    expect(hitSuccess).to.be.false;
  });

  // 背面剔除
  it('sprite hit test with backfaceCulling', async () => {
    const json = `[{"id":"1","name":"sprite_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":${spec.SideMode.FRONT},"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":1}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json));

    comp.camera.fov = 30;
    comp.camera.far = 20;
    comp.camera.near = 0.1;
    comp.camera.position = [0, 0, -8];
    comp.camera.clipMode = 1;
    const hitList = [
      {
        position: [0, 0],
        success: false,
      },
      {
        position: [285, 280],
        success: false,
      },
    ];

    hitList.map(hit => {
      x = ((hit.position[0] - bounding.left) / width) * 2 - 1, y = 1 - ((hit.position[1] - bounding.top) / height) * 2, player.event.dispatchEvent(EVENT_TYPE_CLICK, {
        x, y, vx: 0, vy: 0, ts: Date.now(), dx: 0, dy: 0, width, height, player, origin: {},
      });
      expect(hitSuccess).to.eql(hit.success);
    });
  });

  // 没有force参数、元素未开启interact属性
  it('sprite hit test without force and interact', async () => {
    const json = '[{"id":"13","name":"item_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}}]';
    const comp = await loadSceneAndPlay(player, JSON.parse(json), {
      currentTime: 0.05,
    });
    const item = comp.getItemByName('item_1');
    const vp = comp.camera.getViewProjectionMatrix();
    const pos = item.getCurrentPosition();
    const inPos = vp.projectPoint(pos, new Vector3());

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(inPos.x, inPos.y, false);

      expect(regions.length).to.eql(0);
    });

    const outPos = pos.add([1, 1, 0]);

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(outPos.x, outPos.y, false);

      expect(regions.length).to.eql(0);
    });
  });

  // 点击交互触发onItemClick回调
  it('sprite hit test behavior notify', async () => {
    const json = `[{"id":"1","name":"item_33","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":${spec.InteractBehavior.NOTIFY}}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1.2,1.2,1]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), {
      currentTime: 0.05,
    });
    const item = comp.getItemByName('item_33');
    const vp = comp.camera.getViewProjectionMatrix();
    const pos = item.getCurrentPosition().toArray();
    const inPos = vp.projectPoint(pos, new Vector3());

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(inPos.x, inPos.y, false);

      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];

        expect([region.position.x, region.position.y]).to.eql([inPos.x, inPos.y]);
        const b = region.behavior;

        expect(b).to.eql(spec.InteractBehavior.NOTIFY);
      }
    });
  });

  // 点击交互触发恢复播放回调
  it('sprite hit test behavior resume player', async () => {
    const renderOptions = {
      canvas,
      pixelRatio: 1,
      interactive: true, // player交互开启
      onItemClicked: props => {
        hitSuccess = true;
        hitPositions = props.hitPositions;
      },
    };

    player = new Player({ ...renderOptions });
    const json = `[{"id":"1","name":"item_33","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":${spec.InteractBehavior.RESUME_PLAYER}}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1.2,1.2,1]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json));

    player.pause();
    expect(player.paused).to.be.true;
    const item = comp.getItemByName('item_33');
    const vp = comp.camera.getViewProjectionMatrix();
    const pos = item.getCurrentPosition();
    const inPos = vp.projectPoint(pos, new Vector3());

    player.handleClick({ x: inPos.x, y: inPos.y });
    window.setTimeout(() => {
      expect(player.paused).to.be.false;
    }, 4);
  });

  // 元素旋转
  it('sprite hit test rotate', async () => {
    const json1 = `[{"id":"1","name":"item_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":${spec.InteractBehavior.NOTIFY}}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[2,4,1]}}]`;
    const json2 = `[{"id":"1","name":"item_2","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":${spec.InteractBehavior.NOTIFY}}},"transform":{"position":[0,0,0],"rotation":[0,0,90],"scale":[2,4,1]}}]`;
    const comp1 = await loadSceneAndPlay(player, JSON.parse(json1), {
      currentTime: 0.01,
    });
    const vp = comp1.camera.getInverseViewProjectionMatrix();
    const inPos = vp.projectPoint(Vector3.fromArray([0, 1.8, 0]), new Vector3());

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(inPos.x, inPos.y, true);

      expect(regions.length).to.not.eql(0);
    });

    const comp2 = await loadSceneAndPlay(player, JSON.parse(json2), {
      currentTime: 0.01,
    });
    const vp2 = comp2.camera.getInverseViewProjectionMatrix();
    const inPos2 = vp2.projectPoint(Vector3.fromArray([0, 1.8, 0]), new Vector3());

    player.compositions.forEach(comp => {
      const regions = comp.hitTest(inPos2.x, inPos2.y, false);

      expect(regions.length).to.eql(1);
    });
  });

  // 编辑器画布transform
  it('sprite hit test with editor transform', async () => {
    const json = `[{"id":"1","name":"item_2","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":${spec.InteractBehavior.NOTIFY}}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[2,2,1]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), {
      currentTime: 0.1,
    });
    const dx = 0.3, dy = 1, scale = 1.2;

    comp.setEditorTransform(scale, dx, dy);
    const vp = comp.camera.getViewProjectionMatrix();
    const inPos = vp.projectPoint(Vector3.fromArray([0, 0, 0]), new Vector3());

    comp.event.dispatchEvent(EVENT_TYPE_CLICK, { x: scale * inPos.x + dx, y: scale * inPos.y + dy });
    expect(hitSuccess).to.be.true;
  });

  // 元素生命周期开始前点击
  it('sprite hit test before lifetime begin', async () => {
    const json = `[{"id":"1","name":"item_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":1,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":${spec.InteractBehavior.NOTIFY}}},"transform":{"position":[0,0,0],"rotation":[0,0,90],"scale":[2,4,1]}},{"id":"1","name":"item_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":${spec.InteractBehavior.NOTIFY}}},"transform":{"position":[0,0,0],"rotation":[0,0,90],"scale":[2,4,1]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), {
      currentTime: 0.5,
    });
    const vp = comp.camera.getViewProjectionMatrix();
    const inPos = vp.projectPoint(Vector3.fromArray([0, 0, 0]), new Vector3());
    const ret = comp.hitTest(inPos.x, inPos.y, true);

    expect(ret.length).to.eql(1);
  });

  // 跳过指定元素
  it('sprite hit test with skip function', async () => {
    const json = `[{"id":"1","name":"item_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":1,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"interaction":{"behavior":${spec.InteractBehavior.NOTIFY}}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1.2,1.2,1]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), {
      currentTime: 0.1,
    });
    const skip = item => item.name === 'item_1';
    const vp = comp.camera.getViewProjectionMatrix();
    const inPos = vp.projectPoint(Vector3.fromArray([0, 0, 0]), new Vector3());
    const ret = comp.hitTest(inPos.x, inPos.y, false, { skip });

    expect(ret.length).to.eql(0);
  });

  // 元素size变换
  it('sprite hit test with sizeOverLifetime', async () => {
    const size = 1, aspect = 2, currentTime = 1, duration = 2;
    const json = `[{"id":"1","name":"item_1","duration":${duration},"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"sizeOverLifetime":{"size":[5,[[0,0.5],[1,1]]],"separateAxes":false}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[${[(size + 0.001), (size + 0.001) / aspect, 1]}]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), { currentTime });
    const width = size * (0.5 + 0.5 * currentTime / duration), height = width / aspect;
    const vp = comp.camera.getInverseViewProjectionMatrix();
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];

    edgePoints.map(p => {
      const inPos = vp.projectPoint(Vector3.fromArray([p[0], p[1], 0]), new Vector3());
      const res = comp.hitTest(inPos.x, inPos.y, true);

      expect(res.length).to.eql(1);
    });
  });

  // 父元素速度变换
  it('sprite hit test with parent velocityOverLifetime', async () => {
    const size = 1, aspect = 1, currentTime = 1, duration = 2;
    const json = `[{"id":"1","name":"sprite_1","duration":${duration},"type":"1","parentId":"2","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[${[(size + 0.001), (size + 0.001) / aspect, 1]}]}},{"id":"2","name":"null_2","duration":${duration},"type":"3","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"positionOverLifetime":{"asMovement":false,"linearX":[0,0.2],"linearY":[5,[[0,0],[1,1]]],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"speedOverLifetime":[0,0]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), { currentTime });
    const width = size, height = width / aspect;
    const vp = comp.camera.getViewProjectionMatrix();
    const edgePoints = [[width / 2, height / 2], [-width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];

    edgePoints.map(p => {
      const inPos = vp.projectPoint(
        Vector3.fromArray([p[0] + 0.2 * currentTime, p[1] + currentTime * currentTime / 2 / duration, 0]), new Vector3()
      );
      const res = comp.hitTest(inPos.x, inPos.y, true);

      expect(res.length).to.eql(1);
    });
  });

  // 元素锚点变换
  it('sprite hit test with anchor change', async () => {
    const size = 1, aspect = 0.5;
    const json = `[{"id":"1","name":"sprite_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"anchor":[0,0],"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"sizeOverLifetime":{"size":[0,2],"separateAxes":false},"interaction":{"behavior":1}},"transform":{"position":[0,0,0],"rotation":[0,0,-90],"scale":[${[(size + 0.001), (size + 0.001) / aspect, 1]}]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), { currentTime:0.01 });
    const vp = comp.camera.getViewProjectionMatrix();
    const edgePoints = [[1.49, 1.99], [1.49, 1.01], [-0.49, 1.01], [-0.49, 1.99]];

    edgePoints.map(p => {
      const inPos = vp.projectPoint(Vector3.fromArray([p[0], p[1], 0]), new Vector3());
      const res = comp.hitTest(inPos.x, inPos.y, true);

      expect(res.length).to.eql(1);
    });
  });

  // 锚点变换和父元素尺寸变换
  it('sprite hit test with anchor change and parent scale', async () => {
    const json = '[{"id":"1","name":"sprite_1","duration":2,"type":"1","parentId":"2","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"anchor":[0,0],"renderMode":1},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,-90],"scale":[1,2,1]}},{"id":"2","name":"null_2","duration":2,"type":"3","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"sizeOverLifetime":{"size":[0,2],"separateAxes":false}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}}]';
    const comp = await loadSceneAndPlay(player, JSON.parse(json), { currentTime:0.01 });
    const vp = comp.camera.getViewProjectionMatrix();
    const edgePoints = [[2.99, 3.99], [2.99, 2.01], [-0.99, 2.01], [-0.99, 3.99]];

    edgePoints.map(p => {
      const inPos = vp.projectPoint(Vector3.fromArray([p[0], p[1], 0]), new Vector3());
      const res = comp.hitTest(inPos.x, inPos.y, true);

      expect(res.length).to.eql(1);
    });
  });

  // 在元素同时被点击
  it('hit with different positions', async () => {
    const size = 1, aspect = 1;
    const json = `[{"id":"1","name":"sprite_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"anchor":[0,0],"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"sizeOverLifetime":{"size":[0,2],"separateAxes":false},"interaction":{"behavior":1}},"transform":{"position":[0.2,0,2],"rotation":[0,0,0],"scale":[${[(size + 0.001), (size + 0.001) / aspect, 1]}]}},{"id":"2","name":"sprite_2","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"anchor":[0,0],"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"sizeOverLifetime":{"size":[0,2],"separateAxes":false},"interaction":{"behavior":1}},"transform":{"position":[0.5,0,0],"rotation":[0,0,0],"scale":[${[(size + 0.001), (size + 0.001) / aspect, 1]}]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), { currentTime:0.01 });
    const vp = comp.camera.getViewProjectionMatrix();
    const point = vp.projectPoint(new Vector3());
    const res = comp.hitTest(point.x, point.y, true);

    expect(res.length).to.eql(2);
    expect(res[1].position.toArray()).to.deep.equals([0, 0, 0]);
    expect(res[0].position.toArray()).to.deep.equals([0, 0, 2]);
  });
});
