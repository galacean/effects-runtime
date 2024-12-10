/**
 * 将日志写到 native 容器的日志中，便于线上问题排查。
 * 打印的日志可以通过海纳上捞取用户本地日志获得。
 *
 * @example
 * ``` ts
 * // 普通日志，使用方法和console日志一样。
 * nativeLog.log('this is native log from h5.');
 * // 错误日志
 * nativeLog.error('this is native log from h5, error:', error);
 * ```
 */
import { isAlipayMiniApp, isAndroid, logger } from '@galacean/effects';
import { canUseBOM } from './utils';

// 非 Web 环境不执行后续逻辑，避免 window 及 navigator 访问报错
if (!canUseBOM) return;

const prefix = '[Galacean Effects]';
const ap = isAlipayMiniApp() ? my : window.AlipayJSBridge;

logger.register(nativeLogger);

function nativeLogger (type: string, msg: string, ...args: string[]) {
  const content: {
    message: string,
    level: string,
    'anr_info'?: string,
  } = {
    'message': `${prefix} ${msg} ${args.join('')}`,
    'level': type,
  };

  if (isAndroid()) {
    content['anr_info'] = 'mars';
  }
  try {
    ap?.call('localLog', content);
  } catch (e) {
    console.error(e);
  }
}
