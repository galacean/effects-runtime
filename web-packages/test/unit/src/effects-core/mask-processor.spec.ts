import type { Engine, Renderer } from '@galacean/effects-core';
import { MaskProcessor, MaskMode, glContext, SpriteComponent, math, VFXItem, Material } from '@galacean/effects-core';
import { GLEngine, GLGeometry } from '@galacean/effects-webgl';

const { expect } = chai;

const dummyRef = { id: 'existing-mask-id' };

const vs = `attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
}`;

const fs = `precision highp float;
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}`;

/**
 * 创建用作 Maskable 的 SpriteComponent，spy 替换 drawStencilMask 以追踪调用
 */
function createMaskableSprite (engine: Engine, name = 'mask'): SpriteComponent {
  const item = new VFXItem(engine);
  const sprite = item.addComponent(SpriteComponent);

  sprite.name = name;
  chai.spy.on(sprite, 'drawStencilMask');

  return sprite;
}

/**
 * 创建用作 RendererComponent 的 SpriteComponent，使用指定的材质列表
 */
function createSpriteRendererComponent (engine: Engine, materials: Material[]): SpriteComponent {
  const item = new VFXItem(engine);
  const sprite = item.addComponent(SpriteComponent);

  sprite.materials = materials;

  return sprite;
}
describe('core/material//mask-ref-manager', () => {
  let canvas: HTMLCanvasElement;
  let engine: Engine;
  let renderer: Renderer;

  before(() => {
    canvas = document.createElement('canvas');
    const glEngine = new GLEngine(canvas, { glType: 'webgl2' });

    engine = glEngine;
    renderer = glEngine.renderer;

    const existingMask = createMaskableSprite(engine, 'existing-mask');

    existingMask.setInstanceId('existing-mask-id');
  });

  afterEach(() => {
    (renderer.engine as GLEngine).shaderLibrary.dispose();
  });

  after(() => {
    engine.dispose();
    // @ts-expect-error
    renderer = null;
    // @ts-expect-error
    engine = null;
    canvas.remove();
    // @ts-expect-error
    canvas = null;
  });

  // ==================== 构造与初始值 ====================

  describe('constructor & defaults', () => {
    it('should have correct default values', () => {
      const mp = new MaskProcessor();

      expect(mp.alphaMaskEnabled).to.eql(false);
      expect(mp.isMask).to.eql(false);
      expect(mp.inverted).to.eql(false);
      expect(mp.maskMode).to.eql(MaskMode.NONE);
    });

  });

  // ==================== addMaskReference / removeMaskReference / clearMaskReferences ====================

  describe('mask reference management', () => {
    it('addMaskReference should add a mask reference', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(sprite);
      mp.drawStencilMask(renderer, component);
      expect(sprite.drawStencilMask).to.have.been.called();
      expect(material.stencilTest).to.eql(true);
    });

    it('addMaskReference should not add duplicate maskable', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(sprite);
      mp.addMaskReference(sprite);
      mp.removeMaskReference(sprite);
      mp.drawStencilMask(renderer, component);
      expect(material.stencilTest).to.eql(false);
    });

    it('addMaskReference should support multiple different masks', () => {
      const mp = new MaskProcessor();
      const sprite1 = createMaskableSprite(engine, 'm1');
      const sprite2 = createMaskableSprite(engine, 'm2');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(sprite1);
      mp.addMaskReference(sprite2);
      mp.drawStencilMask(renderer, component);
      expect(sprite1.drawStencilMask).to.have.been.called();
      expect(sprite2.drawStencilMask).to.have.been.called();
      expect(material.stencilRef).to.deep.equals([2, 2]);
    });

    it('removeMaskReference should remove a mask reference', () => {
      const mp = new MaskProcessor();
      const sprite1 = createMaskableSprite(engine, 'm1');
      const sprite2 = createMaskableSprite(engine, 'm2');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(sprite1);
      mp.addMaskReference(sprite2);
      mp.removeMaskReference(sprite1);
      mp.drawStencilMask(renderer, component);
      expect(sprite2.drawStencilMask).to.have.been.called();
      expect(material.stencilRef).to.deep.equals([1, 1]);
    });

    it('removeMaskReference should do nothing for non-existent maskable', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.removeMaskReference(sprite);
      mp.drawStencilMask(renderer, component);
      expect(material.stencilTest).to.eql(false);
    });

    it('clearMaskReferences should remove all references', () => {
      const mp = new MaskProcessor();
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(createMaskableSprite(engine, 'm1'));
      mp.addMaskReference(createMaskableSprite(engine, 'm2'));
      mp.clearMaskReferences();
      mp.drawStencilMask(renderer, component);
      expect(material.stencilTest).to.eql(false);
    });
  });

  // ==================== drawStencilMask ====================

  describe('drawStencilMask', () => {
    it('should call renderer.clear and drawStencilMask on forward masks in order', () => {
      const mp = new MaskProcessor();
      const sprite1 = createMaskableSprite(engine, 'm1');
      const sprite2 = createMaskableSprite(engine, 'm2');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(sprite1, false);
      mp.addMaskReference(sprite2, false);
      mp.drawStencilMask(renderer, component);

      expect(sprite1.drawStencilMask).to.have.been.called.with(0);
      expect(sprite2.drawStencilMask).to.have.been.called.with(1);
    });

    it('should handle reverse masks with forwardCount as maskRef', () => {
      const mp = new MaskProcessor();
      const forward = createMaskableSprite(engine, 'f1');
      const reverse = createMaskableSprite(engine, 'r1');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(forward, false);
      mp.addMaskReference(reverse, true);
      mp.drawStencilMask(renderer, component);

      expect(forward.drawStencilMask).to.have.been.called.with(0);
      expect(reverse.drawStencilMask).to.have.been.called.with(1);
    });

    it('should setup stencil on masked material (forward only)', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(sprite, false);
      mp.drawStencilMask(renderer, component);

      expect(material.stencilTest).to.eql(true);
      expect(material.stencilRef).to.deep.equals([1, 1]);
      expect(material.stencilMask).to.deep.equals([0xFF, 0xFF]);
      expect(material.stencilFunc).to.deep.equals([glContext.EQUAL, glContext.EQUAL]);
      expect(material.stencilOpZPass).to.deep.equals([glContext.KEEP, glContext.KEEP]);
    });

    it('should disable stencil when no mask references', () => {
      const mp = new MaskProcessor();
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.drawStencilMask(renderer, component);

      expect(material.stencilTest).to.eql(false);
    });

    it('should setup multiple materials', () => {
      const mp = new MaskProcessor();
      const sprite = createMaskableSprite(engine);
      const mat1 = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const mat2 = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [mat1, mat2]);

      mp.addMaskReference(sprite, false);
      mp.drawStencilMask(renderer, component);

      expect(mat1.stencilTest).to.eql(true);
      expect(mat2.stencilTest).to.eql(true);
      expect(mat1.stencilRef).to.deep.equals([1, 1]);
      expect(mat2.stencilRef).to.deep.equals([1, 1]);
    });

    it('should set expectedStencilValue to the number of forward masks', () => {
      const mp = new MaskProcessor();
      const f1 = createMaskableSprite(engine, 'f1');
      const f2 = createMaskableSprite(engine, 'f2');
      const f3 = createMaskableSprite(engine, 'f3');
      const r1 = createMaskableSprite(engine, 'r1');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(f1, false);
      mp.addMaskReference(f2, false);
      mp.addMaskReference(f3, false);
      mp.addMaskReference(r1, true);
      mp.drawStencilMask(renderer, component);

      expect(material.stencilRef).to.deep.equals([3, 3]);
      expect(r1.drawStencilMask).to.have.been.called.with(3);
    });
  });

  // ==================== drawGeometryMask ====================

  describe('drawGeometryMask', () => {
    it('should restore material state after drawing', () => {
      const mp = new MaskProcessor();
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const geometry = new GLGeometry(engine, {
        drawStart: 0,
        drawCount: 3,
        attributes: {
          'aPosition': {
            data: new Float32Array([0, 0, 1, 0, 0, 1]),
            size: 2,
            stride: 0,
            offset: 0,
          },
        },
      });

      // 设置初始值
      material.colorMask = true;
      material.stencilTest = false;
      material.stencilFunc = [glContext.ALWAYS, glContext.ALWAYS];
      material.stencilOpZPass = [glContext.KEEP, glContext.KEEP];
      material.stencilRef = [0, 0];
      material.stencilMask = [0xFF, 0xFF];

      const worldMatrix = new math.Matrix4();

      mp.drawGeometryMask(renderer, geometry, worldMatrix, material, 2);

      expect(material.colorMask).to.eql(true);
      expect(material.stencilTest).to.eql(false);
      expect(material.stencilFunc).to.deep.equals([glContext.ALWAYS, glContext.ALWAYS]);
      expect(material.stencilOpZPass).to.deep.equals([glContext.KEEP, glContext.KEEP]);
      expect(material.stencilRef).to.deep.equals([0, 0]);
      expect(material.stencilMask).to.deep.equals([0xFF, 0xFF]);

      geometry.dispose();
    });
  });

  // ==================== setMaskOptions ====================

  describe('setMaskOptions', () => {
    it('should set maskMode to MASK when isMask is true', () => {
      const mp = new MaskProcessor();

      mp.setMaskOptions(engine, { isMask: true, reference: dummyRef });

      expect(mp.isMask).to.eql(true);
      expect(mp.maskMode).to.eql(MaskMode.MASK);
    });

    it('should set maskMode to OBSCURED when isMask is false and inverted is false', () => {
      const mp = new MaskProcessor();

      mp.setMaskOptions(engine, { isMask: false, inverted: false, reference: dummyRef });

      expect(mp.maskMode).to.eql(MaskMode.OBSCURED);
    });

    it('should set maskMode to REVERSE_OBSCURED when inverted is true', () => {
      const mp = new MaskProcessor();

      mp.setMaskOptions(engine, { isMask: false, inverted: true, reference: dummyRef });

      expect(mp.maskMode).to.eql(MaskMode.REVERSE_OBSCURED);
    });

    it('should set alphaMaskEnabled', () => {
      const mp = new MaskProcessor();

      mp.setMaskOptions(engine, { alphaMaskEnabled: true, reference: dummyRef });

      expect(mp.alphaMaskEnabled).to.eql(true);
    });

    it('should clear previous references when called again', () => {
      const mp = new MaskProcessor();
      const sprite1 = createMaskableSprite(engine, 'm1');
      const sprite2 = createMaskableSprite(engine, 'm2');
      const material = new Material(engine, { shader: { vertex: vs, fragment: fs } });
      const component = createSpriteRendererComponent(engine, [material]);

      mp.addMaskReference(sprite1);
      mp.addMaskReference(sprite2);

      mp.setMaskOptions(engine, { isMask: true, reference: dummyRef });
      mp.drawStencilMask(renderer, component);
      expect(material.stencilTest).to.eql(false);
    });
  });
});
