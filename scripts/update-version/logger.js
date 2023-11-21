const chalk = require('chalk');
const util = require('util');

let prefix = '🦋 ';

function format(args, customPrefix) {
  const fullPrefix = prefix + (customPrefix === undefined ? '' : ' ' + customPrefix);

  return (
    fullPrefix +
    util
      .format('', ...args)
      .split('\n')
      .join('\n' + fullPrefix + ' ')
  );
}

function error(...args) {
  console.error(format(args, chalk.red('error')));
}

function info(...args) {
  console.info(format(args, chalk.cyan('info')));
}

function log(...args) {
  console.log(format(args));
}

function success(...args) {
  console.log(format(args, chalk.green('success')));
}

function warn(...args) {
  console.warn(format(args, chalk.yellow('warn')));
}

module.exports = {
  prefix,
  error,
  info,
  log,
  success,
  warn,
}
