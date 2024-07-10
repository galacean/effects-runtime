import type { ShaderMacros, Geometry, GeometryDrawMode, Engine, GLEngine, spec } from '@galacean/effects';
import { GLSLVersion, glContext, GLGeometry, DestroyOptions, Material, Mesh, createShaderWithMacros, ShaderType, math } from '@galacean/effects';

const { Vector4 } = math;

export function createParticleWireframe (engine: Engine, mesh: Mesh, color: spec.vec3): Mesh {
  const geometry = new SharedGeometry(
    engine,
    {
      geometry: mesh.firstGeometry(),
      mode: glContext.LINES,
      index: {
        data: new Uint16Array(0),
      },
      name: 'testtest',
    });

  const { vertex, fragment, macros, name } = mesh.material.props.shader;
  const materialOptions = { ...mesh.material.props };
  const newMacros = [...(macros || [] as ShaderMacros), ['PREVIEW_BORDER', 1]] as ShaderMacros;
  const level = engine.gpuCapability.level;

  materialOptions.shader = {
    vertex: createGizmoShader(newMacros, vertex, ShaderType.vertex, level),
    fragment: createGizmoShader(newMacros, fragment, ShaderType.fragment, level),
    shared: true,
    name: name + '_wireframe',
    glslVersion: engine.gpuCapability.level === 2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
  };
  const material = Material.create(engine, materialOptions);

  material.depthTest = mesh.material.depthTest;
  material.setVector4('uPreviewColor', new Vector4(color[0], color[1], color[2], 1));

  return updateWireframeMesh(mesh, Mesh.create(
    engine,
    {
      geometry,
      material,
      priority: 3000,
      name: materialOptions.shader.name,
    }), WireframeGeometryType.quad);
}

export enum WireframeGeometryType {
  triangle,
  quad,
}

export function destroyWireframeMesh (mesh: Mesh) {
  mesh.geometry?.dispose();
  mesh.dispose({ material: { textures: DestroyOptions.keep }, geometries: DestroyOptions.keep });
}

export function updateWireframeMesh (originMesh: Mesh, wireframe: Mesh, type: WireframeGeometryType) {
  wireframe.material.cloneUniforms(originMesh.material);

  const geometry = originMesh.firstGeometry();
  const wireframeGeometry = wireframe.firstGeometry();

  if (type === WireframeGeometryType.triangle) {
    // 线框模式不绘制模型的时候，drawCount 为负数
    const drawCount = Math.abs(geometry.getDrawCount());

    if (drawCount !== 0) {
      if (drawCount !== wireframeGeometry.getDrawCount() / 2) {
        const indexData = geometry.getIndexData() as Uint16Array | undefined;
        const data = indexData ? getTriangleIndexData(indexData) : getTriangleIndexDataByCount(drawCount);

        wireframeGeometry.setIndexData(data);
        wireframeGeometry.setDrawCount(data.length);
      }
    }
  } else if (type === WireframeGeometryType.quad) {
    if (geometry.getDrawCount() / 6 !== wireframeGeometry.getDrawCount() / 8) {
      const data = getQuadIndexData(geometry.getDrawCount() / 6, geometry.getIndexData() as Uint16Array);

      wireframeGeometry.setIndexData(data);
      wireframeGeometry.setDrawCount(data.length);
    }
  }

  return wireframe;
}

function getQuadIndexData (faceCount: number, oid: Uint16Array): Uint16Array {
  const indexData = new Uint16Array(faceCount * 8);

  for (let i = 0; i < faceCount; i++) {
    const idx = i * 8;
    const base = i * 4;

    indexData[idx] = base;
    indexData[idx + 1] = 1 + base;
    indexData[idx + 2] = 1 + base;
    indexData[idx + 3] = 3 + base;
    indexData[idx + 4] = 3 + base;
    indexData[idx + 5] = 2 + base;
    indexData[idx + 6] = 2 + base;
    indexData[idx + 7] = base;
  }

  return indexData;
}

export function createModeWireframe (engine: Engine, mesh: Mesh, color: spec.vec3): Mesh {
  const level = engine.gpuCapability.level;
  const geometry = new SharedGeometry(
    engine,
    {
      geometry: mesh.firstGeometry(),
      mode: glContext.LINES,
      index: {
        data: new Uint32Array(0),
      },
    });
  const { vertex, fragment, macros } = mesh.material.props.shader;
  const materialOptions = { ...mesh.material.props };

  const newMacros = [...(macros || [] as ShaderMacros), ['PREVIEW_BORDER', 1]] as ShaderMacros;

  materialOptions.shader = {
    vertex: createGizmoShader(newMacros, vertex, ShaderType.vertex, level),
    fragment: createGizmoShader(newMacros, fragment, ShaderType.fragment, level),
    shared: true,
    name: (mesh.name ?? 'unamedmesh') + '_wireframe',
    glslVersion: engine.gpuCapability.level === 2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
  };

  const material = Material.create(engine, materialOptions);

  material.depthTest = mesh.material.depthTest;
  material.setVector4('uPreviewColor', new Vector4(color[0], color[1], color[2], 1));

  return updateWireframeMesh(mesh, Mesh.create(
    engine,
    {
      geometry,
      material,
      priority: 3000,
      name: materialOptions.shader.name,
    }), WireframeGeometryType.triangle);
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

function getTriangleIndexData (oid: Uint16Array): Uint32Array {
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

export interface SharedGeometryOptions {
  name?: string,
  drawStart?: number,
  drawCount?: number,
  mode?: GeometryDrawMode,
  index?: { data: Uint8Array | Uint16Array | Uint32Array, releasable?: boolean },
  geometry: Geometry,
}

export class SharedGeometry extends GLGeometry {
  private readonly source: GLGeometry;

  constructor (engine: Engine, options: SharedGeometryOptions) {
    super(engine, { attributes: {}, ...options });
    let indexData = options.index ? options.index.data : options.geometry.getIndexData();

    if (indexData) {
      //@ts-expect-error safe to assign
      indexData = new indexData.constructor(indexData) as Uint16Array;
    }
    this.indices = indexData;
    this.source = options.geometry as GLGeometry;
    this.drawCount = options.drawCount || 0;
    this.drawStart = options.drawStart || 0;
    this.mode = options.mode || 0;
    for (const name in this.source.attributes) {
      this.attributes[name] = { ...this.source.attributes[name] };
    }
  }

  override initialize () {
    if (!this.isInitialized) {
      const geometry = this.source;

      geometry.initialize();
      //this.indicesBuffer = this._source.indicesBuffer;
      this.buffers = this.source.buffers;
      this.bufferProps = this.source.bufferProps;
      //this.dirtyFlags = this._source.dirtyFlags;
      //this.vaos = this._source.vaos;
      //创建ibo
      if (this.indices) {
        this.indicesBuffer = this.createIndicesBuffer((this.engine as GLEngine).getGLPipelineContext(), this.indices);
      }
      this.flush();
      this.initialized = true;
    }
  }

  override getAttributeNames (): string[] {
    return this.source.getAttributeNames();
  }

  override flush () {
    this.source.flush();

    super.flush();
  }

  override dispose () {
    // from source geometry
    this.buffers = {};
    this.bufferProps = {};
    super.dispose();
    // @ts-expect-error
    this.source = null;
  }
}

function createGizmoShader (
  macros: ShaderMacros,
  shader: string,
  shaderType: ShaderType,
  level: number,
) {
  const versionTag = /#version\s+\b\d{3}\b\s*(es)?/;
  const shaderMatch = shader.match(versionTag);
  const newShader = shaderMatch ? shader.substring(shaderMatch[0].length) : shader;

  return createShaderWithMacros(macros, newShader, shaderType, level);
}
