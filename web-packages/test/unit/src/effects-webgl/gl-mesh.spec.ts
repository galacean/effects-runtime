import type { MaterialProps } from '@galacean/effects';
import { Mesh, glContext, math } from '@galacean/effects';
import type { GLShaderVariant } from '@galacean/effects-webgl';
import { GLMaterial, GLGeometry, GLRenderer } from '@galacean/effects-webgl';
import { sleep } from '../utils';

const { expect } = chai;

describe('webgl/gl-mesh', () => {
  let canvas = document.createElement('canvas');
  let renderer = new GLRenderer(canvas, 'webgl2');

  after(() => {
    renderer.dispose();
    // @ts-expect-error
    renderer = null;
    canvas.remove();
    // @ts-expect-error
    canvas = null;
  });

  it('create GLMesh', async () => {
    const result = generateGLMesh(renderer);
    const mesh = result.mesh;
    const geometry = result.geometry;
    const material = result.material;

    mesh.material.initialize();
    mesh.geometry.initialize();
    const resultGeom = mesh.geometry as GLGeometry;
    const gpubuffer = resultGeom.getAttributeBuffer('aPosition');
    const buffer = new Float32Array(8);
    const position = material.getVector2('uPos');

    await sleep(100);
    // @ts-expect-error private property
    expect((material.shaderVariant as GLShaderVariant).program.engine).to.eql((renderer.engine as GLEngine));
    expect(position?.x).to.eql(1);
    expect(position?.y).to.eql(2);
    expect(resultGeom).to.eql(geometry);
    expect(resultGeom.engine.renderer).not.eql(null);
    gpubuffer?.readSubData(0, buffer);
    expect(buffer).to.eql(new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]));

    mesh.dispose();
  });
});

function generateGLMesh (renderer: GLRenderer) {
  const vertex = `attribute vec2 aPosition;
uniform vec2 uPos;
void main() {
  gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
}
`;
  const fragment = `precision highp float;
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;
  const shader = {
    fragment,
    vertex,
    name: 'base_shader',
  };
  const mtlOption = {
    shader,
    states: {
      depthTest: true,
    },
  };
  const material = new GLMaterial(renderer.engine, mtlOption as unknown as MaterialProps);

  material.setVector2('uPos', new math.Vector2(1, 2));
  const position = {
    data: new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]),
    size: 2,
    stride: 0,
    offset: 0,
    normalize: false,
    releasable: false,
  };
  const geomOption = {
    attributes: {
      'aPosition': position,
    },
    index: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
    drawCount: 6,
    drawStart: 0,
    mode: glContext.TRIANGLES,
  };

  const geometry = new GLGeometry(renderer.engine, geomOption);
  const meshOption = {
    geometry,
    material,
  };
  const mesh = new Mesh(renderer.engine, meshOption);

  return { mesh, material, geometry };
}
