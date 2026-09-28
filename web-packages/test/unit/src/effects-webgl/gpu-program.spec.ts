import { Engine, GPUProgram, GPUResource, ShaderCompileResultStatus, ShaderVariant, Asset, spec } from '@galacean/effects-core';
import { GPUProgramWebGL } from '@galacean/effects-webgl';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;
const vertex = 'attribute vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }';
const fragment = 'precision mediump float; void main() { gl_FragColor = vec4(1.0); }';

describe('webgl/gpu-program', () => {
  let engine: Engine;
  let device: RenderingDeviceWebGL;
  let gl: WebGL2RenderingContext;

  beforeEach(() => {
    engine = new Engine(document.createElement('canvas'), { glType: 'webgl2', manualRender: true });
    device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
    gl = device.gl;
  });

  afterEach(() => {
    engine.dispose();
  });

  function createLinkedProgram (): WebGLProgram {
    const program = gl.createProgram()!;

    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type)!;

      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      expect(gl.getShaderParameter(shader, gl.COMPILE_STATUS), gl.getShaderInfoLog(shader) ?? '').equals(true);
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    expect(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program) ?? '').equals(true);

    return program;
  }

  it('registers an unallocated object, preserves attributes and can release and initialize again', () => {
    const count = device['resources'].length;
    const resource = device.createProgram('lifetime');

    expect(resource).instanceOf(GPUProgram);
    expect(resource).instanceOf(GPUResource);
    expect(resource).instanceOf(GPUProgramWebGL);
    expect(resource.program).equals(null);
    expect(device['resources'].length).equals(count + 1);
    const native = createLinkedProgram();

    resource.initialize(native);
    expect(resource.getAttributesNames()).deep.equals(['aPosition']);
    expect(resource.getAttributeLocation(0)).equals(gl.getAttribLocation(native, 'aPosition'));
    expect(resource.getAttributeLocation(1)).equals(-1);
    expect(gl.getParameter(gl.CURRENT_PROGRAM)).equals(null);
    let releases = 0;

    resource.on('releasing', () => {
      releases++;
      expect(resource.device).equals(device);
      expect(gl.isProgram(resource.program)).equals(true);
    });
    resource.releaseGPU();
    expect(releases).equals(1);
    expect(resource.program).equals(null);
    expect(resource.getAttributesNames()).deep.equals([]);
    expect(gl.isProgram(native)).equals(false);
    expect(device['resources'].length).equals(count + 1);
    const replacement = createLinkedProgram();

    resource.initialize(replacement);
    resource.bind();
    expect(gl.getParameter(gl.CURRENT_PROGRAM)).equals(replacement);
    device.useProgram(null);
    resource.dispose();
    resource.dispose();
    expect(releases).equals(2);
    expect(resource.device).equals(null);
    expect(gl.isProgram(replacement)).equals(false);
    expect(device['resources'].length).equals(count);
  });

  it('forgets the released binding without adding an unbind call', () => {
    const resource = device.createProgram('bound');
    const native = createLinkedProgram();

    resource.initialize(native);
    resource.bind();
    expect(device['glCapabilityCache'].useProgram).equals(native);
    resource.releaseGPU();
    expect(device['glCapabilityCache'].useProgram).equals(undefined);
    // WebGL defers deletion of a current program until it is unbound.
    expect(gl.getParameter(gl.CURRENT_PROGRAM)).equals(native);
    device.useProgram(null);
    expect(gl.isProgram(native)).equals(false);
    resource.dispose();
  });

  it('detaches surviving resources on device shutdown and deletes only once', () => {
    const resource = device.createProgram('shutdown');
    const native = createLinkedProgram();

    resource.initialize(native);
    let deletions = 0;
    const deleteProgram = gl.deleteProgram.bind(gl);

    gl.deleteProgram = program => {
      if (program === native) {
        deletions++;
      }
      deleteProgram(program);
    };
    device.dispose();
    expect(resource.device).equals(null);
    expect(resource.program).equals(null);
    expect(deletions).equals(1);
    resource.dispose();
    resource.dispose();
    expect(deletions).equals(1);
  });

  it('keeps the existing shared and private variant disposal behavior', () => {
    const library = device.shaderLibrary;
    const shared = library.createShader({ vertex, fragment, shared: true });

    expect(library.createShader({ vertex, fragment, shared: true })).equals(shared);
    shared.initialize();
    const sharedNative = (shared.program as GPUProgramWebGL).program;

    shared.dispose();
    expect(gl.isProgram(sharedNative)).equals(true);
    const privateVariant = library.createShader({ vertex, fragment });

    privateVariant.initialize();
    const privateNative = (privateVariant.program as GPUProgramWebGL).program;

    privateVariant.dispose();
    expect(gl.isProgram(privateNative)).equals(false);
    library.dispose();
    expect(gl.isProgram(sharedNative)).equals(false);
    expect(device['resources'].filter(resource => resource instanceof GPUProgram)).length(0);
  });

  it('keeps asset identity and shared uniform/sampler ordering when delegating to the program', () => {
    const source = {
      vertex,
      fragment: `precision mediump float;
        uniform float uValue;
        uniform sampler2D uFirst;
        uniform sampler2D uSecond;
        void main() {
          gl_FragColor = (texture2D(uFirst, vec2(0.0)) + texture2D(uSecond, vec2(0.0))) * uValue;
        }`,
      shared: true,
    };
    const variant = device.shaderLibrary.createShader(source);
    const shared = device.shaderLibrary.createShader(source);
    const id = variant.getInstanceId();

    expect(variant).instanceOf(ShaderVariant);
    expect(variant).instanceOf(Asset);
    expect(shared).equals(variant);
    variant.initialize();
    variant.bind();
    const program = (variant.program as GPUProgramWebGL).program!;
    const texture = engine.assetServer.whiteTexture;

    texture.initialize();
    const samplers = ['unused', 'uSecond', 'uFirst'];

    variant.fillShaderInformation(['uValue'], samplers);
    expect(samplers).deep.equals(['unused', 'uSecond', 'uFirst']);
    variant.setFloat('uValue', 0.5);
    variant.setTexture('uFirst', texture);
    variant.setTexture('uSecond', texture);
    expect(gl.getUniform(program, gl.getUniformLocation(program, 'uValue')!)).equals(0.5);
    expect(gl.getUniform(program, gl.getUniformLocation(program, 'uSecond')!)).equals(0);
    expect(gl.getUniform(program, gl.getUniformLocation(program, 'uFirst')!)).equals(1);

    // A later fill still updates sampler order while retaining previously queried uniforms.
    shared.fillShaderInformation([], ['uFirst', 'uSecond']);
    shared.setFloat('uValue', 0.25);
    shared.setTexture('uFirst', texture);
    shared.setTexture('uSecond', texture);
    expect(gl.getUniform(program, gl.getUniformLocation(program, 'uValue')!)).equals(0.25);
    expect(gl.getUniform(program, gl.getUniformLocation(program, 'uFirst')!)).equals(0);
    expect(gl.getUniform(program, gl.getUniformLocation(program, 'uSecond')!)).equals(1);
    variant.toData();
    expect(variant.definition).deep.equals({
      dataType: spec.DataType.Shader,
      id,
      vertex: variant.source.vertex,
      fragment: variant.source.fragment,
    });
  });

  it('unregisters a linked resource when the existing validation path fails', () => {
    const count = device['resources'].length;
    const getProgramParameter = gl.getProgramParameter.bind(gl);

    gl.getProgramParameter = (program, name) => name === gl.VALIDATE_STATUS ? false : getProgramParameter(program, name);
    gl.getProgramInfoLog = () => 'test validation failure';
    const shader = device.shaderLibrary.createShader({ vertex, fragment });

    shader.initialize();
    expect(shader.compileResult.status).equals(ShaderCompileResultStatus.fail);
    expect(shader.initialized).equals(false);
    expect(device['resources'].length).equals(count);
    shader.dispose();
  });
});
