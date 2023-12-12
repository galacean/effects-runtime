// @ts-nocheck
import { Player, spec, Texture, TextureSourceType, imageDataFromGradient, glContext, math } from '@galacean/effects';

const { Vector2 } = math;
const { expect } = chai;

describe('effects-core/plugins/particle-test', function () {
  this.timeout('60s');

  let player;
  const canvas = document.createElement('canvas');

  beforeEach(() => {
    player = new Player({ canvas: canvas, manualRender: true });
  });

  after(() => {
    player.dispose();
    player = null;
  });

  it('load particle mesh with priority', async () => {
    const json = '[{"name":"item_2","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":0,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"None"},"options":{"startLifetime":1.2,"startSize":0.2,"sizeAspect":1,"startSpeed":1,"startColor":[8,[255,255,255]],"duration":2,"maxCount":18,"renderLevel":"B+"},"emission":{"rateOverTime":5},"trails":{"lifetime":1,"maxPointPerTrail":12,"widthOverTrail":0.1,"minimumVertexDistance":0.04,"dieWithParticles":true,"colorOverTrail":{"0%":"rgb(255,255,255)","100%":"rgba(255,255,255,0)"}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"item_3","delay":0,"id":"2","start3DSize":true,"endBehavior":0,"duration":5,"type":"2","content":{"shape":{"type":0,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"None"},"options":{"startLifetime":1.2,"startSize":0.2,"sizeAspect":1,"startSpeed":1,"startColor":[8,[255,255,255]],"duration":2,"maxCount":18,"renderLevel":"B+"},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"emission":{"rateOverTime":[0,5]},"trails":{"lifetime":[0,1],"maxPointPerTrail":12,"widthOverTrail":[0,0.1],"minimumVertexDistance":0.04,"dieWithParticles":true}}}]';
    const comp = await generateComposition(player, json, { currentTime: 0.01 });
    const vfxItem = comp.getItemByName('item_3');

    expect(vfxItem.listIndex).to.eql(1);
    const pMesh = vfxItem.content.particleMesh.mesh;
    const tMesh = vfxItem.content.trailMesh.mesh;

    expect(pMesh.priority).to.eql(1, 'particle');
    expect(tMesh.priority).to.eql(1, 'trail');
    expect(vfxItem.content.particleMesh.maxCount).to.eql(18);
    expect(pMesh.material.uniformSemantics).to.include({
      effects_MatrixV:'VIEW',
      effects_MatrixVP:'VIEWPROJECTION',
    }, 'particle');
    expect(tMesh.material.uniformSemantics).to.includes({
      effects_ObjectToWorld: 'MODEL',
      effects_MatrixInvV: 'VIEWINVERSE',
      effects_MatrixVP: 'VIEWPROJECTION',
    }, 'trail');
    const tex = vfxItem.content.getTextures();

    expect(tex).to.be.an('array').with.lengthOf(2);
    expect(tex.every(texture => texture.sourceType === TextureSourceType.data)).to.be.true;
  });

  it('particle opacityOverLifetime texture', async () => {
    const gradient = { '0.00': 'rgba(208,2,27,1)', '1.00': 'rgba(248,231,28,1)' };
    const json = `[{"name":"item_4","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":0,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"None"},"options":{"startLifetime":1.2,"startSize":0.2,"sizeAspect":1,"startSpeed":1,"startColor":[8,[255,255,255]],"duration":2,"maxCount":10,"renderLevel":"B+"},"colorOverLifetime":{"opacity":[${spec.ValueType.LINE},[[0.5,0],[0.9,1]]],"color":[${spec.ValueType.GRADIENT_COLOR},[[0,255,255,255,255],[0.5,255,0,0,255],[1,255,0,255,255]]]},"emission":{"rateOverTime":5},"trails":{"lifetime":1,"maxPointPerTrail":12,"widthOverTrail":0.1,"minimumVertexDistance":0.04,"dieWithParticles":true,"colorOverTrail":{"0%":"rgb(255,255,255)","100%":"rgba(255,255,255,0)"}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, { currentTime: 0.01 });
    const item = comp.getItemByName('item_4');
    const uColorOverLifetime = item.content.particleMesh.mesh.material.getTexture('uColorOverLifetime');

    uColorOverLifetime.initialize();
    expect(uColorOverLifetime).to.be.an.instanceOf(Texture);
    expect(uColorOverLifetime.textureBuffer).to.be.an.instanceof(WebGLTexture);

    expect(uColorOverLifetime.sourceType === TextureSourceType.data);
    const color = ensureGradient(gradient);
    const data = Texture.createWithData(undefined, imageDataFromGradient(color[1])).source.data.data;

    expect([data[0], data[1], data[2], data[3]]).to.deep.equals([208, 2, 27, 255]);
    const index = data.length - 4;

    expect([data[index], data[index + 1], data[index + 2], data[index + 3]])
      .to.deep.equals([248, 231, 28, 255]);
  });

  it('burst add particle', async () => {
    const json = '[{"name":"item_5","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"item_6","delay":0,"id":"6","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":1.2,"startSize":0.2,"sizeAspect":1,"startSpeed":1,"startColor":[8,[255,255,255]],"duration":2,"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,10],"burts":[{"time":0,"count":50,"cycles":1,"interval":0}]},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"speedOverLifetime":[0,1],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]';
    const comp = await generateComposition(player, json, { currentTime: 1 });
    const p0 = comp.getItemByName('item_5');

    expect(p0.content.particleMesh.particleCount).to.eql(5);
    const p1 = comp.getItemByName('item_6');

    expect(p1.content.particleMesh.particleCount).to.eql(10);
    const geometry = p1.content.particleMesh.mesh.firstGeometry();
    const size = geometry.attributes['aPos'].stride / Float32Array.BYTES_PER_ELEMENT * 4; //4 vertex per particle

    expect(geometry.getAttributeData('aPos')).to.be.an.instanceOf(Float32Array).with.lengthOf(size * 10);
  });

  it('particle render mode', async () => {
    const json = `[{"name":"billboard","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"renderMode":${spec.RenderMode.BILLBOARD}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"mesh","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"renderMode":${spec.RenderMode.MESH}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"vertical_billboard","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"renderMode":${spec.RenderMode.VERTICAL_BILLBOARD}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"horizon_billboard","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"renderMode":${spec.RenderMode.HORIZONTAL_BILLBOARD}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"default","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, {});

    player.gotoAndStop(0.2);
    const billItem = comp.getItemByName('billboard');
    const billMaterial = billItem.content.particleMesh.mesh.material;

    expect(getMarcosValue(billMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.BILLBOARD);

    const defaultItem = comp.getItemByName('default');
    const defaultMaterial = defaultItem.content.particleMesh.mesh.material;

    expect(getMarcosValue(defaultMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.BILLBOARD);

    const meshItem = comp.getItemByName('mesh');
    const meshMaterial = meshItem.content.particleMesh.mesh.material;

    expect(getMarcosValue(meshMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.MESH);

    const verticalItem = comp.getItemByName('vertical_billboard');
    const verticalMaterial = verticalItem.content.particleMesh.mesh.material;

    expect(getMarcosValue(verticalMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.VERTICAL_BILLBOARD);

    const horizonItem = comp.getItemByName('horizon_billboard');
    const horizonMaterial = horizonItem.content.particleMesh.mesh.material;

    expect(getMarcosValue(horizonMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.HORIZONTAL_BILLBOARD);
  });

  it('particle mask mode', async () => {
    const json = `[{"name":"unset","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"default","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"maskMode":${spec.MaskMode.NONE}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"write","delay":0,"id":"1","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"maskMode":${spec.MaskMode.MASK}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"read","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"maskMode":${spec.MaskMode.OBSCURED}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"read_inverse","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"maskMode":${spec.MaskMode.REVERSE_OBSCURED}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, { currentTime: 0.01 });
    const unsetItem = comp.getItemByName('unset');

    expect(unsetItem.content.particleMesh.mesh.material.glMaterialState.stencilTest).to.be.false;

    const defaultItem = comp.getItemByName('default');

    expect(defaultItem.content.particleMesh.mesh.material.glMaterialState.stencilTest).to.be.false;

    const writeItem = comp.getItemByName('write');
    const writeStates = writeItem.content.particleMesh.mesh.material.glMaterialState;

    expect(writeStates.stencilTest).to.be.true;
    expect(writeStates.stencilFunc).to.deep.equal([glContext.ALWAYS, glContext.ALWAYS]);
    expect(writeStates.stencilMask).to.deep.equal([0xFF, 0xFF]);
    expect(writeStates.stencilOpFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(writeStates.stencilOpZPass).to.deep.equal([glContext.REPLACE, glContext.REPLACE]);
    expect(writeStates.stencilOpZFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);

    const readItem = comp.getItemByName('read');
    const readStates = readItem.content.particleMesh.mesh.material.glMaterialState;

    expect(readStates.stencilTest).to.be.true;
    expect(readStates.stencilFunc).to.deep.equal([glContext.EQUAL, glContext.EQUAL]);
    expect(readStates.stencilMask).to.deep.equal([0xFF, 0xFF]);
    expect(readStates.stencilOpFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(readStates.stencilOpZPass).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(readStates.stencilOpZFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);

    const readInverseItem = comp.getItemByName('read_inverse');
    const readInverseStates = readInverseItem.content.particleMesh.mesh.material.glMaterialState;

    expect(readInverseStates.stencilTest).to.be.true;
    expect(readInverseStates.stencilFunc).to.deep.equal([glContext.NOTEQUAL, glContext.NOTEQUAL]);
    expect(readInverseStates.stencilMask).to.deep.equal([0xFF, 0xFF]);
    expect(readInverseStates.stencilOpFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(readInverseStates.stencilOpZPass).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(readInverseStates.stencilOpZFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
  });

  it('particle open depth_test', async () => {
    const json = '[{"name":"depth_test","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"occlusion":true},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"transparent_occlusion","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"occlusion":true,"transparentOcclusion":true},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]';
    const comp = await generateComposition(player, json, { currentTime: 0.01 });

    const depthTestItem = comp.getItemByName('depth_test');
    const depthStates = depthTestItem.content.particleMesh.mesh.material.glMaterialState;

    expect(depthStates.depthMask).to.be.true;
    const transparentItem = comp.getItemByName('transparent_occlusion');
    const transparentMaterial = transparentItem.content.particleMesh.mesh.material;
    const uColorParams = transparentMaterial.getVector4('uColorParams');

    expect(transparentMaterial.glMaterialState.depthMask).to.be.true;
    expect(uColorParams.toArray()).to.eql([1, 1, 0, 0]);
  });

  it('particle blend mode', async () => {
    const json = `[{"name":"additive","delay":0,"id":"1","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.ADD}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"alpha","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.ALPHA}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"multiply","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.MULTIPLY}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"luminance_alpha","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.BRIGHTNESS}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"subtract","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.SUBTRACTION}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"add_light","delay":0,"id":"6","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.STRONG_LIGHT}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"light","delay":0,"id":"7","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.WEAK_LIGHT}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"luminance_additive","delay":0,"id":"8","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.SUPERPOSITION}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, { currentTime: 0.01 });

    const alphaItem = comp.getItemByName('alpha');
    const alphaMaterial = alphaItem.content.particleMesh.mesh.material;
    const alphaColorParams = alphaItem.content.particleMesh.mesh.material.getVector4('uColorParams');
    const state = alphaMaterial.glMaterialState;

    expect(state.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(state.blending).to.be.true;
    expect(state.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA]);
    expect(alphaColorParams.toArray()).to.eql([1, 1, 0, 0]);

    const additiveItem = comp.getItemByName('additive');
    const additiveMaterial = additiveItem.content.particleMesh.mesh.material;
    const additiveColorParams = additiveMaterial.getVector4('uColorParams');
    const addState = additiveMaterial.glMaterialState;

    expect(state.blending).to.be.true;
    expect(addState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(addState.blending).to.be.true;
    expect(addState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE]);
    expect(additiveColorParams.toArray()).to.eql([1, 1, 0, 0]);

    const subtractItem = comp.getItemByName('subtract');
    const subtractMaterial = subtractItem.content.particleMesh.mesh.material;
    const subtractColorParams = subtractMaterial.getVector4('uColorParams');
    const subState = subtractMaterial.glMaterialState;

    expect(subState.blending).to.be.true;
    expect(subState.blendEquationParameters).to.eql([glContext.FUNC_REVERSE_SUBTRACT, glContext.FUNC_REVERSE_SUBTRACT]);
    expect(subState.blending).to.be.true;
    expect(subState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ZERO, glContext.ONE]);
    expect(subtractColorParams.toArray()).to.eql([1, 1, 0, 0]);

    const luAdditiveItem = comp.getItemByName('luminance_additive');
    const luAdditiveMaterial = luAdditiveItem.content.particleMesh.mesh.material;
    const luAdditiveColorParams = luAdditiveMaterial.getVector4('uColorParams');
    const luAddState = luAdditiveMaterial.glMaterialState;

    expect(luAddState.blending).to.be.true;
    expect(luAddState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(luAddState.blending).to.be.true;
    expect(luAddState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE]);
    expect(luAdditiveColorParams.toArray()).to.eql([1, 2, 0, 0]);

    const multiplyItem = comp.getItemByName('multiply');
    const multiplyMaterial = multiplyItem.content.particleMesh.mesh.material;
    const multiplyColorParams = multiplyMaterial.getVector4('uColorParams');
    const multiplyState = multiplyMaterial.glMaterialState;

    expect(multiplyState.blending).to.be.true;
    expect(multiplyState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(multiplyState.blending).to.be.true;
    expect(multiplyState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA, glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA]);
    expect(multiplyColorParams.toArray()).to.eql([1, 0, 0, 0]);

    const addLightItem = comp.getItemByName('add_light');
    const addLightMaterial = addLightItem.content.particleMesh.mesh.material;
    const addLightColorParams = addLightMaterial.getVector4('uColorParams');
    const addLightState = addLightMaterial.glMaterialState;

    expect(addLightState.blending).to.be.true;
    expect(addLightState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(addLightState.blending).to.be.true;
    expect(addLightState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.DST_ALPHA, glContext.ZERO, glContext.ONE]);
    expect(addLightColorParams.toArray()).to.eql([1, 1, 0, 0]);

    const lightItem = comp.getItemByName('light');
    const lightMaterial = lightItem.content.particleMesh.mesh.material;
    const lightColorParams = lightMaterial.getVector4('uColorParams');
    const lightState = lightMaterial.glMaterialState;

    expect(lightState.blending).to.be.true;
    expect(lightState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(lightState.blending).to.be.true;
    expect(lightState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.ZERO, glContext.ZERO, glContext.ONE]);
    expect(lightColorParams.toArray()).to.eql([1, 1, 0, 0]);

    const luAlphaItem = comp.getItemByName('luminance_alpha');
    const luAlphaMaterial = luAlphaItem.content.particleMesh.mesh.material;
    const luAlphaColorParams = luAlphaMaterial.getVector4('uColorParams');
    const luAlphaState = luAlphaMaterial.glMaterialState;

    expect(luAlphaState.blending).to.be.true;
    expect(luAlphaState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(luAlphaState.blending).to.be.true;
    expect(luAlphaState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA]);
    expect(luAlphaColorParams.toArray()).to.eql([1, 3, 0, 0]);

  });

  it('particle side show', async () => {
    const json = `[{"name":"both","delay":0,"id":"1","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"side":${spec.SideMode.DOUBLE}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"front","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"side":${spec.SideMode.FRONT}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"back","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"side":${spec.SideMode.BACK}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, { currentTime: 0.01 });
    const bothItem = comp.getItemByName('both');

    expect(bothItem.content.particleMesh.mesh.material.glMaterialState.culling).to.false;

    const frontItem = comp.getItemByName('front');
    const frontStates = frontItem.content.particleMesh.mesh.material.glMaterialState;

    expect(frontStates.culling).to.true;
    expect(frontStates.cullFace).to.eql(glContext.FRONT);
    expect(frontStates.frontFace).to.eql(glContext.CW);

    const backItem = comp.getItemByName('back');
    const backStates = backItem.content.particleMesh.mesh.material.glMaterialState;

    expect(backStates.culling).to.true;
    expect(backStates.cullFace).to.eql(glContext.BACK);
    expect(backStates.frontFace).to.eql(glContext.CW);
  });

  it('particle trans origin', async () => {
    const json = `[{"name":"unset","delay":0,"id":"1","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5]},"positionOverLifetime":{"gravityOverLifetime":[0,1]}}},{"name":"center","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"left_top","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_TOP}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"left_middle","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_CENTER}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"left_bottom","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_BOTTOM}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"middle_top","delay":0,"id":"6","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_TOP}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"middle_bottom","delay":0,"id":"7","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_BOTTOM}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"right_top","delay":0,"id":"8","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_TOP}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"right_middle","delay":0,"id":"9","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_CENTER}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"right_bottom","delay":0,"id":"10","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_BOTTOM}},"emission":{"rateOverTime":[0,5]},"positionOverLifetime":{"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, { currentTime: 0.01 });
    const size = [1, 5]; // effected by startLifetime startSize sizeAspect;
    const DirX = [1, 0, 0], DirY = [0, 1, 0]; // close alignSpeedDirection

    checkItem('unset', new Vector2(0, 0));
    checkItem('center', new Vector2(0, 0));
    checkItem('left_top', new Vector2(-0.5, 0.5));
    checkItem('left_middle', new Vector2(-0.5, 0));
    checkItem('left_bottom', new Vector2(-0.5, -0.5));
    checkItem('middle_top', new Vector2(0, 0.5));
    checkItem('middle_bottom', new Vector2(0, -0.5));
    checkItem('right_top', new Vector2(0.5, 0.5));
    checkItem('right_middle', new Vector2(0.5, 0));
    checkItem('right_bottom', new Vector2(0.5, -0.5));

    function checkItem (name, anchor) {
      const item = comp.getItemByName(name);
      const rightBottomPos = item.content.particleMesh.mesh.firstGeometry().getAttributeData('aPos');

      expect(rightBottomPos).to.be.an.instanceOf(Float32Array).with.lengthOf(48);
      const rightBottomOffsets = particleOriginTranslateMap[spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER];

      const _anchor = item.content.particleMesh.anchor;

      expect(_anchor).to.deep.equals(anchor, 'anchor:' + name);
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 3; k++) {
          expect(size[0] * (rightBottomOffsets[j + j] - _anchor.x) * DirX[k]).to.eql(rightBottomPos[12 * j + 6 + k], name);
          expect(size[1] * (rightBottomOffsets[j + j + 1] - _anchor.y) * DirY[k]).to.eql(rightBottomPos[12 * j + 9 + k], name);
        }
      }
    }
  });
});

const particleOriginTranslateMap = {
  [spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER]: translatePoint(0, 0),
  [spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_BOTTOM]: translatePoint(0, 0.5),
  [spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_TOP]: translatePoint(0, -0.5),
  [spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_TOP]: translatePoint(0.5, -0.5),
  [spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_CENTER]: translatePoint(0.5, 0),
  [spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_BOTTOM]: translatePoint(0.5, 0.5),
  [spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_CENTER]: translatePoint(-0.5, 0),
  [spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_BOTTOM]: translatePoint(-0.5, 0.5),
  [spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_TOP]: translatePoint(-0.5, -0.5),
};

async function generateComposition (player, items, playOptions) {
  const json = `{"compositionId":5,"requires":[],"compositions":[{"name":"1","id":5,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1,"z":8},"items":${items},"previewSize":[512,512],"endBehavior":1,"startTime":0}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*OIR4RY9qmrEAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UI-NSIe2AywAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"version":"1.5","shapes":[],"plugins":[],"type":"mars","textures":[{"source":0,"flipY":true}]}`;
  const scene = await player.createComposition(JSON.parse(json));

  await player.gotoAndPlay(playOptions.currentTime ?? 0);

  return scene;
}

function ensureGradient (a) {
  if (a) {
    let stops = [];

    Object.getOwnPropertyNames(a).forEach(p => {
      const stop = parsePercent(p);
      const color = colorToArr(a[p]);

      stops.push([stop, color[0], color[1], color[2], color[3]]);
    });
    stops = stops.sort((a, b) => a[0] - b[0]);

    return [9, stops];
  }
}

function parsePercent (c) {
  const match = /^(-)?([\d+.]+)%$/.exec(c);

  if (match) {
    return +match[2] / 100 * (match[1] ? -1 : 1);
  }

  return +c;
}

function colorToArr (hex) {
  let ret;

  if (typeof hex === 'string') {
    hex = hex.replace(/[\s\t\r\n]/g, '');
    let m = /rgba?\(([.\d]+),([.\d]+),([.\d]+),?([.\d]+)?\)/.exec(hex);

    if (m) {
      const a = +m[4];

      ret = [+m[1], +m[2], +m[3], isNaN(a) ? 255 : Math.round(a * 255)];
    } else if (/^#[a-f\d]{3}$/i.test(hex)) {
      ret = [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16), 255];
      // eslint-disable-next-line no-cond-assign
    } else if (m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)) {
      ret = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 255] || [0, 0, 0, 255];
    }
  } else if (hex instanceof Array) {
    ret = [hex[0], hex[1], hex[2], isNaN(hex[3]) ? 255 : Math.round(hex[3] * 255)];
  }

  return ret;
}

function translatePoint (x, y) {
  const origin = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];

  for (let i = 0; i < 8; i += 2) {
    origin[i] += x;
    origin[i + 1] += y;
  }

  return origin;
}

function getMarcosValue (material, name) {
  const marcos = material.shaderSource.marcos;

  if (marcos) {
    const ret = marcos.find(m => m[0] === name);

    return ret && ret[1];
  }
}
