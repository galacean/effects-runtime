import type { Player } from '@galacean/effects';
import type { PMesh } from '../runtime/mesh';
import { VFX_ITEM_TYPE_3D } from '../plugin/const';
import { PObjectType } from '../runtime/common';
import { ModelMeshComponent } from '../plugin/model-item';

type WebGLContext = WebGL2RenderingContext | WebGLRenderingContext;
const HookSuffix = '_Native';
const number2GLName = new Map();

/**
 * Hook WebGL 相关的 API 调用
 * @param ctx - WebGL 上下文
 */
export function HookOGLFunc (ctx: WebGLContext) {
  console.info('HookOGLFunc ' + Object.getPrototypeOf(ctx));
  let hookCount = 0;

  for (const name in Object.getPrototypeOf(ctx)) {
    if (name === 'getError') { continue; }

    if (typeof ctx[name as keyof WebGLContext] === 'function') {
      ++hookCount;
      //console.log("HookFunc " + each);
      // @ts-expect-error
      ctx[name + HookSuffix] = ctx[name];
      // @ts-expect-error
      ctx[name] = GetHookFunc(ctx, name);
    }
  }
  console.info('HookCount ' + hookCount);

  GetNum2GLName(ctx);
}

function FormatFuncInfo (name: string, args: IArguments): string {
  const prefix = `${name}`;
  const argList: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] == 'number' && number2GLName.has(args[i])) {
      argList.push(number2GLName.get(args[i]) + `(${args[i]})`);
      continue;
    }
    argList.push(args[i]?.toString());
  }

  return prefix + (argList.length > 0 ? '(' + argList.join(', ') + ')' : '()');
}

function FormatErrorInfo (error: GLenum): string {
  const err2Info = new Map();

  err2Info.set(WebGLRenderingContext.NO_ERROR, 'NO_ERROR');
  err2Info.set(WebGLRenderingContext.INVALID_ENUM, 'INVALID_ENUM');
  err2Info.set(WebGLRenderingContext.INVALID_VALUE, 'INVALID_VALUE');
  err2Info.set(WebGLRenderingContext.INVALID_OPERATION, 'INVALID_OPERATION');
  err2Info.set(WebGLRenderingContext.INVALID_FRAMEBUFFER_OPERATION, 'INVALID_FRAMEBUFFER_OPERATION');
  err2Info.set(WebGLRenderingContext.OUT_OF_MEMORY, 'OUT_OF_MEMORY');
  err2Info.set(WebGLRenderingContext.CONTEXT_LOST_WEBGL, 'CONTEXT_LOST_WEBGL');

  return (err2Info.get(error) ?? 'UNKNOWN_ERROR') + `(${error})`;
}

function GetHookFunc (ctx: WebGLContext, name: string) {
  function test () {
    //console.trace();
    // @ts-expect-error
    const ret = ctx[name + HookSuffix].apply(this, arguments);
    const error: GLenum = ctx.getError();

    if (error > 0) {
      console.info('OpenGLError: ' + FormatErrorInfo(error) + ' ===> ' + FormatFuncInfo(name, arguments));
      console.trace();
    } else {
      console.info(FormatFuncInfo(name, arguments));
    }

    return ret;
  }

  return test;
}

function GetNum2GLName (ctx: WebGLContext) {
  for (const name in Object.getPrototypeOf(ctx)) {
    if (typeof ctx[name as keyof WebGLContext] === 'number') {
      number2GLName.set(ctx[name as keyof WebGLContext], name);
    }
  }
}

/**
 * 获取播放器关联的 GPU 信息
 * @param player - 播放器
 * @returns
 */
export function getRendererGPUInfo (player: Player) {
  const instance = player.gpuCapability;

  return JSON.stringify(instance, undefined, 2);
}

/**
 * 获取播放器中 PMesh 对象列表
 * @param player - 播放器
 * @returns
 */
export function getPMeshList (player: Player) {
  const meshList: PMesh[] = [];

  const composition = player.getCompositions()[0];

  composition?.items.forEach(item => {
    if (item.type === VFX_ITEM_TYPE_3D) {
      const meshComponent = item.getComponent(ModelMeshComponent);

      if (meshComponent?.content.type === PObjectType.mesh) {
        meshList.push(meshComponent.content);
      }
    }
  });

  return meshList;
}
