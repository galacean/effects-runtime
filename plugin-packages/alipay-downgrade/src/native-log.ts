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

import { isAndroid, isIOS, isObject, LOG_TYPE } from '@galacean/effects';

const prefix = '[Galacean Effects Player]';

export function inspectLogger () {
  const info = console.info;
  const warn = console.warn;
  const error = console.error;

  console.error = (msg, ...args) => {
    if (isObject(msg) && msg.type === LOG_TYPE) {
      error.apply(console, [prefix, msg.content, ...args]);
      nativeLogger('error', msg.content, ...args);
    } else {
      error.apply(console, [msg, ...args]);
    }
  };

  console.info = (msg, ...args) => {
    if (isObject(msg) && msg.type === LOG_TYPE) {
      info.apply(console, [prefix, msg.content, ...args]);
      nativeLogger('info', msg.content, ...args);
    } else {
      info.apply(console, [msg, ...args]);
    }
  };

  console.warn = (msg, ...args) => {
    if (isObject(msg) && msg.type === LOG_TYPE) {
      warn.apply(console, [prefix, msg.content, ...args]);
      nativeLogger('info', msg.content, ...args);
    } else {
      warn.apply(console, [msg, ...args]);
    }
  };
}

function nativeLogger (type: string, msg: string, ...args: string[]) {
  if (isAndroid()) {
    androidLogger(type, `${prefix} ${msg}`, ...args);
  } else if (isIOS()) {
    iOSLogger(type, msg, ...args);
  }
}

function iOSLogger (type: string, msg: string, ...args: string[]) {
  try {
    const ap = window.AlipayJSBridge;
    const content = formatMessage(type, msg, ...args);

    ap?.call('H5APLog', {
      content,
    });
  } catch (e) {
    console.error(e);
  }
}

// Android H5 容器支持 console 日志直接写入 aplog
function androidLogger (type: string, msg: string, ...args: string[]) {
  try {
    const ap = window.AlipayJSBridge;

    ap?.call('localLog', {
      'anr_info': 'mars',
      'message': msg + args.join(''),
      'level': type,
    });
  } catch (e) {
    console.error(e);
  }
}

function formatMessage (level: string, msg: string, ...args: string[]) {
  const result = [
    '<MARS_PLAYER>',
    `(${level}):`,
    msg,
  ];

  args.forEach(i => {
    result.push(i + '');
  });

  return result.join(' ');
}
