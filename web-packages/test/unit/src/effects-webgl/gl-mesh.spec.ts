// @ts-nocheck
import { Mesh, glContext } from '@galacean/effects-core';
import { GLMaterial, GLGeometry, GLRenderer } from '@galacean/effects-webgl';

const { expect } = chai;

describe('gl-mesh', () => {
  let canvas = document.createElement('canvas');
  let renderer = new GLRenderer(canvas, 'webgl2');

  after(() => {
    renderer.dispose();
    renderer = null;
    canvas.remove();
    canvas = null;
  });

  it('create GLMesh', () => {
    const result = generateGLMesh(renderer);
    const mesh = result.mesh;
    const geom = result.geom;
    const material = result.material;
    const glRenderer = renderer.glRenderer;

    mesh.material.initialize(renderer.engine);
    mesh.geometry.initialize(renderer.engine);
    const resultGeom = mesh.geometry;
    const gpubuffer = resultGeom.getAttributeBuffer('aPosition');
    const buffer = new Float32Array(8);

    expect(material.shader.program.pipelineContext).to.eql(renderer.pipelineContext);
    expect(material.getVector2('uPos')).to.eql([1, 2]);
    expect(resultGeom).to.eql(geom);
    expect(resultGeom.renderer).not.eql(null);
    gpubuffer.readSubData(0, buffer);
    expect(buffer).to.eql(new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]));

    mesh.dispose();
  });
});

function generateGLMesh (renderer) {
  const vertexShaderStr = `#version 300 es
layout(location = 0) in vec2 aPosition;
uniform vec2 uPos;
void main() {
  gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
}
`;
  const fragmentShaderStr = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;

  const shader = {
    fragment: fragmentShaderStr,
    vertex: vertexShaderStr,
    name: 'base_shader',
  };
  const shaderID = renderer.pipelineContext.shaderLibrary.addShader(shader);

  const mtlOption = {
    shader: {
      cacheId: shaderID,
    },
    states: {
      depthTest: true,
    },
  };
  const material = new GLMaterial(renderer.engine, mtlOption);

  material.setVector2('uPos', [1, 2]);
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

  const geom = new GLGeometry(renderer.engine, geomOption);
  const meshOption = {
    geometry: geom,
    material,
  };
  const mesh = new Mesh(renderer.engine, meshOption);

  return { mesh, material, geom };
}
