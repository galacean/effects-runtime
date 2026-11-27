import type { Engine, ShaderMacros, spec } from '@galacean/effects';
import { GLSLVersion, glContext, Material, Geometry, math } from '@galacean/effects';
import type { GizmoMesh } from './gizmo-drawing';

const { Vector4 } = math;

export function createWireframeMesh (engine: Engine, source: Geometry, sourceMaterial: Material, color: spec.vec3): GizmoMesh {
  const geometry = createWireframeGeometry(engine, source);
  const { vertex, fragment } = sourceMaterial.shader.shaderData;
  const material = Material.create(engine, {
    ...sourceMaterial.props,
    shader: {
      vertex, fragment, macros: [['PREVIEW_BORDER', 1]] as ShaderMacros, shared: true,
      name: 'model-wireframe',
      glslVersion: engine.displayServer.renderingDevice.gpuCapability.level === 2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
    },
  });

  material.depthTest = true;
  material.setVector4('uPreviewColor', new Vector4(color[0], color[1], color[2], 1));

  return updateWireframeMesh(source, sourceMaterial, { name: 'model-wireframe', geometry, material });
}

export function updateWireframeMesh (source: Geometry, sourceMaterial: Material, wireframe: GizmoMesh): GizmoMesh {
  wireframe.material.cloneUniforms(sourceMaterial);
  for (const name of Object.keys(sourceMaterial.enabledMacros)) { wireframe.material.enableMacro(name, sourceMaterial.enabledMacros[name]); }
  const count = Math.abs(source.getDrawCount());

  if (count && count !== wireframe.geometry.getDrawCount() / 2) {
    const indices = source.getIndexData();
    const lines = indices ? getTriangleIndexData(indices) : getTriangleIndexDataByCount(count);

    wireframe.geometry.setIndexData(lines);
    wireframe.geometry.setDrawCount(lines.length);
  }

  return wireframe;
}

function getTriangleIndexDataByCount (drawCount: number): Uint32Array {
  const faceCount = drawCount / 3;
  const indexData = new Uint32Array(faceCount * 6);

  for (let i = 0; i < faceCount; i++) {
    const idx = i * 6;
    const p0 = i * 3;
    const p1 = p0 + 1;
    const p2 = p0 + 2;

    indexData[idx] = p0;
    indexData[idx + 1] = p1;
    indexData[idx + 2] = p1;
    indexData[idx + 3] = p2;
    indexData[idx + 4] = p2;
    indexData[idx + 5] = p0;
  }

  return indexData;
}

function getTriangleIndexData (oid: ArrayLike<number>): Uint32Array {
  const faceCount = oid.length / 3;
  const indexData = new Uint32Array(faceCount * 6);

  for (let i = 0; i < faceCount; i++) {
    const idx = i * 6;
    const base = i * 3;
    const p0 = oid[base];
    const p1 = oid[base + 1];
    const p2 = oid[base + 2];

    indexData[idx] = p0;
    indexData[idx + 1] = p1;
    indexData[idx + 2] = p1;
    indexData[idx + 3] = p2;
    indexData[idx + 4] = p2;
    indexData[idx + 5] = p0;
  }

  return indexData;
}

function createWireframeGeometry (engine: Engine, source: Geometry): Geometry {
  const geometry = Geometry.create(engine, {
    attributes: {}, indices: { data: new Uint32Array(0) }, mode: glContext.LINES, drawCount: 0,
  });
  const vertexBuffers = source.getVertexBuffers();

  for (const name of Object.keys(vertexBuffers)) { geometry.setVerticesBuffer(vertexBuffers[name]); }

  return geometry;
}
