import stringHash from 'string-hash';
import type {
  Disposable,
  RestoreHandler,
  ShaderCompileResult,
  ShaderLibrary,
  ShaderWithSource,
  SharedShaderWithSource,
} from '@galacean/effects-core';
import { ShaderCompileResultStatus, GLSLVersion } from '@galacean/effects-core';
import { GLProgram } from './gl-program';
import { GLShader } from './gl-shader';
import { assignInspectorName } from './gl-renderer-internal';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { GLEngine } from './gl-engine';

interface GLShaderCompileResult extends ShaderCompileResult {
  program?: WebGLProgram,
}

let shaderSeed = 0;

export class GLShaderLibrary implements ShaderLibrary, Disposable, RestoreHandler {
  readonly shaderResults: Record<string, ShaderCompileResult> = {};

  private readonly glAsyncCompileExt: KHR_parallel_shader_compile | null;
  private programMap: Record<string, GLProgram> = {};
  private glVertShaderMap = new Map<number, WebGLShader>();
  private glFragShaderMap = new Map<number, WebGLShader>();
  private shaderAllDone = false;
  private cachedShaders: Record<string, GLShader> = {};

  constructor (public engine: GLEngine, public pipelineContext: GLPipelineContext) {
    this.glAsyncCompileExt = engine.gpuCapability.glAsyncCompileExt;
  }

  compileAllShaders (asyncCallback?: (results: ShaderCompileResult[]) => void) {
    if (!this.shaderAllDone) {
      const pendings: string[] = [];

      for (const key of Object.keys(this.cachedShaders)) {
        if (!this.cachedShaders[key].initialized) {
          pendings.push(key);
        }
      }

      if (asyncCallback) {
        if (pendings.length) {
          Promise.all<Promise<ShaderCompileResult>[]>(
            pendings.map(key => new Promise(resolve => this.compileShader(this.cachedShaders[key], resolve)))
          )
            .then(asyncCallback)
            .catch(() => 0);
        } else {
          asyncCallback([]);
        }
      } else {
        pendings.map(key => this.compileShader(this.cachedShaders[key]));
      }
      this.shaderAllDone = true;
    } else if (asyncCallback) {
      asyncCallback([]);
    }
  }

  // TODO 创建shader的ShaderWithSource和shader的source类型一样，待优化。
  addShader (shaderSource: ShaderWithSource): string {
    const shaderCacheId = this.computeShaderCacheId(shaderSource);

    if (this.cachedShaders[shaderCacheId]) {
      return shaderCacheId;
    }
    this.shaderAllDone = false;

    const header = shaderSource.glslVersion === GLSLVersion.GLSL3 ? '#version 300 es\n' : '';
    const vertex = shaderSource.vertex ? header + shaderSource.vertex : '';
    const fragment = shaderSource.fragment ? header + shaderSource.fragment : '';

    let shared = false;

    if (shaderSource.shared || (shaderSource as SharedShaderWithSource).cacheId) {
      shared = true;
    }
    this.cachedShaders[shaderCacheId] = new GLShader({
      vertex,
      fragment,
      name: shaderSource.name || shaderCacheId,
      shared,
    });
    this.cachedShaders[shaderCacheId].id = shaderCacheId;

    return shaderCacheId;
  }

  createShader (shaderSource: ShaderWithSource) {
    const shaderCacheId = this.addShader(shaderSource);

    return this.cachedShaders[shaderCacheId];
  }

  compileShader (shader: GLShader, asyncCallback?: (result: ShaderCompileResult) => void) {
    const shaderSource = shader.source;
    let shared = false;

    if (shaderSource.shared || (shaderSource as SharedShaderWithSource).cacheId) {
      shared = true;
    }
    const shaderData = {
      vertex: shaderSource.vertex,
      fragment: shaderSource.fragment,
      name: shaderSource.name,
      shared,
    };

    const gl = this.pipelineContext.gl;
    const result: GLShaderCompileResult = { shared: shaderData.shared, status: ShaderCompileResultStatus.compiling };
    const linkProgram = this.createProgram(gl, shaderData.vertex, shaderData.fragment, result);
    const ext = this.glAsyncCompileExt;
    const startTime = performance.now();
    const setupProgram = (glProgram: GLProgram) => {
      result.status = ShaderCompileResultStatus.success;
      result.compileTime = performance.now() - startTime;
      shader.program = glProgram;
      shader.initialized = true;
      shader.pipelineContext = this.pipelineContext;

      if (this.programMap[shader.id] !== undefined) {
        console.warn('find duplicated shader id', shader.id);
      }
      this.programMap[shader.id] = glProgram;
    };
    const checkComplete = () => {
      const shouldLink =
        !asyncCallback || !ext || (ext && gl.getProgramParameter(result.program!, ext.COMPLETION_STATUS_KHR) == true);
      const program = shouldLink && linkProgram();

      if (program) {
        if (result.status !== ShaderCompileResultStatus.fail) {
          assignInspectorName(program, shaderData.name);
          const glProgram = new GLProgram(this.engine, program, shared, shader.id);

          // FIXME: 这个检测不能在这里调用，安卓上会有兼容性问题。要么开发版使用，要么移到Shader首次使用时
          gl.validateProgram(program);
          const valid = gl.getProgramParameter(program, gl.VALIDATE_STATUS);

          if (!valid) {
            const error = gl.getProgramInfoLog(program);
            const err0 = 'the same texture';

            if (error?.includes(err0)) {
              // 忽略这类错误
              setupProgram(glProgram);
            } else {
              result.status = ShaderCompileResultStatus.fail;
              result.error = error;
              console.error(
                'compileProgramError: ' + error,
                '\nvertex:\n',
                shaderData.vertex,
                '\nfragment:\n',
                shaderData.fragment
              );
              gl.deleteProgram(program);
            }
          } else {
            setupProgram(glProgram);
          }
        }
        if (asyncCallback) {
          asyncCallback(result);
        }
      } else if (asyncCallback) {
        requestAnimationFrame(checkComplete);
      }
    };

    shader.compileResult = result;
    checkComplete();
  }

  private computeShaderCacheId (shader: ShaderWithSource): string {
    const vertex = shader.vertex ? shader.vertex : '';
    const fragment = shader.fragment ? shader.fragment : '';
    let shaderCacheId: string;
    let shared = false;

    if (shader.shared || (shader as SharedShaderWithSource).cacheId) {
      // FIXME: string-hash有冲突，这里先用strHashCode替代
      shaderCacheId = (shader as SharedShaderWithSource).cacheId || `shared_${strHashCode(vertex, fragment)}`;
      shared = true;
    } else {
      shaderCacheId = 'instanced_' + shaderSeed++;
    }

    return shaderCacheId;
  }

  private createProgram (
    gl: WebGLRenderingContext,
    vs: string,
    fs: string,
    result: GLShaderCompileResult
  ): () => WebGLProgram | null {
    const program = gl.createProgram();
    const vertexShader = this.createGLShader(gl, gl.VERTEX_SHADER, vs);
    const fragShader = this.createGLShader(gl, gl.FRAGMENT_SHADER, fs);

    if (program && vertexShader && fragShader) {
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);
      result.program = program;
      result.status = ShaderCompileResultStatus.compiling;

      return function () {
        delete result.program;
        // FIXME: error 没用？
        let error!: string | null;
        const linked = !error && gl.getProgramParameter(program, gl.LINK_STATUS);

        if (!linked) {
          const vsCheckResult = checkShader(gl, vertexShader, 'vertex', vs);
          const fsCheckResult = checkShader(gl, fragShader, 'fragment', fs);

          result.status = ShaderCompileResultStatus.fail;
          if (vsCheckResult) {
            result.error = vsCheckResult.error;
            result.status = vsCheckResult.status;
          }
          if (fsCheckResult) {
            result.error = fsCheckResult.error;
            result.status = fsCheckResult.status;
          }

          return program;
        }

        return program;
      };
    }
    result.status = ShaderCompileResultStatus.fail;

    return () => null;
  }

  private createGLShader (gl: WebGLRenderingContext, shaderType: GLenum, code: string): WebGLShader | null {
    const map = shaderType === gl.VERTEX_SHADER ? this.glVertShaderMap : this.glFragShaderMap;
    const strHash = stringHash(code ?? '');
    const ret = map.get(strHash);

    if (ret) {
      return ret;
    }
    const shader = gl.createShader(shaderType);

    if (shader) {
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      map.set(strHash, shader);
    }

    return shader;
  }

  deleteShader (cacheId: string): void {
    const program = this.programMap[cacheId];

    if (program !== undefined) {
      program.dispose();
      delete this.programMap[cacheId];
    }
    const result = this.shaderResults[cacheId];

    if (result !== undefined) {
      delete this.shaderResults[cacheId];
    }
  }

  restore (): void {
    // TODO
  }

  dispose (): void {
    Object.values(this.programMap).forEach(program => {
      program.dispose();
    });
    this.programMap = {};
    if (this.pipelineContext) {
      const gl = this.pipelineContext.gl;

      this.glFragShaderMap.forEach(shader => {
        gl.deleteShader(shader);
      });
      this.glVertShaderMap.forEach(shader => {
        gl.deleteShader(shader);
      });
      this.glVertShaderMap = new Map<number, WebGLShader>();
      this.glFragShaderMap = new Map<number, WebGLShader>();
    }
  }
}

function checkShader (gl: WebGLRenderingContext, shader: WebGLShader, type: string, code: string) {
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);

    console.error(
      'compile ' + type + ' error: ' + error,
      (code ?? '')
        .split('\n')
        .map((line, index) => `${index + 1} ${line}`)
        .join('\n')
    );

    return { error, status: ShaderCompileResultStatus.fail };
  }
}

function strHashCode (...strings: string[]): number {
  let h = 0;

  for (let j = 0; j < arguments.length; j++) {
    const s = strings[j];

    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
  }

  return h;
}
