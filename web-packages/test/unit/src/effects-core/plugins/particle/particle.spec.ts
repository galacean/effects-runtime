import type { ParticleSystem, GLGeometry, Material } from '@galacean/effects';
import { Player, spec, TextureSourceType, glContext, math } from '@galacean/effects';
import type { GLMaterial } from '@galacean/effects-webgl';

const { Vector2 } = math;
const { expect } = chai;

describe('core/plugins/particle/test', function () {
  this.timeout('60s');

  const canvas = document.createElement('canvas');
  let player: Player;

  before(() => {
    player = new Player({ canvas: canvas, manualRender: true });
  });

  afterEach(() => {
    player.destroyCurrentCompositions();
  });

  after(() => {
    player.dispose();
    // @ts-expect-error
    player = null;
  });

  it('load particle mesh with priority', async () => {
    const json = '[{"name":"item_2","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":0,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"None"},"options":{"startLifetime":1.2,"startSize":0.2,"sizeAspect":1,"startSpeed":1,"startColor":[8,[255,255,255]],"duration":2,"maxCount":18,"renderLevel":"B+"},"emission":{"rateOverTime":5},"trails":{"lifetime":1,"maxPointPerTrail":12,"widthOverTrail":0.1,"minimumVertexDistance":0.04,"dieWithParticles":true,"colorOverTrail":{"0%":"rgb(255,255,255)","100%":"rgba(255,255,255,0)"}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"item_3","delay":0,"id":"2","start3DSize":true,"endBehavior":0,"duration":5,"type":"2","content":{"shape":{"type":0,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"None"},"options":{"startLifetime":1.2,"startSize":0.2,"sizeAspect":1,"startSpeed":1,"startColor":[8,[255,255,255]],"duration":2,"maxCount":18,"renderLevel":"B+"},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"gravity":[0,0,0],"gravityOverLifetime":[0,1]},"emission":{"rateOverTime":[0,5]},"trails":{"lifetime":[0,1],"maxPointPerTrail":12,"widthOverTrail":[0,0.1],"minimumVertexDistance":0.04,"dieWithParticles":true}}}]';
    const comp = await generateComposition(player, json, 0.01);
    const vfxItem = comp.getItemByName('item_3');
    const content = vfxItem?.content as ParticleSystem;

    expect(vfxItem?.renderOrder).to.eql(1);
    const pMesh = content.renderer.particleMesh.mesh;
    // @ts-expect-error
    const tMesh = content.renderer.trailMesh?.mesh;

    // expect(pMesh.priority).to.eql(1, 'particle');
    // expect(tMesh.priority).to.eql(1, 'trail');
    expect(content.renderer.particleMesh.maxCount).to.eql(18);
    expect(pMesh.material.uniformSemantics).to.include({
      effects_MatrixV: 'VIEW',
      effects_MatrixVP: 'VIEWPROJECTION',
    }, 'particle');
    expect(tMesh?.material.uniformSemantics).to.includes({
      effects_ObjectToWorld: 'MODEL',
      effects_MatrixInvV: 'VIEWINVERSE',
      effects_MatrixVP: 'VIEWPROJECTION',
    }, 'trail');
    const tex = content.getTextures();

    expect(tex).to.be.an('array').with.lengthOf(2);
    expect(tex.every(texture => texture.sourceType === TextureSourceType.data)).to.be.true;
  });

  // TODO
  // it('particle opacityOverLifetime texture', async () => {
  //   const gradient = { '0.00': 'rgba(208,2,27,1)', '1.00': 'rgba(248,231,28,1)' };
  //   const json = `[{"name":"item_4","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":0,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"None"},"options":{"startLifetime":1.2,"startSize":0.2,"sizeAspect":1,"startSpeed":1,"startColor":[8,[255,255,255]],"duration":2,"maxCount":10,"renderLevel":"B+"},"colorOverLifetime":{"opacity":[${spec.ValueType.LINE},[[0.5,0],[0.9,1]]],"color":[${spec.ValueType.GRADIENT_COLOR},[[0,255,255,255,255],[0.5,255,0,0,255],[1,255,0,255,255]]]},"emission":{"rateOverTime":5},"trails":{"lifetime":1,"maxPointPerTrail":12,"widthOverTrail":0.1,"minimumVertexDistance":0.04,"dieWithParticles":true,"colorOverTrail":{"0%":"rgb(255,255,255)","100%":"rgba(255,255,255,0)"}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
  //   const comp = await generateComposition(player, json, { currentTime: 0.01 });
  //   const item = comp.getItemByName('item_4');
  //   const uColorOverLifetime = item.content.renderer.particleMesh.mesh.material.getTexture('uColorOverLifetime');
  //
  //   uColorOverLifetime.initialize();
  //   expect(uColorOverLifetime).to.be.an.instanceOf(Texture);
  //   expect(uColorOverLifetime.textureBuffer).to.be.an.instanceof(WebGLTexture);
  //
  //   expect(uColorOverLifetime.sourceType === TextureSourceType.data);
  //   const color = ensureGradient(gradient);
  //   const data = Texture.createWithData(undefined, imageDataFromGradient(color[1])).source.data.data;
  //
  //   expect([data[0], data[1], data[2], data[3]]).to.deep.equals([208, 2, 27, 255]);
  //   const index = data.length - 4;
  //
  //   expect([data[index], data[index + 1], data[index + 2], data[index + 3]])
  //     .to.deep.equals([248, 231, 28, 255]);
  // });

  it('burst add particle', async () => {
    const json = '[{"name":"item_5","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"item_6","delay":0,"id":"6","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":1.2,"startSize":0.2,"sizeAspect":1,"startSpeed":1,"startColor":[8,[255,255,255]],"duration":2,"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,10],"burts":[{"time":0,"count":50,"cycles":1,"interval":0}]},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"speedOverLifetime":[0,1],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]';
    const comp = await generateComposition(player, json, 1);
    const p0 = comp.getItemByName('item_5');
    const p1 = comp.getItemByName('item_6');
    const p0Content = p0?.content as ParticleSystem;
    const p1Content = p1?.content as ParticleSystem;

    expect(p0Content.renderer.particleMesh.particleCount).to.eql(5);

    expect(p1Content.renderer.particleMesh.particleCount).to.eql(10);
    const geometry = p1Content.renderer.particleMesh.mesh.firstGeometry() as GLGeometry;
    const size = (geometry.attributes['aPos'].stride ?? 0) / Float32Array.BYTES_PER_ELEMENT * 4; //4 vertex per particle

    expect(geometry.getAttributeData('aPos')).to.be.an.instanceOf(Float32Array).with.lengthOf(size * 10);
  });

  it('particle render mode', async () => {
    const json = `[{"name":"billboard","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"renderMode":${spec.RenderMode.BILLBOARD}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"mesh","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"renderMode":${spec.RenderMode.MESH}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"vertical_billboard","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"renderMode":${spec.RenderMode.VERTICAL_BILLBOARD}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"horizon_billboard","delay":0,"id":"222","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"renderMode":${spec.RenderMode.HORIZONTAL_BILLBOARD}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"default","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json);

    player.gotoAndStop(0.2);
    const billItem = comp.getItemByName('billboard');
    const billContent = billItem?.content as ParticleSystem;
    const billMaterial = billContent.renderer.particleMesh.mesh.material;

    expect(getMacrosValue(billMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.BILLBOARD);

    const defaultItem = comp.getItemByName('default');
    const defaultContent = defaultItem?.content as ParticleSystem;
    const defaultMaterial = defaultContent.renderer.particleMesh.mesh.material;

    expect(getMacrosValue(defaultMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.BILLBOARD);

    const meshItem = comp.getItemByName('mesh');
    const meshContent = meshItem?.content as ParticleSystem;
    const meshMaterial = meshContent.renderer.particleMesh.mesh.material;

    expect(getMacrosValue(meshMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.MESH);

    const verticalItem = comp.getItemByName('vertical_billboard');
    const verticalContent = verticalItem?.content as ParticleSystem;
    const verticalMaterial = verticalContent.renderer.particleMesh.mesh.material;

    expect(getMacrosValue(verticalMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.VERTICAL_BILLBOARD);

    const horizonItem = comp.getItemByName('horizon_billboard');
    const horizonContent = horizonItem?.content as ParticleSystem;
    const horizonMaterial = horizonContent.renderer.particleMesh.mesh.material;

    expect(getMacrosValue(horizonMaterial, 'RENDER_MODE')).to.eql(spec.RenderMode.HORIZONTAL_BILLBOARD);
  });

  it('particle mask mode', async () => {
    const json = `[{"name":"unset","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"default","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"maskMode":${spec.MaskMode.NONE}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"write","delay":0,"id":"1","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"maskMode":${spec.MaskMode.MASK}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"read","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"maskMode":${spec.MaskMode.OBSCURED}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"read_inverse","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"renderer":{"maskMode":${spec.MaskMode.REVERSE_OBSCURED}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, 0.01);
    const unsetItem = comp.getItemByName('unset');
    const unsetContent = unsetItem?.content as ParticleSystem;
    const unsetMaterial = unsetContent.renderer.particleMesh.mesh.material as GLMaterial;

    // @ts-expect-error
    expect(unsetMaterial.glMaterialState.stencilTest).to.be.false;

    const defaultItem = comp.getItemByName('default');
    const defaultContent = defaultItem?.content as ParticleSystem;
    const defaultMaterial = defaultContent.renderer.particleMesh.mesh.material as GLMaterial;

    // @ts-expect-error
    expect(defaultMaterial.glMaterialState.stencilTest).to.be.false;

    const writeItem = comp.getItemByName('write');
    const writeContent = writeItem?.content as ParticleSystem;
    const writeMaterial = writeContent.renderer.particleMesh.mesh.material as GLMaterial;
    // @ts-expect-error
    const writeStates = writeMaterial.glMaterialState;

    expect(writeStates.stencilTest).to.be.true;
    expect(writeStates.stencilFunc).to.deep.equal([glContext.ALWAYS, glContext.ALWAYS]);
    expect(writeStates.stencilMask).to.deep.equal([0xFF, 0xFF]);
    expect(writeStates.stencilOpFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(writeStates.stencilOpZPass).to.deep.equal([glContext.REPLACE, glContext.REPLACE]);
    expect(writeStates.stencilOpZFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);

    const readItem = comp.getItemByName('read');
    const readContent = readItem?.content as ParticleSystem;
    const readMaterial = readContent.renderer.particleMesh.mesh.material as GLMaterial;
    // @ts-expect-error
    const readStates = readMaterial.glMaterialState;

    expect(readStates.stencilTest).to.be.true;
    expect(readStates.stencilFunc).to.deep.equal([glContext.EQUAL, glContext.EQUAL]);
    expect(readStates.stencilMask).to.deep.equal([0xFF, 0xFF]);
    expect(readStates.stencilOpFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(readStates.stencilOpZPass).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(readStates.stencilOpZFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);

    const readInverseItem = comp.getItemByName('read_inverse');
    const readInverseContent = readInverseItem?.content as ParticleSystem;
    const readInverseMaterial = readInverseContent.renderer.particleMesh.mesh.material as GLMaterial;
    // @ts-expect-error
    const readInverseStates = readInverseMaterial.glMaterialState;

    expect(readInverseStates.stencilTest).to.be.true;
    expect(readInverseStates.stencilFunc).to.deep.equal([glContext.NOTEQUAL, glContext.NOTEQUAL]);
    expect(readInverseStates.stencilMask).to.deep.equal([0xFF, 0xFF]);
    expect(readInverseStates.stencilOpFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(readInverseStates.stencilOpZPass).to.deep.equal([glContext.KEEP, glContext.KEEP]);
    expect(readInverseStates.stencilOpZFail).to.deep.equal([glContext.KEEP, glContext.KEEP]);
  });

  it('particle open depth_test', async () => {
    const json = '[{"name":"depth_test","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"occlusion":true},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"transparent_occlusion","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"occlusion":true,"transparentOcclusion":true},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]';
    const comp = await generateComposition(player, json, 0.01);

    const depthTestItem = comp.getItemByName('depth_test');
    const depthTestContent = depthTestItem?.content as ParticleSystem;
    const depthTestMaterial = depthTestContent.renderer.particleMesh.mesh.material as GLMaterial;
    // @ts-expect-error
    const depthStates = depthTestMaterial.glMaterialState;

    expect(depthStates.depthMask).to.be.true;
    const transparentItem = comp.getItemByName('transparent_occlusion');
    const transparentContent = transparentItem?.content as ParticleSystem;
    const transparentMaterial = transparentContent.renderer.particleMesh.mesh.material as GLMaterial;
    const uColorParams = transparentMaterial.getVector4('uColorParams');

    // @ts-expect-error
    expect(transparentMaterial.glMaterialState.depthMask).to.be.true;
    expect(uColorParams?.toArray()).to.eql([1, 1, 0, 0]);
  });

  it('particle blend mode', async () => {
    const json = `[{"name":"additive","delay":0,"id":"1","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.ADD}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"alpha","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.ALPHA}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"multiply","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.MULTIPLY}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"luminance_alpha","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.BRIGHTNESS}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"subtract","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.SUBTRACTION}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"add_light","delay":0,"id":"6","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.STRONG_LIGHT}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"light","delay":0,"id":"7","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.WEAK_LIGHT}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"luminance_additive","delay":0,"id":"8","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"blending":${spec.BlendingMode.SUPERPOSITION}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, 0.01);

    const alphaItem = comp.getItemByName('alpha');
    const alphaContent = alphaItem?.content as ParticleSystem;
    const alphaMaterial = alphaContent.renderer.particleMesh.mesh.material as GLMaterial;
    const alphaColorParams = alphaMaterial.getVector4('uColorParams');
    // @ts-expect-error
    const state = alphaMaterial.glMaterialState;

    expect(state.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(state.blending).to.be.true;
    expect(state.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA]);
    expect(alphaColorParams?.toArray()).to.eql([1, 1, 0, 0]);

    const additiveItem = comp.getItemByName('additive');
    const additiveContent = additiveItem?.content as ParticleSystem;
    const additiveMaterial = additiveContent.renderer.particleMesh.mesh.material as GLMaterial;
    const additiveColorParams = additiveMaterial.getVector4('uColorParams');
    // @ts-expect-error
    const addState = additiveMaterial.glMaterialState;

    expect(state.blending).to.be.true;
    expect(addState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(addState.blending).to.be.true;
    expect(addState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE]);
    expect(additiveColorParams?.toArray()).to.eql([1, 1, 0, 0]);

    const subtractItem = comp.getItemByName('subtract');
    const subtractContent = subtractItem?.content as ParticleSystem;
    const subtractMaterial = subtractContent.renderer.particleMesh.mesh.material as GLMaterial;
    const subtractColorParams = subtractMaterial.getVector4('uColorParams');
    // @ts-expect-error
    const subState = subtractMaterial.glMaterialState;

    expect(subState.blending).to.be.true;
    expect(subState.blendEquationParameters).to.eql([glContext.FUNC_REVERSE_SUBTRACT, glContext.FUNC_REVERSE_SUBTRACT]);
    expect(subState.blending).to.be.true;
    expect(subState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ZERO, glContext.ONE]);
    expect(subtractColorParams?.toArray()).to.eql([1, 1, 0, 0]);

    const luAdditiveItem = comp.getItemByName('luminance_additive');
    const luAdditiveContent = luAdditiveItem?.content as ParticleSystem;
    const luAdditiveMaterial = luAdditiveContent.renderer.particleMesh.mesh.material as GLMaterial;
    const luAdditiveColorParams = luAdditiveMaterial.getVector4('uColorParams');
    // @ts-expect-error
    const luAddState = luAdditiveMaterial.glMaterialState;

    expect(luAddState.blending).to.be.true;
    expect(luAddState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(luAddState.blending).to.be.true;
    expect(luAddState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE]);
    expect(luAdditiveColorParams?.toArray()).to.eql([1, 2, 0, 0]);

    const multiplyItem = comp.getItemByName('multiply');
    const multiplyContent = multiplyItem?.content as ParticleSystem;
    const multiplyMaterial = multiplyContent.renderer.particleMesh.mesh.material as GLMaterial;
    const multiplyColorParams = multiplyMaterial.getVector4('uColorParams');
    // @ts-expect-error
    const multiplyState = multiplyMaterial.glMaterialState;

    expect(multiplyState.blending).to.be.true;
    expect(multiplyState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(multiplyState.blending).to.be.true;
    expect(multiplyState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA, glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA]);
    expect(multiplyColorParams?.toArray()).to.eql([1, 0, 0, 0]);

    const addLightItem = comp.getItemByName('add_light');
    const addLightContent = addLightItem?.content as ParticleSystem;
    const addLightMaterial = addLightContent.renderer.particleMesh.mesh.material as GLMaterial;
    const addLightColorParams = addLightMaterial.getVector4('uColorParams');
    // @ts-expect-error
    const addLightState = addLightMaterial.glMaterialState;

    expect(addLightState.blending).to.be.true;
    expect(addLightState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(addLightState.blending).to.be.true;
    expect(addLightState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.DST_ALPHA, glContext.ZERO, glContext.ONE]);
    expect(addLightColorParams?.toArray()).to.eql([1, 1, 0, 0]);

    const lightItem = comp.getItemByName('light');
    const lightContent = lightItem?.content as ParticleSystem;
    const lightMaterial = lightContent.renderer.particleMesh.mesh.material as GLMaterial;
    const lightColorParams = lightMaterial.getVector4('uColorParams');
    // @ts-expect-error
    const lightState = lightMaterial.glMaterialState;

    expect(lightState.blending).to.be.true;
    expect(lightState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(lightState.blending).to.be.true;
    expect(lightState.blendFunctionParameters).to.eql([glContext.DST_COLOR, glContext.ZERO, glContext.ZERO, glContext.ONE]);
    expect(lightColorParams?.toArray()).to.eql([1, 1, 0, 0]);

    const luAlphaItem = comp.getItemByName('luminance_alpha');
    const luAlphaContent = luAlphaItem?.content as ParticleSystem;
    const luAlphaMaterial = luAlphaContent.renderer.particleMesh.mesh.material as GLMaterial;
    const luAlphaColorParams = luAlphaMaterial.getVector4('uColorParams');
    // @ts-expect-error
    const luAlphaState = luAlphaMaterial.glMaterialState;

    expect(luAlphaState.blending).to.be.true;
    expect(luAlphaState.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_ADD]);
    expect(luAlphaState.blending).to.be.true;
    expect(luAlphaState.blendFunctionParameters).to.eql([glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA]);
    expect(luAlphaColorParams?.toArray()).to.eql([1, 3, 0, 0]);

  });

  it('particle side show', async () => {
    const json = `[{"name":"both","delay":0,"id":"1","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"side":${spec.SideMode.DOUBLE}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"front","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"side":${spec.SideMode.FRONT}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"back","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1.2],"startSize":[0,0.2],"sizeAspect":[0,1],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"side":${spec.SideMode.BACK}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, 0.01);
    const bothItem = comp.getItemByName('both');
    const bothContent = bothItem?.content as ParticleSystem;
    const bothMaterial = bothContent.renderer.particleMesh.mesh.material as GLMaterial;

    // @ts-expect-error
    expect(bothMaterial.glMaterialState.culling).to.false;

    const frontItem = comp.getItemByName('front');
    const frontContent = frontItem?.content as ParticleSystem;
    const frontMaterial = frontContent.renderer.particleMesh.mesh.material as GLMaterial;
    // @ts-expect-error
    const frontStates = frontMaterial.glMaterialState;

    expect(frontStates.culling).to.true;
    expect(frontStates.cullFace).to.eql(glContext.FRONT);
    expect(frontStates.frontFace).to.eql(glContext.CW);

    const backItem = comp.getItemByName('back');
    const backContent = backItem?.content as ParticleSystem;
    const backMaterial = backContent.renderer.particleMesh.mesh.material as GLMaterial;
    // @ts-expect-error
    const backStates = backMaterial.glMaterialState;

    expect(backStates.culling).to.true;
    expect(backStates.cullFace).to.eql(glContext.BACK);
    expect(backStates.frontFace).to.eql(glContext.CW);
  });

  it('particle trans origin', async () => {
    const json = `[{"name":"unset","delay":0,"id":"1","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"maxCount":10,"renderLevel":"B+"},"emission":{"rateOverTime":[0,5]},"positionOverLifetime":{"gravityOverLifetime":[0,1]}}},{"name":"center","delay":0,"id":"2","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"left_top","delay":0,"id":"3","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_TOP}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"left_middle","delay":0,"id":"4","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_CENTER}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"left_bottom","delay":0,"id":"5","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_BOTTOM}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"middle_top","delay":0,"id":"6","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_TOP}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"middle_bottom","delay":0,"id":"7","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_BOTTOM}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"right_top","delay":0,"id":"8","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_TOP}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"right_middle","delay":0,"id":"9","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_CENTER}},"emission":{"rateOverTime":[0,5],"burts":{"time":0,"count":5,"cycles":1,"interval":0}},"positionOverLifetime":{"asMovement":true,"linearX":[0,0],"linearY":[0,0],"linearZ":[0,0],"asRotation":false,"orbitalX":[0,0],"orbitalY":[0,0],"orbitalZ":[0,0],"orbCenter":[0,0,0],"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}},{"name":"right_bottom","delay":0,"id":"10","type":"2","duration":5,"content":{"shape":{"type":1,"radius":1,"arc":360,"arcMode":0,"alignSpeedDirection":false,"shape":"Sphere"},"options":{"startLifetime":[0,1],"startSize":[0,1],"sizeAspect":[0,0.2],"startColor":[8,[255,255,255]],"duration":2,"startDelay":[0,0],"start3DSize":false,"startRotationZ":[0,0],"maxCount":10,"renderLevel":"B+"},"renderer":{"particleOrigin":${spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_BOTTOM}},"emission":{"rateOverTime":[0,5]},"positionOverLifetime":{"forceTarget":false,"endBehavior":4,"gravity":[0,0,0],"gravityOverLifetime":[0,1]}}}]`;
    const comp = await generateComposition(player, json, 0.01);
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

    function checkItem (name: string, anchor: math.Vector2) {
      const item = comp.getItemByName(name);
      const itemContent = item?.content as ParticleSystem;
      const rightBottomPos = itemContent.renderer.particleMesh.mesh.firstGeometry().getAttributeData('aPos');

      expect(rightBottomPos).to.be.an.instanceOf(Float32Array).with.lengthOf(48);
      const rightBottomOffsets = particleOriginTranslateMap[spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER];

      const meshAnchor = itemContent.renderer.particleMesh.anchor;

      expect(meshAnchor).to.deep.equals(anchor, 'anchor:' + name);
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 3; k++) {
          expect(size[0] * (rightBottomOffsets[j + j] - meshAnchor.x) * DirX[k]).to.eql(rightBottomPos?.[12 * j + 6 + k], name);
          expect(size[1] * (rightBottomOffsets[j + j + 1] - meshAnchor.y) * DirY[k]).to.eql(rightBottomPos?.[12 * j + 9 + k], name);
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

async function generateComposition (player: Player, items: any, currentTime = 0) {
  const json = `{"compositionId":5,"requires":[],"compositions":[{"name":"1","id":5,"duration":5,"camera":{"fov":30,"far":20,"near":0.1,"position":[0,0,8],"clipMode":1,"z":8},"items":${items},"previewSize":[512,512],"endBehavior":1,"startTime":0}],"gltf":[],"images":[{"url":"https://mdn.alipayobjects.com/mars/afts/img/A*OIR4RY9qmrEAAAAAAAAAAAAADlB4AQ/original","webp":"https://mdn.alipayobjects.com/mars/afts/img/A*UI-NSIe2AywAAAAAAAAAAAAADlB4AQ/original","renderLevel":"B+"}],"version":"1.5","shapes":[],"plugins":[],"type":"mars","textures":[{"source":0,"flipY":true}]}`;
  //@ts-expect-error
  const scene = player.createComposition(JSON.parse(json));

  player.gotoAndPlay(currentTime);

  return scene;
}

function translatePoint (x: number, y: number) {
  const origin = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];

  for (let i = 0; i < 8; i += 2) {
    origin[i] += x;
    origin[i + 1] += y;
  }

  return origin;
}

function getMacrosValue (material: Material, name: string) {
  const macros = material.shaderSource.macros;

  if (macros) {
    const ret = macros.find(m => m[0] === name);

    return ret && ret[1];
  }
}
