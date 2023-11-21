// // @ts-nocheck
// import { TextureLoadAction, TextureSourceType, glContext, Camera } from '@galacean/effects-core';
// import { GLGeometry, GLMaterial, GLMesh, GLRenderFrame, GLTexture, GLRenderPass, GLRenderer } from '@galacean/effects-webgl';

// const { assert, expect } = chai;

// describe('webgl/GLProgram', () => {
//   let canvas = document.createElement('canvas');
//   let renderer = new GLRenderer(canvas, 'webgl2');

//   after(() => {
//     renderer.dispose();
//     renderer = null;
//     canvas.remove();
//     canvas = null;
//   });

//   it('mesh set uniform webgl1 test', () => {
//     const mesh = new GLMesh({
//       name: 'mesh',
//       material: generateMtl(),
//       geometry: new GLGeometry({
//         attributes: {
//           aPoint: {
//             type: glContext.FLOAT,
//             size: 2,
//             data: new Float32Array([0, 0, 0, 1.0, 1.0, 0]),
//           },
//         },
//         drawCount: 3,
//       }),
//     });

//     mesh.initialize(renderer.glRenderer);
//     const renderPass = new GLRenderPass({ name: 'basic', meshes: [mesh], camera: { name: '' } });

//     const frame = new GLRenderFrame({
//       renderer,
//       camera: new Camera(),
//       renderPasses: [renderPass],
//       clearAction: {
//         colorAction: TextureLoadAction.clear,
//         clearColor: [0, 0, 0, 0],
//       },
//     });

//     renderer.renderRenderFrame(frame);
//     const gl = renderer.glRenderer.pipelineContext.gl;
//     const glProgram = mesh.material.shader.program;
//     const webglProgram = mesh.material.shader.program.program;

//     assert(gl.getUniform(webglProgram, glProgram.uniformInfoMap.b1test.loc), 'true');
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.b4test.loc)).to.eql([true, true, true, true]);
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.b2test.loc)).to.eql([true, false]);
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.b3test.loc)).to.eql([true, false, true]);

//     assert(gl.getUniform(webglProgram, glProgram.uniformInfoMap.i1test.loc), '2');
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.i2test.loc)).to.eql(new Int32Array([2, 3]));
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.i3test.loc)).to.eql(new Int32Array([3, 3, 3]));
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.i4test.loc)).to.eql(new Int32Array([4, 4, 4, 4]));

//     assert(gl.getUniform(webglProgram, glProgram.uniformInfoMap.v1test.loc), '1');
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.v2test.loc)).to.eql(new Float32Array([1, 1]));
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.v3test.loc)).to.eql(new Float32Array([1, 0.5, 1]));
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.v4test.loc)).to.eql(new Float32Array([0.5, 0.5, 0, 1]));
//     for (let index = 0; index < va1test.value.length / va1test.size; index++) {
//       const element = va1test.value[index];
//       const loc = gl.getUniformLocation(webglProgram, va1test.name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }
//     for (let index = 0; index < va2test.value.length / va2test.size; index++) {
//       const element = new Float32Array([va2test.value[va2test.size * index], va2test.value[va2test.size * index + 1]]);
//       const loc = gl.getUniformLocation(webglProgram, va2test.name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < va3test.value.length / va3test.size; index++) {
//       const size = va3test.size;
//       const name = va3test.name;
//       const value = va3test.value;
//       const element = new Float32Array([value[size * index], value[size * index + 1], value[size * index + 2]]);
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < va4test.value.length / va4test.size; index++) {
//       const size = va4test.size;
//       const name = va4test.name;
//       const value = va4test.value;
//       const element = new Float32Array([value[size * index], value[size * index + 1], value[size * index + 2], value[size * index + 3]]);
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < ba1test.value.length / ba1test.size; index++) {
//       const name = ba1test.name;
//       const value = ba1test.value;
//       const element = value[index];
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(Boolean(element));
//     }

//     for (let index = 0; index < ba2test.value.length / ba2test.size; index++) {
//       const size = ba2test.size;
//       const name = ba2test.name;
//       const value = ba2test.value;
//       const element = [Boolean(value[size * index]), Boolean(value[size * index + 1])];
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < ba3test.value.length / ba3test.size; index++) {
//       const size = ba3test.size;
//       const name = ba3test.name;
//       const value = ba3test.value;
//       const element = [Boolean(value[size * index]), Boolean(value[size * index + 1]), Boolean(value[size * index + 2])];
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < ba4test.value.length / ba4test.size; index++) {
//       const size = ba4test.size;
//       const name = ba4test.name;
//       const value = ba4test.value;
//       const element = [Boolean(value[size * index]), Boolean(value[size * index + 1]), Boolean(value[size * index + 2]), Boolean(value[size * index + 3])];
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < ia1test.value.length / ia1test.size; index++) {
//       const name = ia1test.name;
//       const value = ia1test.value;
//       const element = value[index];
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < ia2test.value.length / ia2test.size; index++) {
//       const size = ia2test.size;
//       const name = ia2test.name;
//       const value = ia2test.value;
//       const element = [value[size * index], value[size * index + 1]];
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(new Int32Array(element));
//     }

//     for (let index = 0; index < ia3test.value.length / ia3test.size; index++) {
//       const size = ia3test.size;
//       const name = ia3test.name;
//       const value = ia3test.value;
//       const element = [value[size * index], value[size * index + 1], value[size * index + 2]];
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(new Int32Array(element));
//     }

//     for (let index = 0; index < ia4test.value.length / ia4test.size; index++) {
//       const size = ia4test.size;
//       const name = ia4test.name;
//       const value = ia4test.value;
//       const element = [value[size * index], value[size * index + 1], value[size * index + 2], value[size * index + 3]];
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(new Int32Array(element));
//     }

//     for (let index = 0; index < ma2test.value.length / ma2test.size; index++) {
//       const size = ma2test.size;
//       const name = ma2test.name;
//       const value = ma2test.value;
//       const element = new Float32Array([value[size * index], value[size * index + 1], value[size * index + 2], value[size * index + 3]]);
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < ma3test.value.length / ma3test.size; index++) {
//       const size = ma3test.size;
//       const name = ma3test.name;
//       const value = ma3test.value;
//       const element = new Float32Array([value[size * index], value[size * index + 1], value[size * index + 2], value[size * index + 3], value[size * index + 4], value[size * index + 5], value[size * index + 6], value[size * index + 7], value[size * index + 8]]);
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     for (let index = 0; index < ma4test.value.length / ma4test.size; index++) {
//       const size = ma4test.size;
//       const name = ma4test.name;
//       const value = ma4test.value;
//       const element = new Float32Array([value[size * index], value[size * index + 1], value[size * index + 2], value[size * index + 3], value[size * index + 4], value[size * index + 5], value[size * index + 6], value[size * index + 7], value[size * index + 8], value[size * index + 9], value[size * index + 10], value[size * index + 11], value[size * index + 12], value[size * index + 13], value[size * index + 14], value[size * index + 15]]);
//       const loc = gl.getUniformLocation(webglProgram, name + '[' + index + ']');

//       expect(gl.getUniform(webglProgram, loc)).to.eql(element);
//     }

//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.m2test.loc)).to.eql(new Float32Array([1, -1, 1, 1]));
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.m3test.loc)).to.eql(new Float32Array([1, 1, 0, 0, 1, 0, 0, 0, 1]));
//     expect(gl.getUniform(webglProgram, glProgram.uniformInfoMap.m4test.loc)).to.eql(new Float32Array([1, 1, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1]));
//   });

//   it('sampler2d array set value', () => {
//     const vertex = `
// precision highp float;
// attribute vec2 aPoint;
// attribute vec2 aTexCoord;

// varying vec2 vTexCoord;
// void main(){
//   gl_Position = vec4(aPoint.xy,0.,1.);
//   vTexCoord = aTexCoord;
// }
// `;
//     const fragment = `
// precision highp float;
// varying vec2 vTexCoord;

// uniform sampler2D uTexArr[2];
// uniform sampler2D uTex;
// void main(){
//  gl_FragColor = texture2D(uTexArr[0],vTexCoord)+texture2D(uTexArr[1],vTexCoord) +texture2D(uTex,vTexCoord);;
// }
// `;
//     const mesh = new GLMesh({
//       name: 'mesh',
//       material: new GLMaterial({
//         shader: { vertex, fragment, name: 'myShader' },
//         states: {},
//       }),
//       geometry: new GLGeometry({
//         name: 'myGeometry',
//         attributes: {
//           aPoint: {
//             size: 2,
//             data: new Float32Array([
//               -.5, .5, 0, 1,
//               -.5, -.5, 0, 0,
//               .5, .5, 1, 1,
//               .5, -.5, 1, 0,
//             ]),
//             stride: Float32Array.BYTES_PER_ELEMENT * 4,
//           },
//           aTexCoord: {
//             type: glContext.FLOAT,
//             size: 2,
//             stride: Float32Array.BYTES_PER_ELEMENT * 4,
//             offset: Float32Array.BYTES_PER_ELEMENT * 2,
//             dataSource: 'aPoint',
//           },
//         },
//         index: { data: new Uint8Array([0, 1, 2, 2, 1, 3]) },
//         drawCount: 6,
//       }),
//     });

//     mesh.initialize(renderer.glRenderer);
//     const renderPass = new GLRenderPass({ name: 'basic', meshes: [mesh], camera: { name: 'main' } });

//     const frame = new GLRenderFrame({
//       renderer,
//       camera: new Camera(),
//       renderPasses: [renderPass],
//       clearAction: {
//         colorAction: TextureLoadAction.clear,
//         clearColor: [0, 0, 0, 0],
//       },
//     });
//     const textures = [
//       new GLTexture({
//         sourceType: TextureSourceType.data,
//         data: {
//           width: 1,
//           height: 1,
//           data: new Uint8Array(4),
//         },
//       }),
//       new GLTexture({
//         sourceType: TextureSourceType.data,
//         data: {
//           width: 1,
//           height: 1,
//           data: new Uint8Array([255, 255, 255, 255]),
//         },
//       }),
//     ];
//     const uTex = new GLTexture({
//       sourceType: TextureSourceType.data,
//       data: {
//         width: 1,
//         height: 1,
//         data: new Uint8Array(4),
//       },
//     });

//     mesh.material.setTexture('uTexArr', textures);
//     mesh.material.setTexture('uTex', uTex);
//     renderer.renderRenderFrame(frame);
//     const program = mesh.material.shader.program;
//     const info = program?.uniformInfoMap['uTexArr'];
//     const texInfo = program?.uniformInfoMap['uTex'];

//     expect(info).to.exist;
//     expect(texInfo).to.exist;
//     expect(program).to.exist;
//     if (info && texInfo && program) {
//       expect(info.size).to.eql(2);
//       const state = renderer.glRenderer.state;
//       const gl = renderer.glRenderer.gl;
//       const TEXTURE0 = gl.TEXTURE0;

//       // TODO 待补充
//       // expect(state.textureUnitDict[TEXTURE0 + info.textureIndex]).to.exist.and.to.eql(textures[0].internal?.glHandle);
//       // expect(state.textureUnitDict[TEXTURE0 + info.textureIndex + 1]).to.exist.and.to.eql(textures[1].internal?.glHandle);
//       // expect(state.textureUnitDict[TEXTURE0 + texInfo.textureIndex]).to.exist.and.to.eql(uTex.internal?.glHandle);
//       const val = gl.getUniform(program.program, texInfo.loc);
//       const loc0 = gl.getUniformLocation(program.program, 'uTexArr[0]');
//       const loc1 = gl.getUniformLocation(program.program, 'uTexArr[1]');

//       expect(val).to.eql(2);
//       expect(gl.getUniform(program.program, loc0)).to.eql(0, 'uTexArr[0]');
//       expect(gl.getUniform(program.program, loc1)).to.eql(1, 'uTexArr[1]');
//     }
//   });

//   it('instanced program only set when dirty', () => {
//     const mesh = new GLMesh({
//       name: 'mesh',
//       material: generateMtl(),
//       geometry: new GLGeometry({
//         attributes: {
//           aPoint: {
//             type: glContext.FLOAT,
//             size: 2,
//             data: new Float32Array([0, 0, 0, 1.0, 1.0, 0]),
//           },
//         },
//         drawCount: 3,
//       }),
//     });

//     mesh.initialize(renderer.glRenderer);
//     const renderPass = new GLRenderPass({ name: 'basic', meshes: [mesh], camera: { name: '' } });

//     const frame = new GLRenderFrame({
//       renderer,
//       camera: new Camera(),
//       renderPasses: [renderPass],
//       clearAction: {
//         colorAction: TextureLoadAction.clear,
//         clearColor: [0, 0, 0, 0],
//       },
//     });
//     const db = mesh.material.defaultDataBlock;

//     expect(mesh.material.shader.program?.shared).to.be.false;
//     expect(db.hasUniformValue('v4test')).to.be.true;
//     expect(db.uniformFlags['v4test']).to.be.true;
//     renderer.renderRenderFrame(frame);
//     expect(db.uniformFlags['v4test']).not.exist;
//     const program = mesh.material.shader.program;
//     const spy = program.setGLUniformValue = chai.spy(function (name) {
//     });

//     renderer.renderRenderFrame(frame);
//     expect(spy).not.have.been.called.once;
//     const val = new Float32Array([2, 3, 4, 5]);

//     db.setUniformValue('v4test', val);
//     expect(db.uniformFlags['v4test']).to.be.true;
//     renderer.renderRenderFrame(frame);
//     expect(db.uniformFlags['v4test']).not.exist;
//     expect(spy).has.been.called.once;
//     expect(spy).has.been.called.with(renderer.glRenderer.gl, val);
//   });

//   it('render pass semantic overrides render frame semantic', () => {
//     const mesh = new GLMesh({
//       name: 'mesh',
//       material: generateMtl(),
//       geometry: new GLGeometry({
//         attributes: {
//           aPoint: {
//             type: glContext.FLOAT,
//             size: 2,
//             data: new Float32Array([0, 0, 0, 1.0, 1.0, 0]),
//           },
//         },
//         drawCount: 3,
//       }),
//     });

//     mesh.initialize(renderer.glRenderer);

//     mesh.material.setUniformSemantic('v4test', 'VEC4_TEST');
//     mesh.material.defaultDataBlock.removeUniformValue('v4test');
//     expect(mesh.material.defaultDataBlock.hasUniformValue('v4test')).to.be.false;
//     expect(mesh.material.uniformSemantics['v4test']).to.eql('VEC4_TEST');
//     const renderPass = new GLRenderPass({
//       name: 'basic', meshes: [mesh],
//       semantics: {
//         VEC4_TEST: [1, 0, 0, 1],
//       },
//       camera: { name: '' },
//     });
//     const frame = new GLRenderFrame({
//       renderer: renderer,
//       camera: new Camera(),
//       renderPasses: [renderPass],
//       semantics: {
//         VEC4_TEST: [0, 1, 1, 0],
//       },
//       clearAction: {
//         colorAction: TextureLoadAction.clear,
//         clearColor: [0, 0, 0, 0],
//       },
//     });
//     const program = mesh.material.shader.program;
//     const spy = program.setGLUniformValue = chai.spy(function (gl, val, info) {
//       if (info.name === 'v4test') {
//         expect(val).to.deep.equal([1, 0, 0, 1]);
//       }
//     });

//     renderer.renderRenderFrame(frame);
//     expect(spy).to.has.been.called.with(renderer.glRenderer.gl, [1, 0, 0, 1]);
//   });
//   it('render frame semantic set by default', () => {
//     const mesh = new GLMesh({
//       name: 'mesh',
//       material: generateMtl(),
//       geometry: new GLGeometry({
//         attributes: {
//           aPoint: {
//             type: glContext.FLOAT,
//             size: 2,
//             data: new Float32Array([0, 0, 0, 1.0, 1.0, 0]),
//           },
//         },
//         drawCount: 3,
//       }),
//     });

//     mesh.initialize(renderer.glRenderer);

//     mesh.material.setUniformSemantic('v4test', 'VEC4_TEST');

//     const renderPass = new GLRenderPass({
//       name: 'basic', meshes: [mesh],
//       camera: { name: '' },
//     });
//     const frame = new GLRenderFrame({
//       renderer: renderer,
//       camera: new Camera(),
//       renderPasses: [renderPass],
//       semantics: {
//         VEC4_TEST: [0, 1, 1, 0],
//       },
//       clearAction: {
//         colorAction: TextureLoadAction.clear,
//         clearColor: [0, 0, 0, 0],
//       },
//     });
//     const program = mesh.material.shader.program;
//     const spy = program.setGLUniformValue = chai.spy(function (gl, val, info) {
//       if (info.name === 'v4test') {
//         expect(val).to.deep.equal([1, 2, 3, 4]);
//       }
//     });

//     mesh.material.setFloat('v4test', [1, 2, 3, 4]);
//     renderer.renderRenderFrame(frame);
//     mesh.material.defaultDataBlock.removeUniformValue('v4test');
//     expect(mesh.material.defaultDataBlock.hasUniformValue('v4test')).to.be.false;
//     expect(mesh.material.uniformSemantics['v4test']).to.eql('VEC4_TEST');
//     expect(spy).to.has.been.called.with(renderer.glRenderer.gl, [1, 2, 3, 4]);
//   });
//   it('shared share reset uniform value every time ignoring flag', () => {
//     const mesh = new GLMesh({
//       name: 'mesh',
//       material: generateMtl('xxxx'),
//       geometry: new GLGeometry({
//         attributes: {
//           aPoint: {
//             type: glContext.FLOAT,
//             size: 2,
//             data: new Float32Array([0, 0, 0, 1.0, 1.0, 0]),
//           },
//         },
//         drawCount: 3,
//       }),
//     });

//     mesh.initialize(renderer.glRenderer);
//     const renderPass = new GLRenderPass({ name: 'basic', meshes: [mesh], camera: { name: '' } });

//     const frame = new GLRenderFrame({
//       renderer: renderer,
//       camera: new Camera(),
//       renderPasses: [renderPass],
//       clearAction: {
//         colorAction: TextureLoadAction.clear,
//         clearColor: [0, 0, 0, 0],
//       },
//     });
//     const db = mesh.material.defaultDataBlock;
//     const val = new Float32Array([2, 3, 4, 5]);

//     db.setUniformValues({ v4test: val });
//     expect(mesh.material.shader.program?.shared).to.be.true;
//     expect(db.hasUniformValue('v4test')).to.be.true;
//     const program = mesh.material.shader.program;
//     const spy = program.setGLUniformValue = chai.spy(() => {
//     });

//     renderer.renderRenderFrame(frame);
//     expect(spy).has.been.called.with(renderer.glRenderer.gl, val);
//     renderer.renderRenderFrame(frame);
//     expect(spy).has.been.called.with(renderer.glRenderer.gl, val);
//     const v2 = new Float32Array([4, 5, 6, 7]);

//     db.setUniformValue('v4test', v2);
//     renderer.renderRenderFrame(frame);
//     expect(spy).has.been.called.with(renderer.glRenderer.gl, v2);
//   });
// });

// //需要看效果在解除注释
// //document.body.appendChild(canvas);
// const va1test = {
//   name: 'va1test',
//   size: 1,
//   value: [1.0, 22222.0, 3.0],
// };
// const va2test = {
//   name: 'va2test',
//   size: 2,
//   value: [1.0, 1.0, 0.1, 10.0],
// };

// const va3test = {
//   name: 'va3test',
//   size: 3,
//   value: [1.0, 0.1, 10.0, 2.9, 2399, 404, 1, 2, 5],
// };

// const va4test = {
//   name: 'va4test',
//   size: 4,
//   value: [1.0, 0.1, 10.0, 2.9, 2399, 404, 1, 2],
// };

// const ba1test = {
//   name: 'ba1test',
//   size: 1,
//   value: [1, 0, 1],
// };

// const ba2test = {
//   name: 'ba2test',
//   size: 2,
//   value: [1, 0, 1, 1],
// };

// const ba3test = {
//   name: 'ba3test',
//   size: 3,
//   value: [1, 1, 1, 1, 1, 1],
// };

// const ba4test = {
//   name: 'ba4test',
//   size: 4,
//   value: [1, 1, 1, 1, 1, 1, 1, 0],
// };

// const ia1test = {
//   name: 'ia1test',
//   size: 1,
//   value: [2222, 33333, 44444],
// };

// const ia2test = {
//   name: 'ia2test',
//   size: 2,
//   value: [2222, 33333, 44444, 2],
// };
// const ia3test = {
//   name: 'ia3test',
//   size: 3,
//   value: [2, 1, 4, 2, 4, 5],
// };
// const ia4test = {
//   name: 'ia4test',
//   size: 4,
//   value: [2222, 33333, 44444, 2],
// };

// const ma2test = {
//   name: 'ma2test',
//   size: 4,
//   value: [1.0, -1.0, 1.0, 1.0],
// };
// const ma3test = {
//   name: 'ma3test',
//   size: 9,
//   value: [1.0, -1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0],
// };

// const ma4test = {
//   name: 'ma4test',
//   size: 16,
//   value: [1.0, 1.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 1.0],
// };

// function generateMtl (shaderCacheId) {
//   const shader = {
//     cacheId: shaderCacheId,
//     vertex: `
//     precision highp float;
//     attribute vec2 aPoint;
//     uniform mat2 m2test;
//     uniform mat3 m3test;
//     uniform mat4 m4test;
//     uniform mat2 ma2test[1];
//     uniform mat3 ma3test[1];
//     uniform mat4 ma4test[1];
//     void main(){
//       vec3 point = m3test*ma3test[0] * vec3(ma2test[0]*m2test*aPoint,0.0);
//       gl_Position =ma4test[0]*m4test* vec4(point,1.);
//     }
//     `,
//     fragment: `
//     precision highp float;

//     uniform bool b1test;
//     uniform bool ba1test[3];
//     uniform bvec2 b2test;
//     uniform bvec2 ba2test[2];
//     uniform bvec3 b3test;
//     uniform bvec3 ba3test[2];
//     uniform bvec4 b4test;
//     uniform bvec4 ba4test[2];
//     uniform int i1test;
//     uniform int ia1test[3];
//     uniform ivec2 i2test;
//     uniform ivec2 ia2test[2];
//     uniform ivec3 i3test;
//     uniform ivec3 ia3test[2];
//     uniform ivec4 i4test;
//     uniform ivec4 ia4test[1];
//     uniform vec2 v2test;
//     uniform float v1test;
//     uniform float va1test[3];
//     uniform vec2 va2test[2];
//     uniform vec3 va3test[3];
//     uniform vec4 va4test[2];
//     uniform vec3 v3test;
//     uniform vec4 v4test;
//     uniform sampler2D uTex;
//     void main(){
//     float v3=(v3test.x*v3test.y*v3test.z);
//     vec2 a=vec2(v2test.x-v1test,v2test.y);
//     vec4 color = texture2D(uTex,vec2(0.))+ vec4(v4test.x+v3,v4test.y+a.y,v4test.z,v4test.w)*float(i1test/2)*float(i2test.x/2)*float(i2test.y/3)*float(i3test.x/3)*float(i3test.y/3)*float(i3test.z/3)*float(i4test.x/4)*float(i4test.y/4)*float(i4test.z/4)*float(i4test.w/4);
//     if(ba1test[0]&&ba1test[1]&&ba1test[2]){
//       if(b4test.x&&b4test.y&&b4test.z&&b4test.w){
//         if(b3test.x&&b3test.y&&b3test.z){
//           if(b2test.x){
//             if(b1test&&b2test.y){
//               gl_FragColor = vec4(1.0,0.0,0.0,1.0);
//             }else{
//               gl_FragColor = color;
//             }
//           }
//         }else{
//           float c = va2test[0][0]*va2test[0][1]*va2test[1][0]*va2test[1][1];
//           float d = va3test[0][0]*va3test[0][1]*va3test[0][2]*va3test[1][0]*va3test[1][1]*va3test[1][2]*va3test[2][0]*va3test[2][1]*va3test[2][2]/10000.0;
//           float b =va1test[0]*va1test[1]*va1test[2];
//           float f = va4test[0][0]*va4test[0][1]*va4test[0][2]*va4test[0][3]*va4test[1][0]*va4test[1][1]*va4test[1][2]*va4test[1][3];
//           gl_FragColor = vec4(b*c*d,f,0.0,1.0);
//         }
//       }
//     }else{
//       if(ba2test[0][0]&&ba2test[0][1]&&ba2test[1][0]&&ba2test[1][1])
//       {
//         gl_FragColor = vec4(1.0,0.5,0.0,1.0);
//       } else{
//         if(ba3test[0][0]&&ba3test[0][1]&&ba3test[0][2]&&ba3test[1][0]&&ba3test[1][1]&&ba3test[1][2]){
//           if(ba4test[0][0]&&ba4test[0][1]&&ba4test[0][2]&&ba4test[0][3]&&ba4test[1][0]&&ba4test[1][1]&&ba4test[1][2]&&ba4test[1][3]){
//             gl_FragColor = vec4(1.0,0.9,0.1,1.0);
//           }else{
//             int g = ia1test[0]+ia1test[1]+ia1test[2]+ia2test[0][0]+ia2test[0][1]+ia2test[1][0]+ia2test[1][1]+ia3test[0][0]+ia3test[0][1]+ia3test[0][2]+ia3test[1][0]+ia3test[1][1]+ia3test[1][2]+ia4test[0][0]+ia4test[0][1]+ia4test[0][2]+ia4test[0][3];
//             gl_FragColor = vec4(0.0,float(g),0.1,1.0);
//           }

//         }
//       }
//     }

//     }
//     `,
//   };

//   const marsMaterial = new GLMaterial({
//     shader: shader,
//     name: 'test material',
//     states: {},
//   });

//   marsMaterial.setFloat('va1test', va1test.value);
//   marsMaterial.setVector2('va2test', va2test.value);
//   marsMaterial.setVector3('va3test', va3test.value);
//   marsMaterial.setVector4('va4test', va4test.value);
//   marsMaterial.setInt('ba1test', ba1test.value);
//   marsMaterial.setVector2('ba2test', ba2test.value);
//   marsMaterial.setVector3('ba3test', ba3test.value);
//   marsMaterial.setVector4('ba4test', ba4test.value);
//   marsMaterial.setInt('ia1test', ia1test.value);
//   marsMaterial.setVector2('ia2test', ia2test.value);
//   marsMaterial.setVector3('ia3test', ia3test.value);
//   marsMaterial.setVector4('ia4test', ia4test.value);
//   marsMaterial.setFloats('ma2test', ma2test.value);
//   marsMaterial.setFloats('ma3test', ma3test.value);
//   marsMaterial.setFloats('ma4test', ma4test.value);
//   marsMaterial.setInt('b1test', [1]);
//   marsMaterial.setVector2('b2test', [1, 0]);
//   marsMaterial.setVector3('b3test', [1, 0, 1]);
//   marsMaterial.setVector4('b4test', [1, 1, 1, 1]);
//   marsMaterial.setInt('i1test', [2]);
//   marsMaterial.setVector2('i2test', [2, 3]);
//   marsMaterial.setVector3('i3test', [3, 3, 3]);
//   marsMaterial.setVector4('i4test', [4, 4, 4, 4]);
//   marsMaterial.setFloats('v2test', [1.0, 1.0]);
//   marsMaterial.setFloats('v1test', [1.0]);
//   marsMaterial.setFloats('v3test', [1.0, 0.5, 1.0]);
//   marsMaterial.setFloats('v4test', [0.5, 0.5, 0.0, 1.0]);
//   marsMaterial.setFloats('m2test', [1.0, -1.0, 1.0, 1.0]);
//   marsMaterial.setFloats('m3test', [1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]);
//   marsMaterial.setMatrix('m4test', [1.0, 1.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 1.0]);

//   return marsMaterial;
// }
