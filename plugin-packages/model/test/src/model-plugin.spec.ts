/* eslint-disable @typescript-eslint/quotes */
import type { HitTestBoxParams, HitTestSphereParams } from '@galacean/effects';
import { Player, HitTestType, spec, math } from '@galacean/effects';
import { generateComposition } from './utilities';

const { Vector3 } = math;
const { expect } = chai;

const player = new Player({
  canvas: document.createElement('canvas'),
  manualRender: true,
});

describe('需要关闭 WebGL Spector', () => {
  it('遇到 global leak(s) detected 错误时', () => { });
});

describe('mode plugin test', () => {
  it('parent affects 3d item position', async () => {
    const scene = {
      "compositionId": 1,
      "requires": [],
      "compositions": [{
        "name": "composition_1",
        "id": 1,
        "duration": 5,
        "camera": { "fov": 30, "far": 20, "near": 0.1, "position": [0, 0, 8], "clipMode": 1 },
        "items": [{
          "name": "null_1",
          "delay": 0,
          "id": "2",
          "cal": {
            "options": { "duration": 2, "startSize": 1, "sizeAspect": 1, "relative": true, "renderLevel": "B+" },
            "transform": { "path": ["bezier", [[[0.15, 0.15, 1, 1], [0.75, 0.75, 1, 1]], [[0, 0, 0], [3, 0, 0]], [[1, 0, 0], [2, 0, 0]]]] },
          },
        }, {
          "name": "camera",
          "delay": 0,
          "type": "camera",
          "duration": 5,
          "id": 1,
          "parentId": "2",
          "ro": 0.01,
          pn: 0,
          transform: {
            position: [0, 0, 8],
          },
          content: {
            options: {
              near: 0.1,
              far: 60,
              fov: 45,
              clipMode: 0,
              duration: 5,
            },
          },
        }],
        "meta": { "previewSize": [750, 1624] },
      }],
      "gltf": [],
      "images": [],
      "version": "0.8.10-beta.4",
      "shapes": [],
      "plugins": ["model"],
      "_imgs": { "1": [] },
    };
    const comp = await generateComposition(player, scene, {}, { autoplay: false });
    const cameraItem = comp.getItemByName('camera')!;
    let pos = cameraItem.transform.position;

    expect(pos.toArray()).to.deep.equal([0, 0, 8]);
    expect(cameraItem.duration).to.eql(5);
    comp.gotoAndStop(1.9);
    pos = cameraItem.transform.position;

    const cp = new Vector3();

    cameraItem.transform.assignWorldTRS(cp);
    expect(cp.toArray()).to.deep.equal([3, 0, 8]);
    comp.dispose();
  });

  it('3d item get sphere bounding', async () => {
    const scene = {
      "compositionId": 1,
      "requires": [],
      "compositions": [{
        "name": "composition_1",
        "id": 1,
        "duration": 5,
        "camera": { "fov": 30, "far": 20, "near": 0.1, "position": [0, 0, 8], "clipMode": 1 },
        "items": [{
          "name": "null_1",
          "delay": 0,
          "id": "2",
          "cal": {
            "options": { "duration": 2, "startSize": 1, "sizeAspect": 1, "relative": true, "renderLevel": "B+" },
            "transform": { "path": ["bezier", [[[0.15, 0.15, 1, 1], [0.75, 0.75, 1, 1]], [[0, 0, 0], [3, 0, 0]], [[1, 0, 0], [2, 0, 0]]]] },
          },
        }, {
          "name": "camera",
          "delay": 0,
          "type": "camera",
          "duration": 5,
          "id": 1,
          "parentId": "2",
          "ro": 0.01,
          pn: 0,
          transform: {
            position: [0, 0, 0],
          },
          content: {
            options: {
              near: 0.1,
              far: 60,
              fov: 45,
              clipMode: 0,
              duration: 5,
            },
            interaction: {
              type: spec.ModelBoundingType.sphere,
              radius: 0.2,
              center: [0, 0, 0],
              behavior: spec.InteractBehavior.NOTIFY,
            },
          },
        }],
        "meta": { "previewSize": [750, 1624] },
      }],
      "gltf": [],
      "images": [],
      "version": "0.8.10-beta.4",
      "shapes": [],
      "plugins": ["model"],
      "_imgs": { "1": [] },
    };
    const comp = await generateComposition(player, scene, {}, { pauseOnFirstFrame: true });
    const cameraItem = comp.getItemByName('camera');
    let p = cameraItem?.getHitTestParams(true);

    if (p !== undefined) {
      if (p.type === HitTestType.custom) {
        const ret = comp.hitTest(0, 0, true);

        expect(ret[0]).to.exist;
        expect(ret[0].name === 'camera');
      } else if (p.type === HitTestType.sphere) {
        expect(p.center.toArray()).to.deep.equal([0, 0, 0]);
        expect(p.radius).to.eql(0.2);
        const ret = comp.hitTest(0, 0, true);

        expect(ret[0]).to.exist;
        expect(ret[0].name === 'camera');

        comp.gotoAndPlay(1.9);
        p = cameraItem!.getHitTestParams(true) as HitTestSphereParams;

        expect(p.center.toArray()).to.deep.equal([3, 0, 0]);
        expect(p.radius).to.eql(0.2);
        expect(comp.hitTest(0, 0, true)).to.be.an('array').length(0);
      }
    }
  });

  it('3d item get box bounding', async () => {
    const scn = {
      "compositionId": 1,
      "requires": [],
      "compositions": [{
        "name": "composition_1",
        "id": 1,
        "duration": 5,
        "camera": { "fov": 30, "far": 20, "near": 0.1, "position": [0, 0, 8], "clipMode": 1 },
        "items": [{
          "name": "null_1",
          "delay": 0,
          "id": "2",
          "cal": {
            "options": { "duration": 2, "startSize": 1, "sizeAspect": 1, "relative": true, "renderLevel": "B+" },
            "transform": { "path": ["bezier", [[[0.15, 0.15, 1, 1], [0.75, 0.75, 1, 1]], [[0, 0, 0], [3, 0, 0]], [[1, 0, 0], [2, 0, 0]]]] },
          },
        }, {
          "name": "camera",
          "delay": 0,
          "type": "camera",
          "duration": 5,
          "id": 1,
          "parentId": "2",
          "ro": 0.01,
          pn: 0,
          transform: {
            position: [0, 0, 0],
          },
          content: {
            options: {
              near: 0.1,
              far: 60,
              fov: 45,
              clipMode: 0,
              duration: 5,
            },
            interaction: {
              type: spec.ModelBoundingType.box,
              size: [0.2, 0.2, 0.2],
              center: [0, 0, 0],
              behavior: spec.InteractBehavior.NOTIFY,
            },
          },
        }],
        "meta": { "previewSize": [750, 1624] },
      }],
      "gltf": [],
      "images": [],
      "version": "0.8.10-beta.4",
      "shapes": [],
      "plugins": ["model"],
      "_imgs": { "1": [] },
    };
    const comp = await generateComposition(player, scn, {}, { pauseOnFirstFrame: true });
    const cameraItem = comp.getItemByName('camera');
    let p = cameraItem?.getHitTestParams(true);

    if (p !== undefined) {
      if (p.type === HitTestType.custom) {
        const ret = comp.hitTest(0, 0, true);

        expect(ret[0]).to.exist;
        expect(ret[0].name === 'camera');
      } else if (p.type === HitTestType.box) {
        expect(p.center).to.deep.equal([0, 0, 0]);
        expect(p.size).to.eql([0.2, 0.2, 0.2]);
        const ret = comp.hitTest(0, 0, true);

        expect(ret[0]).to.exist;
        expect(ret[0].name === 'camera');
        // @ts-expect-error
        comp.forwardTime(1.9);
        p = cameraItem?.getHitTestParams(true) as HitTestBoxParams;
        expect(p.center).to.deep.equal([3, 0, 0]);
        expect(p.size).to.eql([0.2, 0.2, 0.2]);
        expect(comp.hitTest(0, 0, true)).to.be.an('array').length(0);
      }
    }
  });
});
