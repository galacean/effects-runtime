// @ts-nocheck
import { Player } from '@galacean/effects';

const { expect } = chai;

// 滤镜相关
describe('adjust sprite', () => {
  let player;

  before(() => {
    const canvas = document.createElement('canvas');
    const renderOptions = {
      canvas,
      pixelRatio: 1,
      manualRender: true,
    };

    player = new Player({ ...renderOptions });
  });

  after(() => {
    player && player.dispose();
  });

  // TODO 滤镜调整好之后修改
  // it('adjust layer load as sprite', async () => {
  //   const items = [
  //     {
  //       "id": "4",
  //       "name": "sprite_220",
  //       "duration": 2,
  //       "type": "1",
  //       "visible": true,
  //       "endBehavior": 5,
  //       "delay": 0,
  //       "renderLevel": "B+",
  //       "content": {
  //         "options": {
  //           "startColor": [ 1, 1, 1, 1 ] },
  //         "renderer": {
  //           "renderMode": 1
  //         },
  //         "positionOverLifetime": {
  //           "direction": [ 0, 0, 0 ], "startSpeed": 0, "gravity": [ 0, 0, 0 ], "gravityOverLifetime": [ 0, 1 ] },
  //         "rotationOverLifetime": {
  //           "asRotation": true,
  //           "separateAxes": false,
  //           "z": [ 5, [ [ 0, 0 ], [ 1, 360 ] ] ]
  //         }
  //       },
  //       "transform": {
  //         "position": [ 0, 2.5872925266749514, 0 ], "rotation": [ 0, 0, 0 ], "scale": [ 1.2, 1.2, 1 ]
  //       }
  //     },
  //     {
  //       "id": "6",
  //       "name": "layer",
  //       "duration": 5,
  //       "type": "8",
  //       "visible": true,
  //       "endBehavior": 4,
  //       "delay": 0,
  //       "renderLevel": "B+",
  //       "content": {
  //         "options": {},
  //         "filter": {
  //           "name": "delay"
  //         },
  //         "renderer": {
  //           "renderMode": 1
  //         },
  //         "positionOverLifetime": { "path": [ 2, [ 0, 0, 0 ] ] }
  //       },
  //       "transform": {
  //         "position": [ 0, 1.2782249109984056, 0 ], "rotation": [ 0, 0, 0 ], "scale": [ 7.305026993685699, 7.305026993685699, 1 ]
  //       }
  //     },
  //     {
  //       "id": "5",
  //       "name": "sprite_5",
  //       "duration": 2,
  //       "type": "1",
  //       "visible": true,
  //       "endBehavior": 5,
  //       "delay": 0,
  //       "renderLevel": "B+",
  //       "content": {
  //         "options": {
  //           "startColor": [ 1, 1, 1, 1 ]
  //         },
  //         "renderer": {
  //           "renderMode": 1,
  //           "texture": 0,
  //           "blending": 0,
  //           "side": 1032,
  //           "occlusion": false,
  //           "transparentOcclusion": false,
  //           "maskMode": 0
  //         },
  //         "positionOverLifetime": {
  //           "direction": [ 0, 0, 0 ], "startSpeed": 0, "gravity": [ 0, 0, 0 ], "gravityOverLifetime": [ 0, 1 ] }, "splits": [ [ 0.00390625, 0.00390625, 0.69921875, 0.7578125, 0 ] ]
  //       },
  //       "transform": {
  //         "position": [ 0, 0, 0 ], "rotation": [ 0, 0, 0 ], "scale": [ 2.204708227945438, 2.3894603140861137, 1 ]
  //       }
  //     }
  //   ]
  //   const comp = await loadSceneAndPlay(player, items);
  //   const item = comp.getItemByName('layer');
  //   expect(item).to.be.instanceof(FilterSpriteVFXItem);
  //   expect(item.type).to.eql(spec.ItemType.filter);
  //   expect(item.duration).to.eql(5);
  //   expect(item.content.renderInfo.filter).to.exist;
  //   const spriteGroup = comp.loaderData.spriteGroup;
  //   expect(spriteGroup.meshSplits.length).to.eql(3);
  //   console.log(comp.renderFrame.renderPasses);
  //   expect(comp.renderFrame.renderPasses.length).to.eql(3);
  //   expect(comp.renderFrame.renderPasses[ 0 ].meshes.length).to.eql(1);
  //   expect(comp.renderFrame.renderPasses[ 1 ].meshes.length).to.eql(3);
  //   expect(comp.renderFrame.renderPasses[ 1 ].meshes[ 0 ].name).to.eql('mars-internal-copy')
  // });
  //
  // it('two gaussian filters', async () => {
  //   const scene = await player.loadScene({
  //     'compositionId': 1,
  //     'requires': [],
  //     'compositions': [{
  //       'name': 'composition_1',
  //       'id': 1,
  //       'duration': 5,
  //       'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
  //       'items': [{
  //         'name': 'item_1',
  //         'delay': 0,
  //         'id': 2,
  //         'type': '1',
  //         'ro': 0.01,
  //         'sprite': {
  //           'options': {
  //             'startLifetime': 2,
  //             'startSize': 1.2,
  //             'sizeAspect': 1,
  //             'startColor': ['color', [255, 255, 255]],
  //             'duration': 2,
  //             'gravityModifier': 1,
  //             'renderLevel': 'B+',
  //           }, 'renderer': { 'renderMode': 1 },
  //         },
  //       }, {
  //         'name': 'item_1',
  //         'delay': 0,
  //         'id': 1,
  //         'type': '1',
  //         'ro': 0.01,
  //         'sprite': {
  //           'options': {
  //             'startLifetime': 2,
  //             'startSize': 1.2,
  //             'sizeAspect': 1,
  //             'startColor': ['color', [255, 255, 255]],
  //             'duration': 2,
  //             'gravityModifier': 1,
  //             'renderLevel': 'B+',
  //           },
  //           'renderer': { 'renderMode': 1 },
  //           'transform': { 'position': [-1.0772052115122615, 1.3465064843262695, -0.0000023182466755145015] },
  //         },
  //       }, {
  //         'name': 'filter_1',
  //         'delay': 0,
  //         'id': 4,
  //         'type': '8',
  //         'content': {
  //           'options': { 'duration': 5, 'startSize': 2, 'sizeAspect': 1, 'renderLevel': 'B+' },
  //           'renderer': { 'renderMode': 0 },
  //           'filter': { 'name': 'gaussian', 'radius': 20, 'blend': 1 },
  //           'transform': { 'position': [0.45356045356159624, -0.24095407117305978, -0.000009272994651254862] },
  //         },
  //         'duration': 5,
  //       }, {
  //         'name': 'filter_2',
  //         'delay': 0,
  //         'id': 3,
  //         'type': '8',
  //         'content': {
  //           'options': {
  //             'duration': 5,
  //             'startSize': 1.585321033079053,
  //             'sizeAspect': 1,
  //             'renderLevel': 'B+',
  //           },
  //           'renderer': { 'renderMode': 0 },
  //           'filter': { 'name': 'gaussian', 'radius': 20, 'blend': 1 },
  //           'transform': { 'position': [-0.6945143311611293, 0.9354681363764307, -0.000006954744002030111] },
  //         },
  //         'duration': 5,
  //       }],
  //       'meta': { 'previewSize': [750, 1334] },
  //     }],
  //     'gltf': [],
  //     'images': [],
  //     'version': '0.9.0',
  //     'shapes': [],
  //     'plugins': [],
  //     'type': 'mars',
  //     '_imgs': { '1': [] },
  //   });
  //   const comp = await player.play(scene);
  //   const frame = comp.renderFrame;
  //   expect(frame._defRenderPasses.length).to.eql(3);
  //   expect(frame._defRenderPasses[ 0 ].attachments[ 0 ].texture.name).to.eql('frame_a');
  //   expect(frame._defRenderPasses[ 1 ].attachments[ 0 ].texture.name).to.eql('frame_b');
  //   expect(frame._defRenderPasses[ 2 ].attachments[ 0 ].texture.name).to.eql('frame_a');
  //   const rp = frame.renderPasses[ frame.renderPasses.indexOf(frame._defRenderPasses[ 2 ]) - 1 ];
  //   expect(rp.name).to.eql('gaussianV');
  //   const shaderId = spriteMeshShaderIdFromRenderInfo(comp.getItemByName('filter_2').content.renderInfo, 2);
  //   expect(player.renderer.shaderLibrary.shaderResults[ shaderId ]).to.contains({ shared: true, status: 1 })
  //   expect(frame.findPreviousDefaultRenderPass(rp)).to.eql(frame._defRenderPasses[ 1 ]);
  // })

});
