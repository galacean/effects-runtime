// @ts-nocheck
import {
  TextureSourceType, RenderPass, RenderPassDestroyAttachmentType,
  RenderPassAttachmentStorageType, OrderType, Mesh, DrawObjectPass,
} from '@galacean/effects-core';
import { GLTexture, GLGeometry, GLMaterial, GLEngine } from '@galacean/effects-webgl';
import { getGL2 } from './gl-utils';
import { MathUtils } from './math-utils';

const { expect } = chai;

describe('webgl/gl-render-pass', () => {
  let gl = getGL2()!;
  let engine = new GLEngine(gl.canvas, { glType: 'webgl2' });
  let renderer = engine.renderer;

  after(() => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    engine.dispose();
    renderer = null;
    gl.canvas.remove();
    gl = null;
    engine = null;
  });

  //同时进行build reset resize操作
  it('render pass with build->reset->resize', () => {
    //重置renderer的size
    const buildWidth = 128, buildHeight = 64;
    const resetWidth = 300;
    const resetHeight = 150;
    const resizeWidth = 1024, resizeHeight = 2048;
    const spy = chai.spy(() => {
    });
    const call = renderer.resize;
    //创建的时候传入viewport
    const rp1 = new DrawObjectPass(renderer, {});

    renderer.engine.bindSystemFramebuffer();

    //resize后framebuffer的宽高也要跟着变
    renderer.resize = spy;
    engine.setSize(resizeWidth, resizeHeight);
    expect(spy).has.been.called.once;
    renderer.resize = call;
    engine.setSize(resizeWidth, resizeHeight);
    //置回默认值，方便其他同学测试
    engine.setSize(300, 150);
    rp1.dispose();
  });
});
