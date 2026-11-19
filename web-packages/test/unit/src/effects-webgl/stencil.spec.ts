import { Engine, Geometry, MaskProcessor, Material, TextureLoadAction, glContext, math } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

for (const glType of ['webgl', 'webgl2'] as const) {
  describe(`webgl/stencil/${glType}`, () => {
    let engine: Engine;
    let geometry: Geometry;
    let material: Material;
    let gl: WebGLRenderingContext | WebGL2RenderingContext;

    beforeEach(() => {
      const canvas = document.createElement('canvas');

      canvas.width = canvas.height = 8;
      engine = new Engine(canvas, { glType });
      gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
      geometry = Geometry.create(engine, {
        attributes: { aPosition: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]) } },
        mode: glContext.TRIANGLE_STRIP,
        drawCount: 4,
      });
      material = Material.create(engine, {
        shader: {
          vertex: `attribute vec2 aPosition;
uniform float uDepth;
void main() { gl_Position = vec4(aPosition, uDepth, 1.0); }`,
          fragment: `precision mediump float;
uniform vec4 uColor;
void main() { gl_FragColor = uColor; }`,
        },
      });
      material.blending = false;
      material.culling = false;
      material.depthTest = false;
      material.depthMask = false;
      material.setFloat('uDepth', 0);
      material.setVector4('uColor', new math.Vector4(1, 0, 0, 1));
      engine.renderer.setViewport(0, 0, 8, 8);
      engine.renderer.clear({
        colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0],
        depthAction: TextureLoadAction.clear, clearDepth: 1,
        stencilAction: TextureLoadAction.clear, clearStencil: 0,
      });
    });

    afterEach(() => {
      geometry.dispose();
      material.dispose();
      engine.dispose();
    });

    function pixels (): number[][] {
      const result = new Uint8Array(8 * 8 * 4);

      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, result);
      expect(gl.getError()).equals(gl.NO_ERROR);
      expect(engine.renderErrors.size).equals(0);

      return Array.from({ length: 64 }, (_, index) => Array.from(result.slice(index * 4, index * 4 + 4)));
    }

    it('keeps stencil read and write masks independent', () => {
      material.stencilTest = true;
      material.stencilReadMask = [1, 1];
      material.setupStates(engine);
      expect(gl.getParameter(gl.STENCIL_VALUE_MASK)).equals(1);
      expect(gl.getParameter(gl.STENCIL_BACK_VALUE_MASK)).equals(1);
      expect(gl.getParameter(gl.STENCIL_WRITEMASK)).equals(0xff);
      expect(gl.getParameter(gl.STENCIL_BACK_WRITEMASK)).equals(0xff);

      material.stencilWriteMask = [2, 4];
      material.setupStates(engine);

      expect(gl.getParameter(gl.STENCIL_VALUE_MASK)).equals(1);
      expect(gl.getParameter(gl.STENCIL_BACK_VALUE_MASK)).equals(1);
      expect(gl.getParameter(gl.STENCIL_WRITEMASK)).equals(2);
      expect(gl.getParameter(gl.STENCIL_BACK_WRITEMASK)).equals(4);

      material.stencilReadMask = [8, 8];
      material.setupStates(engine);
      expect(gl.getParameter(gl.STENCIL_VALUE_MASK)).equals(8);
      expect(gl.getParameter(gl.STENCIL_BACK_VALUE_MASK)).equals(8);
      expect(gl.getParameter(gl.STENCIL_WRITEMASK)).equals(2);
      expect(gl.getParameter(gl.STENCIL_BACK_WRITEMASK)).equals(4);
    });

    it('compares selected stencil bits without writing when the write mask is zero', () => {
      const renderer = engine.renderer;

      renderer.drawStencilInViewport(0, 5, glContext.ALWAYS, glContext.REPLACE);
      material.stencilTest = true;
      material.stencilReadMask = [1, 1];
      material.stencilWriteMask = [0, 0];
      material.stencilRef = [1, 1];
      material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];
      material.stencilOpZPass = [glContext.ZERO, glContext.ZERO];
      renderer.drawGeometry(geometry, math.Matrix4.IDENTITY, material);
      expect(pixels()).deep.equals(Array.from({ length: 64 }, () => [255, 0, 0, 255]));

      material.stencilReadMask = [0xff, 0xff];
      material.stencilRef = [5, 5];
      material.setVector4('uColor', new math.Vector4(0, 0, 1, 1));
      renderer.drawGeometry(geometry, math.Matrix4.IDENTITY, material);
      expect(pixels()).deep.equals(Array.from({ length: 64 }, () => [0, 0, 255, 255]));
    });

    it('updates only selected stencil bits in the viewport without changing color or depth', () => {
      const renderer = engine.renderer;

      material.depthTest = true;
      material.depthMask = true;
      material.depthFunc = glContext.LESS;
      material.setFloat('uDepth', -0.5);
      renderer.drawGeometry(geometry, math.Matrix4.IDENTITY, material);
      const red = Array.from({ length: 64 }, () => [255, 0, 0, 255]);

      expect(pixels()).deep.equals(red);
      renderer.setViewport(0, 0, 4, 8);
      renderer.drawStencilInViewport(0xff, 1, glContext.ALWAYS, glContext.REPLACE);
      renderer.drawStencilInViewport(1, 5, glContext.EQUAL, glContext.REPLACE, glContext.KEEP, 4);
      expect(pixels()).deep.equals(red);

      renderer.setViewport(0, 0, 8, 8);
      material.depthMask = false;
      material.setFloat('uDepth', -0.25);
      material.setVector4('uColor', new math.Vector4(0, 0, 1, 1));
      renderer.drawGeometry(geometry, math.Matrix4.IDENTITY, material);
      expect(pixels()).deep.equals(red);

      material.depthTest = false;
      material.stencilTest = true;
      material.stencilReadMask = [0xff, 0xff];
      material.stencilRef = [5, 5];
      material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];
      renderer.drawGeometry(geometry, math.Matrix4.IDENTITY, material);
      expect(pixels()).deep.equals(red.map((color, index) => index % 8 < 4 ? [0, 0, 255, 255] : color));
    });

    for (const fails of [false, true]) {
      it(`restores material state after a ${fails ? 'failed' : 'successful'} geometry mask draw`, () => {
        const renderer = engine.renderer;
        const processor = new MaskProcessor();
        const originalDraw = renderer.drawGeometry;

        material.stencilReadMask = [2, 2];
        material.stencilWriteMask = [4, 4];
        material.depthTest = true;
        material.depthMask = true;
        try {
          if (fails) {
            renderer.drawGeometry = () => {
              expect(material.depthMask).equals(false);
              expect(material.depthTest).equals(true);
              throw new Error('Drawing failed');
            };
            expect(() => processor.drawStencilGeometry(renderer, geometry, math.Matrix4.IDENTITY, material, 0)).throws('Drawing failed');
          } else {
            processor.drawStencilGeometry(renderer, geometry, math.Matrix4.IDENTITY, material, 0);
          }
        } finally {
          renderer.drawGeometry = originalDraw;
        }

        expect(material.colorMask).equals(true);
        expect(material.stencilTest).equals(false);
        expect(material.stencilReadMask).deep.equals([2, 2]);
        expect(material.stencilWriteMask).deep.equals([4, 4]);
        expect(material.depthMask).equals(true);
        expect(material.depthTest).equals(true);
        material.stencilTest = true;
        material.stencilReadMask = [0xff, 0xff];
        material.stencilRef = [1, 1];
        material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];
        renderer.drawGeometry(geometry, math.Matrix4.IDENTITY, material);
        expect(pixels()).deep.equals(Array.from({ length: 64 }, () => fails ? [0, 0, 0, 0] : [255, 0, 0, 255]));
      });
    }
  });
}
