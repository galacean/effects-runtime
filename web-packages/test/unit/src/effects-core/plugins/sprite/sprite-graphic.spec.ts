import type { MaskableGraphic } from '@galacean/effects';
import {
  MaskComponent, Engine, SpriteComponent, TextComponent, TextureLoadAction, VFXItem, math, spec,
} from '@galacean/effects';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { DomContentComponent } from '@galacean/effects-plugin-dom-content';

const { expect } = chai;

type Graphic = SpriteComponent | TextComponent | RichTextComponent | VideoComponent | DomContentComponent;
const cases = [
  { name: 'sprite', component: SpriteComponent, dataType: spec.DataType.SpriteComponent, options: {} },
  { name: 'text', component: TextComponent, dataType: spec.DataType.TextComponent, options: { text: 'A', fontSize: 16 } },
  { name: 'rich text', component: RichTextComponent, dataType: spec.DataType.RichTextComponent, options: { text: 'A', fontSize: 16 } },
  { name: 'video', component: VideoComponent, dataType: spec.DataType.VideoComponent, options: {} },
  { name: 'HTML', component: DomContentComponent, dataType: spec.DataType.DomContentComponent, options: {} },
];

for (const glType of ['webgl', 'webgl2'] as const) {
  describe(`core/plugins/sprite/graphic/${glType}`, () => {
    let engine: Engine;

    before(() => {
      const canvas = document.createElement('canvas');

      canvas.width = canvas.height = 8;
      engine = new Engine(canvas, { glType });
      engine.renderer.setGlobalMatrix('effects_MatrixVP', math.Matrix4.IDENTITY);
      engine.renderer.setViewport(0, 0, 8, 8);
    });
    after(() => engine.dispose());

    for (const testCase of cases) {
      it(`${testCase.name} supports owned paths and serves as a track matte source`, () => {
        const item = new VFXItem(engine);
        const component = item.addComponent<Graphic>(testCase.component);
        const targetItem = new VFXItem(engine);
        const target = targetItem.addComponent(SpriteComponent);

        try {
          item.duration = 5;
          item.transform.setSize(2, 2);
          const data = {
            id: component.getInstanceId(), item: { id: item.getInstanceId() }, dataType: testCase.dataType,
            renderer: { renderMode: spec.RenderMode.MESH }, options: testCase.options,
          };

          (component as MaskableGraphic).fromData(data);
          component.onUpdate(0);
          // 统一尺寸和纹理，排除文字排版、字形及媒体解码对几何覆盖测试的影响。
          item.transform.setSize(2, 2);
          component.material.setVector2('_Size', item.transform.size);
          component.material.setTexture('_MainTex', engine.assetServer.whiteTexture);
          const render = (graphic: Graphic = component) => {
            engine.renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });
            graphic.render(engine.renderer);
            const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
            const pixels = new Uint8Array(8 * 8 * 4);

            gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            expect(gl.getError()).equals(gl.NO_ERROR);

            return Array.from({ length: 64 }, (_, index) => pixels[index * 4 + 3] > 127);
          };
          const coverage = render();

          expect(coverage.every(Boolean)).equals(true);

          const masks = item.addComponent(MaskComponent);

          masks.setMasks([{
            id: 'left', path: { easingIns: [], easingOuts: [],
              shapes: [{ close: true, indexes: [0, 1, 2, 3].map(point => ({ point, easingIn: 0, easingOut: 0 })) }], points: [
                { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
              ] },
          }]);
          expect(render()).deep.equals(coverage.map((visible, index) => visible && index % 8 < 4));
          masks.setMasks([]);
          targetItem.transform.setSize(2, 2);
          target.onUpdate(0);
          target.maskProcessor.addTrackMatteReference(component);
          expect(render(target)).deep.equals(coverage);
          expect(engine.renderErrors.size).equals(0);
        } finally {
          targetItem.dispose();
          target.geometry.dispose();
          target.material.dispose();
          item.dispose();
          component.geometry.dispose();
          component.material.dispose();
        }
      });
    }
  });
}
