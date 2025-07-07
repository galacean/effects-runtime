import type {
  Disposable, RestoreHandler, ShaderCompileResult, ShaderLibrary, ShaderMacros, ShaderWithSource,
  SharedShaderWithSource,
} from '@galacean/effects-core';
import { ShaderCompileResultStatus, ShaderType, ShaderFactory } from '@galacean/effects-core';
import { GLProgram } from './gl-program';
import { GLShaderVariant } from './gl-shader';
import { assignInspectorName } from './gl-renderer-internal';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { GLEngine } from './gl-engine';
import { stringHash } from './gl-uniform-utils';

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
  private cachedShaders: Record<string, GLShaderVariant> = {};

  constructor (
    public engine: GLEngine,
    public pipelineContext: GLPipelineContext,
  ) {
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
  addShader (shaderSource: ShaderWithSource, macros?: ShaderMacros): string {
    const mergedMacros: ShaderMacros = [];

    if (shaderSource.macros) {
      mergedMacros.push(...shaderSource.macros);
    }
    if (macros) {
      // TODO 合并 shaderSource.macros 中已经存在的 macro
      mergedMacros.push(...macros);
    }
    const shaderWithMacros = {
      ...shaderSource,
      vertex: ShaderFactory.genFinalShaderCode({
        level: this.engine.gpuCapability.level,
        shaderType: ShaderType.vertex,
        shader: shaderSource.vertex,
        macros: mergedMacros,
      }),
      fragment: ShaderFactory.genFinalShaderCode({
        level: this.engine.gpuCapability.level,
        shaderType: ShaderType.fragment,
        shader: shaderSource.fragment,
        macros: mergedMacros,
      }),
    };
    const shaderCacheId = this.computeShaderCacheId(shaderWithMacros);

    if (this.cachedShaders[shaderCacheId]) {
      return shaderCacheId;
    }
    this.shaderAllDone = false;

    let shared = false;

    if (shaderWithMacros.shared || (shaderWithMacros as SharedShaderWithSource).cacheId) {
      shared = true;
    }
    this.cachedShaders[shaderCacheId] = new GLShaderVariant(this.engine, {
      ...shaderWithMacros,
      vertex: shaderWithMacros.vertex,
      fragment: shaderWithMacros.fragment,
      name: shaderWithMacros.name || shaderCacheId,
      shared,
    });
    this.cachedShaders[shaderCacheId].id = shaderCacheId;

    return shaderCacheId;
  }

  createShader (shaderSource: ShaderWithSource, macros?: ShaderMacros) {
    const shaderCacheId = this.addShader(shaderSource, macros);

    return this.cachedShaders[shaderCacheId];
  }

  compileShader (shader: GLShaderVariant, asyncCallback?: (result: ShaderCompileResult) => void) {
    const { shared: sourceShared, vertex, fragment, name } = shader.source;
    const { cacheId } = shader.source;
    let shared = false;

    if (sourceShared || cacheId) {
      shared = true;
    }

    const gl = this.pipelineContext.gl;
    const result: GLShaderCompileResult = { shared, status: ShaderCompileResultStatus.compiling };
    const linkProgram = this.createProgram(gl, vertex, fragment, result);
    const ext = this.glAsyncCompileExt;
    const startTime = performance.now();
    const setupProgram = (glProgram: GLProgram) => {
      result.status = ShaderCompileResultStatus.success;
      result.compileTime = performance.now() - startTime;
      shader.program = glProgram;
      shader.initialized = true;
      shader.pipelineContext = this.pipelineContext;

      if (this.programMap[shader.id] !== undefined) {
        console.warn(`Find duplicated shader id: ${shader.id}.`);
      }
      this.programMap[shader.id] = glProgram;
      // console.log('compileShader ' + result.cacheId + ' ' + result.compileTime + ' ', shader.source);
    };
    const checkComplete = () => {
      if (this.engine.isDestroyed) {
        console.warn('The player is destroyed during the loadScene process. Please check the timing of calling loadScene and dispose. A common situation is that when calling loadScene, await is not added. This will cause dispose to be called before loadScene is completed.');

        return asyncCallback?.(result);
      }
      if (shader.initialized) {
        return asyncCallback?.(result);
      }
      const shouldLink =
        !asyncCallback ||
        !ext ||
        (ext && gl.getProgramParameter(result.program!, ext.COMPLETION_STATUS_KHR) == true);
      const program = shouldLink && linkProgram();

      if (program) {
        if (result.status !== ShaderCompileResultStatus.fail) {
          assignInspectorName(program, name);
          const glProgram = new GLProgram(this.engine, program, shader.id);

          // FIXME: 这个检测不能在这里调用，安卓上会有兼容性问题。要么开发版使用，要么移到Shader首次使用时
          gl.validateProgram(program);
          const valid = gl.getProgramParameter(program, gl.VALIDATE_STATUS);

          if (!valid) {
            const error = gl.getProgramInfoLog(program);
            const err0 = 'the same texture';
            const err1 = 'Two textures of different types use the same sampler';

            if (error?.includes(err0) || error?.includes(err1)) {
              // 忽略这类错误
              setupProgram(glProgram);
            } else {
              result.status = ShaderCompileResultStatus.fail;
              result.error = error;
              console.error(
                'compileProgramError: ' + error,
                '\nvertex:\n',
                vertex,
                '\nfragment:\n',
                fragment
              );
              gl.deleteProgram(program);
            }
          } else {
            setupProgram(glProgram);
          }
        }
        asyncCallback?.(result);
      } else if (asyncCallback) {
        requestAnimationFrame(checkComplete);
      }
    };

    shader.compileResult = result;
    checkComplete();
  }

  private computeShaderCacheId (shader: ShaderWithSource): string {
    const { vertex = '', fragment = '', shared } = shader;
    const { cacheId } = shader;
    let shaderCacheId: string;

    if (shared || cacheId) {
      shaderCacheId = cacheId || `shared_${stringHash(vertex, fragment)}`;
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
        result.program = undefined;
        const linked = gl.getProgramParameter(program, gl.LINK_STATUS);

        if (!linked) {
          // 链接失败，获取并打印错误信息
          const info = gl.getProgramInfoLog(program);

          console.error(`Failed to link program: ${info}.`);
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
    Object.keys(this.programMap).forEach(key => {
      const program = this.programMap[key];

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
