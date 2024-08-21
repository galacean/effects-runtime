const fs = require('fs');
const chalk = require('chalk');
const download = require('download');
const { execFileSync } = require('child_process');
const { BIN_DIR, FLATC_EXEC, flatcName, flatcURI } = require('./constants');
const { dependencies } = require('../../packages/effects-core/package.json');

const version = dependencies['flatbuffers'];
const url = `${flatcURI}/v${version}/${flatcName[process.platform].zip}`;

if (fs.existsSync(FLATC_EXEC)) {
  try {
    // 执行命令，获取输出
    const stdout = execFileSync(FLATC_EXEC, ['--version'], { encoding: 'utf-8' });

    // 打印命令的输出
    if (stdout.includes(version)) {
      console.info(chalk.gray(stdout));
      console.info(chalk.gray('flatc exist, skip download.'));
      return;
    }
    console.info(chalk.gray(`The latest version of flatc is ${version}, will download...`));
  } catch (error) {
    // 捕捉命令执行错误并打印
    console.log(chalk.red(`execute 'flatc --version' failed: ${error.message}`));
    console.log(chalk.red(`'flatc --version' throw error: ${error.stderr.toString()}`));
    process.exit(1);
  }
}

console.info(chalk.gray(`Download flatc from ${url}`));

download(url, BIN_DIR, { extract: true })
  .then(() => {
    console.log(chalk.green('Downloaded.'));
  })
  .catch(err => {
    console.log(chalk.red(`Download failed: ${err.message}`));
    process.exit(1);
  });

