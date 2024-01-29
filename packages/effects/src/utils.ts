import { isObject, LOG_TYPE } from '@galacean/effects-core';

export function isDowngradeIOS (): boolean {
  const iOSVersionRegex = /iPhone OS (\d+)_(\d+)/;
  const match = iOSVersionRegex.exec(navigator.userAgent);

  if (match) {
    return match[1] === '13' || (match[1] === '16' && match[2] === '5');
  }

  return false;
}

/**
 * Web 端使用 console.debug 打印日志
 */
export function inspectWebLogger () {
  const info = console.info;
  const warn = console.warn;
  const error = console.error;

  console.error = (msg, ...args) => {
    if (isObject(msg) && msg.type === LOG_TYPE) {
      console.debug(LOG_TYPE, msg.content, ...args);
    } else {
      error.apply(console, [msg, ...args]);
    }
  };

  console.info = (msg, ...args) => {
    if (isObject(msg) && msg.type === LOG_TYPE) {
      console.debug(LOG_TYPE, msg.content, ...args);
    } else {
      info.apply(console, [msg, ...args]);
    }
  };

  console.warn = (msg, ...args) => {
    if (isObject(msg) && msg.type === LOG_TYPE) {
      console.debug(LOG_TYPE, msg.content, ...args);
    } else {
      warn.apply(console, [msg, ...args]);
    }
  };
}
