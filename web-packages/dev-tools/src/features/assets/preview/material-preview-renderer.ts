import type { Engine, GPUFramebuffer, spec, Geometry } from '@galacean/effects';
import { Material, RenderPassAttachmentStorageType, Renderer, SerializationHelper, Shader, ShaderCompileResultStatus,
  Texture, TextureLoadAction, TextureSourceType, TextureStoreAction, glContext, math } from '@galacean/effects';
import { GLShaderLibrary, type GPUTextureWebGL } from '@galacean/effects-webgl';
import { createGeometry, GeometryType } from '@galacean/effects-plugin-editor-gizmo';
import type { EditorRenderingDevice } from '../../../platform/effects-runtime/editor-rendering-device';
import { ImGuiTextureBinding } from '../../../platform/imgui/texture-binding';
import type { RenderedPreview } from './texture-preview-cache';
import { materialPreviewCamera, thumbnailMaterialView, type MaterialPreviewSettings, type PreviewPrimitive } from './material-preview-settings';

export interface MaterialPreviewInput {
  data: spec.MaterialData,
  shader: spec.ShaderData,
  version: string,
  material?: Material,
  view?: MaterialPreviewSettings,
}

function previewShader (shader: spec.ShaderData, lit: boolean): spec.ShaderData {
  if (!lit || !shader.fragment.includes('gl_FragColor')) { return shader; }
  const main = /\bvoid\s+main\s*\(\s*(?:void)?\s*\)/;
  const code = shader.fragment.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, comment => ' '.repeat(comment.length));
  const match = main.exec(code);

  if (!match) { return shader; }
  let depth = 0, closing = -1;

  for (let index = code.indexOf('{', match.index); index < code.length; index++) {
    if (code[index] === '{') { depth++; }
    if (code[index] === '}' && --depth === 0) {
      closing = index;

      break;
    }
  }
  if (closing < 0) { return shader; }
  const attribute = '\\b(?:attribute|in)\\s+(?:(?:lowp|mediump|highp)\\s+)?vec3\\s+';
  const normal = new RegExp(attribute + 'a_Normal\\b').test(shader.vertex) ? 'a_Normal' : 'aNormal';
  const declaration = new RegExp(attribute + normal + '\\b').test(shader.vertex) ? '' : 'attribute vec3 ' + normal + ';';
  const lighting = `
  vec3 assetN = normalize(assetPreviewNormal);
  float assetDiffuse = max(dot(assetN, normalize(_AssetPreviewLight)), 0.0);
  vec3 assetHalf = normalize(normalize(_AssetPreviewLight) + _AssetPreviewView);
  float assetHighlight = pow(max(dot(assetN, assetHalf), 0.0), 40.0) * 0.09;
  gl_FragColor.rgb = gl_FragColor.rgb * (0.25 + 0.75 * assetDiffuse) + vec3(assetHighlight * gl_FragColor.a);
`;

  return { ...shader,
    vertex: shader.vertex.replace(main, 'void assetPreviewVertex()') + `
${declaration}
uniform mat4 _AssetPreviewWorld;
varying vec3 assetPreviewNormal;
void main() { assetPreviewVertex(); assetPreviewNormal = mat3(_AssetPreviewWorld) * ${normal}; }
`,
    fragment: shader.fragment.slice(0, match.index) + 'varying vec3 assetPreviewNormal;\nuniform vec3 _AssetPreviewLight;\nuniform vec3 _AssetPreviewView;\n'
      + shader.fragment.slice(match.index, closing) + lighting + shader.fragment.slice(closing),
  };
}

/** Owns preview shader programs without adding them to the scene's shader library. */
class MaterialPreviewShader extends Shader {
  constructor (engine: Engine, private readonly library: GLShaderLibrary, data: spec.ShaderData) {
    super(engine); this.unregisterObject();
    this.shaderData = { ...data };
  }

  override createVariant (macros?: Record<string, number | boolean>) {
    const variant = this.library.createShader({ ...this.shaderData, shared: true, cacheId: undefined }, Object.entries(macros ?? {}));

    variant.unregisterObject();
    if (!variant.initialized && variant.compileResult?.status !== ShaderCompileResultStatus.fail) { this.library.compileShader(variant); }

    return variant;
  }
}

/** Renders an isolated material preview using the editor's existing graphics device. */
export class MaterialPreviewRenderer implements RenderedPreview {
  readonly texture: ImGuiTextureBinding;
  readonly flipY = true;
  error?: string;
  private readonly renderer: Renderer;
  private geometry?: Geometry;
  private primitive?: PreviewPrimitive;
  private readonly target: GPUFramebuffer;
  private readonly color: Texture;
  private material?: Material;
  private shader?: MaterialPreviewShader;
  private library?: GLShaderLibrary;
  private shaderVersion = '';
  private version = '';
  private ready = false;
  private disposed = false;

  get byteSize (): number { return this.width * this.height * 8; }

  get statistics (): string {
    const vertices = this.geometry?.getAttributeData('a_Position')?.length ?? 0;

    return Math.floor((this.geometry?.getDrawCount() ?? 0) / 3) + ' triangles  |  ' + Math.floor(vertices / 3) + ' vertices';
  }

  constructor (private readonly engine: Engine, readonly width: number, readonly height: number, private readonly source: () => MaterialPreviewInput) {
    const device = engine.displayServer.renderingDevice;

    this.renderer = Renderer.create(engine);
    this.color = Texture.create(engine, {
      name: 'MaterialPreviewColor', sourceType: TextureSourceType.framebuffer, data: { width, height },
      minFilter: glContext.LINEAR, magFilter: glContext.LINEAR, wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE,
    });
    this.color.unregisterObject();
    this.target = device.createFramebuffer({
      name: 'MaterialPreview', attachments: [this.color], viewport: [0, 0, width, height],
      depthStencilAttachment: { storageType: RenderPassAttachmentStorageType.depth_stencil_opaque },
      storeAction: { colorAction: TextureStoreAction.store },
    });
    this.texture = new ImGuiTextureBinding(() => {
      if (!this.ready || this.disposed || device.contextWasLost || this.color.isDestroyed) { return null; }

      return (this.color.getGPUTexture() as GPUTextureWebGL).textureBuffer;
    }, true);
    for (const name of ['effects_MatrixVP', 'effects_MatrixV', 'effects_MatrixInvV', '_MatrixP']) {
      this.renderer.setGlobalMatrix(name, math.Matrix4.IDENTITY);
    }
    this.renderer.setGlobalVector3('effects_WorldSpaceCameraPos', new math.Vector3(0, 0, 1));
  }

  render (time: number): void {
    const device = this.engine.displayServer.renderingDevice as EditorRenderingDevice;

    if (this.disposed || device.contextWasLost || device.gl.isContextLost()) { return; }
    device.prepareFrame();
    const input = this.source(), view = input.view ?? thumbnailMaterialView;
    const material = this.sync(input, view);

    this.prepareGeometry(view.primitive);
    const camera = materialPreviewCamera(view), model = math.Matrix4.IDENTITY;
    const world = camera.world.elements;

    this.renderer.setGlobalMatrix('effects_MatrixVP', camera.viewProjection);
    this.renderer.setGlobalMatrix('effects_MatrixV', camera.view);
    this.renderer.setGlobalMatrix('effects_MatrixInvV', camera.world);
    this.renderer.setGlobalMatrix('_MatrixP', camera.projection);
    this.renderer.setGlobalVector3('effects_WorldSpaceCameraPos', new math.Vector3(world[12], world[13], world[14]));
    material.setMatrix('_AssetPreviewWorld', model);
    material.setVector3('_AssetPreviewView', new math.Vector3(world[8], world[9], world[10]));
    material.setVector3('_AssetPreviewLight', new math.Vector3(Math.sin(view.lightYaw) * Math.cos(view.lightPitch), Math.sin(view.lightPitch), Math.cos(view.lightYaw) * Math.cos(view.lightPitch)));

    material.createShaderVariant();
    if (material.shaderVariant.compileResult?.status !== ShaderCompileResultStatus.success) {
      throw new Error(material.shaderVariant.compileResult?.error || 'The material shader could not be compiled.');
    }
    material.setVector4('_Time', new math.Vector4(time / 20, time, time * 2, time * 3));
    material.setFloat('uTime', time);
    this.target.initialize();
    this.renderer.setFramebuffer(this.target);
    this.renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0],
      depthAction: TextureLoadAction.clear, clearDepth: 1, stencilAction: TextureLoadAction.clear, clearStencil: 0 });
    const doubleSided = !material.culling && view.primitive !== 'plane';

    if (doubleSided) {
      material.culling = true; material.cullFace = glContext.FRONT;
      this.renderer.drawGeometry(this.geometry!, model, material);
      material.cullFace = glContext.BACK;
    }
    this.renderer.drawGeometry(this.geometry!, model, material);
    if (doubleSided) { material.culling = false; }
    this.ready = true;
  }

  private sync (input: MaterialPreviewInput, view: MaterialPreviewSettings): Material {
    const shaderVersion = JSON.stringify([input.shader, view.lit]);

    if (input.version === this.version && shaderVersion === this.shaderVersion && this.material) { return this.material; }

    if (shaderVersion !== this.shaderVersion || !this.material) {
      this.disposeMaterial();
      const device = this.engine.displayServer.renderingDevice as EditorRenderingDevice;

      this.library = new GLShaderLibrary(device);
      this.shader = new MaterialPreviewShader(this.engine, this.library, previewShader(input.shader, view.lit));
      this.material = new Material(this.engine); this.material.unregisterObject();
      this.shaderVersion = shaderVersion;
    }
    const material = this.material;
    const textures = Object.fromEntries(Object.entries(input.data.textures).map(([name, value]) => {
      const texture = value.texture as unknown as Texture;

      return [name, { ...value, texture: texture instanceof Texture && !texture.isDestroyed ? texture : this.engine.assetServer.whiteTexture }];
    }));
    const data = { ...input.data, id: material.getInstanceId(), shader: this.shader, textures } as unknown as spec.MaterialData;

    SerializationHelper.deserialize(data, material);
    if (input.material) {
      material.cloneUniforms(input.material);
      material.blending = input.material.blending;
      material.blendFunction = input.material.blendFunction;
      material.blendEquation = input.material.blendEquation;
      material.culling = input.material.culling; material.cullFace = input.material.cullFace; material.frontFace = input.material.frontFace;
    }
    for (const name of Object.keys(material.enabledMacros)) { material.disableMacro(name); }
    for (const [name, value] of Object.entries(input.material?.enabledMacros ?? Object.fromEntries((input.data.macros ?? []).map(name => [name, true])))) { material.enableMacro(name, value); }
    material.setVector2('_Size', new math.Vector2(1, 1));
    material.setVector3('_Scale', new math.Vector3(1, 1, 1));
    if (!material.getColor('_Color')) { material.setColor('_Color', new math.Color(1, 1, 1, 1)); }
    if (!material.getVector4('_TexParams')) { material.setVector4('_TexParams', new math.Vector4(1, 1, 1, 0)); }
    const params = material.getVector4('_TexParams')!;

    material.setVector4('_TexParams', new math.Vector4(params.x, params.y, 1, params.w));
    if (!material.getVector4('_TexOffset')) { material.setVector4('_TexOffset', new math.Vector4(0, 0, 1, 1)); }
    if (!material.getTexture('_MainTex')) { material.setTexture('_MainTex', this.engine.assetServer.whiteTexture); }
    material.stencilTest = false;
    material.depthTest = true; material.depthMask = true;
    this.version = input.version;

    return material;
  }

  private prepareGeometry (primitive: PreviewPrimitive): void {
    if (this.primitive === primitive && this.geometry) { return; }
    this.geometry?.dispose();
    const type = { sphere: GeometryType.Sphere, plane: GeometryType.Plane, cube: GeometryType.Box, cylinder: GeometryType.Cylinder }[primitive];
    const geometry = createGeometry(this.engine, type, { radius: 1, width: 1.7, height: 1.7, depth: 1.7, widthSegments: 48, heightSegments: 32, radialSegments: 48 });
    const layout = geometry.getVertexLayout()!, buffers = geometry.getVertexBuffers();
    const aliases = { a_Position: 'aPos', a_Normal: 'aNormal', a_UV1: 'aUV' };
    const elements = [...layout.elements, ...layout.elements.filter(element => element.name in aliases).map(element => ({ ...element, name: aliases[element.name as keyof typeof aliases] }))];
    const device = this.engine.displayServer.renderingDevice;

    geometry.setVertexBuffers(buffers, device.getVertexLayout(elements, buffers.map(buffer => buffer?.byteStride ?? 0)));
    geometry.unregisterObject(); this.geometry = geometry; this.primitive = primitive;
  }

  private disposeMaterial (): void {
    this.material?.dispose(); this.shader?.dispose(); this.library?.dispose();
    this.material = undefined; this.shader = undefined; this.library = undefined;
  }

  dispose (): void {
    if (this.disposed) { return; }
    this.disposed = true; this.ready = false;
    this.disposeMaterial(); this.geometry?.dispose(); this.target.dispose(); this.renderer.dispose();
  }
}
