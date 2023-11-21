import { addItem, removeItem, GPUCapability } from '@galacean/effects';

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext;
type VertexArrayObject = WebGLVertexArrayObject | WebGLVertexArrayObjectOES;

interface HookInfo {
  funcName: string,
  isDelete?: boolean,
  objectList: Object[],
}

interface CheckInfo {
  objectName: string,
  queryFunc: string,
  objectList: Object[],
}

export class GPUMemoryTool {
  static label = 'GPUMemoryTool';
  private gpuCapInitFunc: any;
  private context: WebGLContext | null = null;
  private hookList: HookInfo[] = [];
  private checkList: CheckInfo[] = [];
  private textures: WebGLTexture[] = [];
  private shaders: WebGLShader[] = [];
  private programs: WebGLProgram[] = [];
  private fbos: WebGLFramebuffer[] = [];
  private vaos: VertexArrayObject[] = [];
  private buffers: WebGLBuffer[] = [];
  private renderBuffers: WebGLRenderbuffer[] = [];

  inject () {
    const gpuCap: any = GPUCapability;

    if (gpuCap[GPUMemoryTool.label] === true) {
      return;
    }

    gpuCap[GPUMemoryTool.label] = true;
    // @ts-expect-error
    this.gpuCapInitFunc = GPUCapability.setupCapability;
    // @ts-expect-error
    GPUCapability.setupCapability = (gl: WebGLRenderingContext | WebGL2RenderingContext) => {
      if (this.context === null) {
        this.setupContext(gl);
      }
      this.gpuCapInitFunc(gl);
    };
  }

  uninject () {
    const gpuCap: any = GPUCapability;

    if (gpuCap[GPUMemoryTool.label] !== true) {
      return;
    }

    gpuCap[GPUMemoryTool.label] = undefined;
    // @ts-expect-error
    GPUCapability.setupCapability = this.gpuCapInitFunc;
  }

  clear () {
    this.textures.splice(0, this.textures.length);
    this.shaders.splice(0, this.shaders.length);
    this.programs.splice(0, this.programs.length);
    this.fbos.splice(0, this.fbos.length);
    this.vaos.splice(0, this.vaos.length);
    this.buffers.splice(0, this.buffers.length);
    this.renderBuffers.splice(0, this.renderBuffers.length);
  }

  setupContext (context: WebGLContext) {
    this.clear();
    this.context = context;
    //
    this.hookList = [];
    this.hookList.push({ funcName: 'createTexture', objectList: this.textures });
    this.hookList.push({ funcName: 'deleteTexture', objectList: this.textures, isDelete: true });
    this.hookList.push({ funcName: 'createShader', objectList: this.shaders });
    this.hookList.push({ funcName: 'deleteShader', objectList: this.shaders, isDelete: true });
    this.hookList.push({ funcName: 'createProgram', objectList: this.programs });
    this.hookList.push({ funcName: 'deleteProgram', objectList: this.programs, isDelete: true });
    this.hookList.push({ funcName: 'createFramebuffer', objectList: this.fbos });
    this.hookList.push({ funcName: 'deleteFramebuffer', objectList: this.fbos, isDelete: true });
    this.hookList.push({ funcName: 'createVertexArray', objectList: this.vaos });
    this.hookList.push({ funcName: 'deleteVertexArray', objectList: this.vaos, isDelete: true });
    this.hookList.push({ funcName: 'createVertexArrayOES', objectList: this.vaos });
    this.hookList.push({ funcName: 'deleteVertexArrayOES', objectList: this.vaos, isDelete: true });
    this.hookList.push({ funcName: 'createBuffer', objectList: this.buffers });
    this.hookList.push({ funcName: 'deleteBuffer', objectList: this.buffers, isDelete: true });
    this.hookList.push({ funcName: 'createRenderbuffer', objectList: this.renderBuffers });
    this.hookList.push({ funcName: 'deleteRenderbuffer', objectList: this.renderBuffers, isDelete: true });
    //
    this.checkList = [];
    this.checkList.push({ objectName: 'Texture', queryFunc: 'isTexture', objectList: this.textures });
    this.checkList.push({ objectName: 'Shader', queryFunc: 'isShader', objectList: this.shaders });
    this.checkList.push({ objectName: 'Program', queryFunc: 'isProgram', objectList: this.programs });
    this.checkList.push({ objectName: 'FBO', queryFunc: 'isFramebuffer', objectList: this.fbos });
    this.checkList.push({ objectName: 'VAO', queryFunc: 'isVertexArray', objectList: this.vaos });
    this.checkList.push({ objectName: 'VAOES', queryFunc: 'isVertexArrayOES', objectList: this.vaos });
    this.checkList.push({ objectName: 'Buffer', queryFunc: 'isBuffer', objectList: this.buffers });
    this.checkList.push({ objectName: 'RenderBuffer', queryFunc: 'isRenderbuffer', objectList: this.renderBuffers });
    //
    this.hookWebGLFunc(context);
    this.hookWebGLFunc(this.getVAOExt(context));
  }

  checkWebGLLeak () {
    const stats = {
      ...this.checkLeakObjects(this.context),
      ...this.checkLeakObjects(this.getVAOExt(this.context)),
    };

    const infoList: string[] = [];

    this.checkList.forEach(info => {
      const { objectName } = info;

      if (stats[objectName]) {
        infoList.push(`${objectName} ${stats[objectName]}`);
      }
    });
    if (infoList.length > 0) {
      console.error('Find GPU Memory leak:', infoList.join(', '));
    } else {
      console.info('Release all GPU Memory.');
    }

    return stats;
  }

  private hookWebGLFunc (context: any) {
    if (context === null) {
      return;
    }

    console.info(`==========   hookWebGLFunc: ${Object.getPrototypeOf(context)}   ==========`);
    const hookSuffix = 'old';

    this.hookList.forEach(info => {
      const { funcName, isDelete, objectList } = info;

      if (context[funcName] !== undefined) {
        //console.log(funcName, context[funcName])
        const oldFuncName = funcName + hookSuffix;

        context[oldFuncName] = context[funcName];
        context[funcName] = function () {
          const ret = context[oldFuncName].apply(this, arguments);

          //console.log('hook: ', funcName, ret);
          if (isDelete) {
            removeItem(objectList, arguments[0]);
          } else {
            addItem(objectList, ret);
          }

          return ret;
        };
      }
    });
  }

  private checkLeakObjects (context: any): Record<string, number> {
    if (context === null) {
      return {};
    }

    const stats: Record<string, number> = {};

    this.checkList.forEach(info => {
      const { objectName, queryFunc, objectList } = info;

      if (context[queryFunc] !== undefined) {
        let count = 0;

        objectList.forEach(obj => {
          if (context[queryFunc](obj)) {
            count++;
          }
        });
        if (count > 0) {
          stats[objectName] = count;
          //console.error(`Find ${count} leak object(s) of ${objectName}`);
        }
      }
    });

    return stats;
  }

  private getVAOExt (context: WebGLContext | null): OES_vertex_array_object | null {
    if (context instanceof WebGLRenderingContext) {
      return context.getExtension('OES_vertex_array_object');
    } else {
      return null;
    }
  }
}
