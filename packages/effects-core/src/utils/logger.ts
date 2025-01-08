import { isFunction } from './index';

type LogType = 'info' | 'error' | 'warn';

const prefix = '[Galacean Effects]';
let localLogger: ((type: LogType, message: string, ...args: any[]) => void) | undefined;

function format (message: string) {
  return [
    `%c${prefix}`,
    'color: #AA0100',
    `${message}`,
  ];
}

function error (message: string, ...args: any[]) {
  console.error(...format(message), args);
  localLogger?.('error', message, args);
}

/**
 * info 会转换成浏览器的 console.debug
 * @param message
 * @param args
 */
function info (message: string, ...args: any[]) {
  console.debug(...format(message));
  localLogger?.('info', message, args);
}

function warn (message: string, ...args: any[]) {
  console.warn(...format(message));
  localLogger?.('warn', message, args);
}

/**
 * 注册自定义埋点函数
 *
 * @param fn
 */
function register (fn: (type: LogType, message: string, ...args: any[]) => void) {
  if (fn && isFunction(fn)) {
    localLogger = fn;
  }
}

/**
 * 取消自定义埋点函数
 */
function unregister () {
  localLogger = undefined;
}

export const logger = {
  error,
  info,
  warn,
  register,
  unregister,
};
