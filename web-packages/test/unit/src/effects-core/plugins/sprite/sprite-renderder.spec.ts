// @ts-nocheck
import { Player, spec, glContext } from '@galacean/effects';
import { loadSceneAndPlay } from './utils';

const { expect } = chai;

// JSON中的sprite renderer属性设置
describe('sprite renderer params', () => {
  let player;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
    });
  });

  after(() => {
    player.dispose();
  });

  // 渲染模式
  it('sprite render mode', async () => {
    const json = '[{"id":"11","name":"vertical_billboard","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":2,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.0078125,0.0078125,0.6015625,0.6015625,0]]},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}},{"id":"13","name":"mesh","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.0078125,0.0078125,0.6015625,0.6015625,0]]},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}},{"id":"9","name":"horizon_billboard","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":3,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.0078125,0.0078125,0.6015625,0.6015625,0]]},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}},{"id":"15","name":"billboard","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":0,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.0078125,0.0078125,0.6015625,0.6015625,0]]},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}}]';
    const comp = await loadSceneAndPlay(player, JSON.parse(json));
    const billboardIndex = comp.items.indexOf(comp.getItemByName('billboard'));
    const meshIndex = comp.items.indexOf(comp.getItemByName('mesh'));
    const verticalIndex = comp.items.indexOf(comp.getItemByName('vertical_billboard'));
    const horizonIndex = comp.items.indexOf(comp.getItemByName('horizon_billboard'));
    const material = comp.loaderData.spriteGroup.meshSplits[0].spriteMesh.mesh.material;
    const texData = material.getVector4Array('uTexParams');

    expect(texData).to.be.an.instanceOf(Array);
    expect(texData[billboardIndex * 4 + 2]).to.eql(spec.RenderMode.BILLBOARD);
    expect(texData[meshIndex * 4 + 2]).to.eql(spec.RenderMode.MESH);
    expect(texData[verticalIndex * 4 + 2]).to.eql(spec.RenderMode.VERTICAL_BILLBOARD);
    expect(texData[horizonIndex * 4 + 2]).to.eql(spec.RenderMode.HORIZONTAL_BILLBOARD);
  });

  // 混合模式
  it('sprite blending mode', async () => {
    const json = '[{"id":"1","name":"normal","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.00390625,0.00390625,0.5859375,0.5859375,0]]},"transform":{"position":[0,7.876629181287445,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"3","name":"additive","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":1,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.00390625,0.00390625,0.5859375,0.5859375,0]]},"transform":{"position":[-0.03454661921617208,1.5681900222830336e-15,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"5","name":"multiply","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":2,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.00390625,0.00390625,0.5859375,0.5859375,0]]},"transform":{"position":[3.6604951035974387,3.558301779265817,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"7","name":"brightness","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":3,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.00390625,0.00390625,0.5859375,0.5859375,0]]},"transform":{"position":[0,-4.629246974967181,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"9","name":"subtract","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":4,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.00390625,0.00390625,0.5859375,0.5859375,0]]},"transform":{"position":[-3.6950417228136154,3.558301779265817,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"11","name":"strong_light","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":5,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.00390625,0.00390625,0.5859375,0.5859375,0]]},"transform":{"position":[-3.660495103597441,-0.5354725978506812,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"13","name":"weak_light","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":6,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.00390625,0.00390625,0.5859375,0.5859375,0]]},"transform":{"position":[0,3.523755160049643,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"15","name":"superposition","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":7,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.00390625,0.00390625,0.5859375,0.5859375,0]]},"transform":{"position":[3.2128355871040917,-2.1418903914027303,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}}]';
    const comp = await loadSceneAndPlay(player, JSON.parse(json));
    const alphaItem = comp.getItemByName('normal').content;
    const alphaMaterial = comp.loaderData.spriteGroup.getSpriteMesh(alphaItem).mesh.material;
    const alphaData = alphaMaterial.getVector4Array('uTexParams');

    const alphaState = alphaMaterial.glMaterialState;

    expect(alphaState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(alphaState.blending).to.be.true;
    expect(alphaState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA]);
    expect(alphaData[1]).to.deep.equal(1, 'alpha');

    const additiveItem = comp.getItemByName('additive').content;
    const additiveMaterial = comp.loaderData.spriteGroup.getSpriteMesh(additiveItem).mesh.material;
    const additiveData = additiveMaterial.getVector4Array('uTexParams');

    const additiveState = additiveMaterial.glMaterialState;

    expect(additiveState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(additiveState.blending).to.be.true;
    expect(additiveState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE]);
    expect(additiveData[1]).to.deep.equal(1);

    const subtractionItem = comp.getItemByName('subtract').content;
    const subtractionMaterial = comp.loaderData.spriteGroup.getSpriteMesh(subtractionItem).mesh.material;
    const subtractionData = subtractionMaterial.getVector4Array('uTexParams');

    const subtractionState = subtractionMaterial.glMaterialState;

    expect(subtractionState.blendEquationParameters).to.eql([glContext.FUNC_REVERSE_SUBTRACT, glContext.FUNC_REVERSE_SUBTRACT]);
    expect(subtractionState.blending).to.be.true;
    expect(subtractionState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ZERO, glContext.ONE]);
    expect(subtractionData[1]).to.deep.equal(1);

    const multiplyItem = comp.getItemByName('multiply').content;
    const multiplyMaterial = comp.loaderData.spriteGroup.getSpriteMesh(multiplyItem).mesh.material;
    const multiplyData = multiplyMaterial.getVector4Array('uTexParams');
    const multiplyState = multiplyMaterial.glMaterialState;

    expect(multiplyState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(multiplyState.blending).to.be.true;
    expect(multiplyState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA, glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA]);

    expect(multiplyData[1]).to.deep.equal(0);

    const brightnessItem = comp.getItemByName('brightness').content;
    const brightnessMaterial = comp.loaderData.spriteGroup.getSpriteMesh(brightnessItem).mesh.material;
    const brightnessData = brightnessMaterial.getVector4Array('uTexParams');
    const brightnessState = brightnessMaterial.glMaterialState;

    expect(brightnessState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(brightnessState.blending).to.be.true;
    expect(brightnessState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA]);

    expect(brightnessData[1]).to.deep.equal(3);

    const strongLightItem = comp.getItemByName('strong_light').content;
    const strongLightMaterial = comp.loaderData.spriteGroup.getSpriteMesh(strongLightItem).mesh.material;
    const strongLightData = strongLightMaterial.getVector4Array('uTexParams');

    const strongLightState = strongLightMaterial.glMaterialState;

    expect(strongLightState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(strongLightState.blending).to.be.true;
    expect(strongLightState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.DST_ALPHA, glContext.ZERO, glContext.ONE]);
    expect(strongLightData[1]).to.deep.equal(1);

    const weakLightItem = comp.getItemByName('weak_light').content;
    const weakLightMaterial = comp.loaderData.spriteGroup.getSpriteMesh(weakLightItem).mesh.material;
    const weakLightData = weakLightMaterial.getVector4Array('uTexParams');
    const weakLightState = weakLightMaterial.glMaterialState;

    expect(weakLightState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(weakLightState.blending).to.be.true;
    expect(weakLightState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.ZERO, glContext.ZERO, glContext.ONE]);
    expect(weakLightData[1]).to.deep.equal(1);

    const superpositionItem = comp.getItemByName('superposition').content;
    const superpositionMaterial = comp.loaderData.spriteGroup.getSpriteMesh(superpositionItem).mesh.material;
    const superpositionData = superpositionMaterial.getVector4Array('uTexParams');
    const superpositionState = superpositionMaterial.glMaterialState;

    expect(superpositionState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(superpositionState.blending).to.be.true;
    expect(superpositionState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE]);
    expect(superpositionData[1]).to.deep.equal(2);
  });

  // 深度遮挡和透明遮挡
  it('sprite occlusion', async () => {
    const json = '[{"id":"3","name":"default","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0,"texture":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.298828125,0.484375,0.29296875,0.29296875,0]]},"transform":{"position":[0,0.9327587188366713,0],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"1","name":"occlusion","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":true,"transparentOcclusion":true,"maskMode":0,"texture":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.001953125,0.484375,0.29296875,0.29296875,0]]},"transform":{"position":[0,0.034546619216176966,1],"rotation":[0,0,0],"scale":[1.8475208614067902,1.8475208614067884,1]}},{"id":"4","name":"transparent_occlusion","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"side":1032,"occlusion":true,"transparentOcclusion":true,"maskMode":0,"texture":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.001953125,0.001953125,0.78125,0.478515625,0]]},"transform":{"position":[0,-1.6625560497783196,3],"rotation":[0,0,0],"scale":[4.926722297084771,3.0176174069644226,1]}}]';
    const comp = await loadSceneAndPlay(player, JSON.parse(json));

    const defaultMaterial = comp.loaderData.spriteGroup.meshSplits[0].spriteMesh.mesh.material;
    const defaultData = defaultMaterial.getVector4Array('uTexParams');
    const defaultState = defaultMaterial.glMaterialState;

    expect(defaultState.depthMask).to.be.false;

    expect([defaultData[0], defaultData[1], defaultData[2], defaultData[3]]).to.eql([1, 1, 1, 0]);

    const depthTestMaterial = comp.loaderData.spriteGroup.meshSplits[1].spriteMesh.mesh.material;

    expect(depthTestMaterial.glMaterialState.depthMask).to.be.true;

    const depthTestData = depthTestMaterial.getVector4Array('uTexParams');

    expect([depthTestData[4], depthTestData[5], depthTestData[6], depthTestData[7]]).to.eql([1, 1, 1, 0]);
  });

  // 正反面显示
  it('sprite side show', async () => {
    const json = '[{"id":"1","name":"both","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.001953125,0.001953125,0.814453125,0.251953125,0]]},"transform":{"position":[0,-3.109195729455571,0],"rotation":[0,0,0],"scale":[5.136107994710873,1.5888679408098392,1]}},{"id":"3","name":"front","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1028,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.001953125,0.001953125,0.814453125,0.251953125,0]]},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[5.136107994710873,1.5888679408098392,1]}},{"id":"5","name":"back","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1029,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"splits":[[0.001953125,0.001953125,0.814453125,0.251953125,0]]},"transform":{"position":[0,4.041954448292242,0],"rotation":[0,-180,0],"scale":[5.136107994710873,1.5888679408098392,1]}}]';
    const comp = await loadSceneAndPlay(player, JSON.parse(json));

    const bothMaterial = comp.loaderData.spriteGroup.meshSplits[0].spriteMesh.mesh.material;

    expect(bothMaterial.glMaterialState.culling).to.be.false;

    const frontMaterial = comp.loaderData.spriteGroup.meshSplits[1].spriteMesh.mesh.material;

    expect(frontMaterial.glMaterialState.culling).to.be.true;
    expect(frontMaterial.glMaterialState.cullFace).to.eql(glContext.FRONT);
    expect(frontMaterial.glMaterialState.frontFace).to.eql(glContext.CW);

    const backMaterial = comp.loaderData.spriteGroup.meshSplits[2].spriteMesh.mesh.material;

    expect(backMaterial.glMaterialState.culling).to.be.true;
    expect(backMaterial.glMaterialState.cullFace).to.eql(glContext.BACK);
    expect(backMaterial.glMaterialState.frontFace).to.eql(glContext.CW);
  });

  // 蒙板
  it('sprite mask mode', async () => {
    const json = '[{"id":"1","name":"default","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,0],"scale":[8.328878074885855,8.000969489260429,1]}},{"id":"3","name":"write","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":1},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[2.590996441212991,-2.4182633451321074,0],"rotation":[0,0,0],"scale":[2.4264137706001514,2.426413770600153,1]}},{"id":"11","name":"read","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":2},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[-2.038250533754174,-2.4528099643482797,0],"rotation":[0,0,0],"scale":[2.4264137706001514,2.426413770600153,1]}},{"id":"13","name":"write_inverse","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"texture":0,"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":3},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[2.1764370106189204,2.2109836298350833,0],"rotation":[0,0,0],"scale":[2.4264137706001514,2.426413770600153,1]}}]';
    const comp = await loadSceneAndPlay(player, JSON.parse(json));
    const unsetMaterial = comp.loaderData.spriteGroup.meshSplits[0].spriteMesh.mesh.material;

    expect(unsetMaterial.glMaterialState.stencilTest).to.be.false;

    const writeMaterial = comp.loaderData.spriteGroup.meshSplits[1].spriteMesh.mesh.material;
    const writeState = writeMaterial.glMaterialState;

    expect(writeState.stencilTest).to.be.true;
    expect(writeState.stencilFunc).to.deep.equal([glContext.ALWAYS, glContext.ALWAYS]);
    expect(writeState.stencilMask).to.deep.equal([0xFF, 0xFF]);
    expect(writeState.stencilOpFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(writeState.stencilOpZFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(writeState.stencilOpZPass).to.deep.equal([glContext.REPLACE, glContext.REPLACE]);

    const readMaterial = comp.loaderData.spriteGroup.meshSplits[2].spriteMesh.mesh.material;
    const readState = readMaterial.glMaterialState;

    expect(readState.stencilFunc).to.deep.equal([glContext.EQUAL, glContext.EQUAL]);
    expect(readState.stencilMask).to.deep.equal([0xFF, 0xFF]);

    const readInverseMaterial = comp.loaderData.spriteGroup.meshSplits[3].spriteMesh.mesh.material;
    const readInverseState = readInverseMaterial.glMaterialState;

    expect(readInverseState.stencilFunc).to.deep.equal([glContext.NOTEQUAL, glContext.NOTEQUAL]);
    expect(readInverseState.stencilMask).to.deep.equal([0xFF, 0xFF]);
  });

  // 锚点
  it('sprite anchor', async () => {
    const anchor = [0.3, 0.2];
    const currentTime = 1;
    const json = `[{"id":"1","name":"sprite_1","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"anchor":[${anchor}],"blending":0,"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[2,0,0],"rotation":[0,0,30],"scale":[3,3,1]}}]`;
    const comp = await loadSceneAndPlay(player, JSON.parse(json), {
      currentTime,
    });
    const spriteItem = comp.getItemByName('sprite_1').content;
    const renderData = spriteItem.getRenderData(currentTime);
    const {
      transform,
      startSize,
    } = renderData;
    const a = transform.anchor.toArray();
    const pos = transform.getWorldPosition().toArray();

    expect(a[0]).to.be.closeTo((anchor[0] - 0.5) * 3, 0.0001);
    expect(a[1]).to.be.closeTo((0.5 - anchor[1]) * 3, 0.0001);
    expect([startSize.x, startSize.y]).to.eql([3, 3]);
    expect(pos[0]).to.be.closeTo(1.47, 0.001);
    expect(pos[1]).to.be.closeTo(-0.179, 0.001);
    expect(pos[2]).to.be.closeTo(0, 0.001);
  });

  // 形状随初始大小改变
  it('sprite shape affected by startSize', async () => {
    const size = [3, 3, 1];
    const json = `{"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*RwX8SqbAZZoAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UBY5SIBoRVgAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"spines":[],"version":"1.5","plugins":[],"type":"mars","compositions":[{"id":"13","name":"测试合成","duration":5,"startTime":0,"endBehavior":5,"previewSize":[750,713],"items":[{"id":"4","name":"sprite_4","duration":2,"type":"1","visible":true,"endBehavior":5,"delay":0,"renderLevel":"B+","content":{"options":{"startColor":[1,1,1,1]},"renderer":{"renderMode":1,"blending":0,"anchor":[0.5,0.5],"side":1032,"occlusion":false,"transparentOcclusion":false,"maskMode":0,"shape":0},"positionOverLifetime":{"direction":[0,0,0],"startSpeed":0,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}},"transform":{"position":[0,0,0],"rotation":[0,0,30],"scale":[${size}]}}],"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"rotation":[0,0,0],"clipMode":1}}],"requires":[],"compositionId":"13","bins":[],"textures":[{"source":0,"flipY":true}],"shapes":[{"g":{"p":[[-0.9414225941422594,-0.01673640167364021,-0.8715036751506441,-0.08823007109299462,-0.7954940646704395,0.017974753394899463],[0.7824267782426779,0.39330543933054396,0.6448440412318716,0.3605794484881677,0.7110519023739642,0.271216835870902],[-0.012552301255230103,-0.9665271966527196,0.0537039760638169,-0.8415867879939453,-0.11143258475963827,-0.86541987973605]],"s":[[0,1],[0,1],[0,1]]}}]}`;
    const currentTime = 0.5;
    const comp = await player.loadScene(JSON.parse(json));

    player.gotoAndPlay(currentTime);
    const spriteItem = comp.getItemByName('sprite_4').content;
    const mesh = comp.loaderData.spriteGroup.getSpriteMesh(spriteItem);
    const aPointData = mesh.getItemGeometryData(spriteItem, 0).aPoint;

    expect(aPointData[0]).to.closeTo(-0.9414 / 2 * size[0], 0.0001);
    expect(aPointData[1]).to.closeTo(-0.0167 / 2 * size[1], 0.0001);
  });
});

