const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execFileSync } = require('child_process');
const minimist = require('minimist');
const { FLATC_EXEC } = require('./constants');

const defaultOptions = {
  language: 'ts',
  outputDir: null,
  genMutable: false,
  genObjectApi: false,
  genOnefile: false,
  genAll: false,
  noJsExports: false,
  googJsExport: false,
}

function flatc(files, options) {
  const args = [];
  const { language, outputDir } = { ...defaultOptions, ...options };

  // add language options
  for (const lang of [].concat(language)) {
    args.push('--' + lang);
  }
  // add outputDir options
  if (outputDir) {
    args.push('-o');
    args.push(outputDir);
  }
  // add boolean properties
  for (const [key, value] of Object.entries(options)) {
    if (value === true) {
      args.push(camel2Kebab(`--${key}`));
    }
  }
  // add input files
  for (const file of [].concat(files)) {
    args.push(file);
  }
  // run flatc command
  try {
    console.log(`Start execute 'flatc'.`);
    console.log(chalk.gray(`The args: ${args.join(' ')}`));
    execFileSync(FLATC_EXEC, args, { encoding: 'utf-8' });
    console.log(chalk.green(`Execute 'flatc' success.`));
  } catch (e) {
    console.log(chalk.red(`Execute 'flatc' error: ${e.message}`));
    console.log(chalk.red(`'flatc' throw error: ${e.stderr.toString()}`));
  }
}

/**
 * camelCaseToKebabCase1Example => camel-case-to-kebab-case1-example
 */
function camel2Kebab(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '\$1-\$2') // 在小写或数字和大写字母之间添加连字符
    .toLowerCase();
}

async function deleteFiles(fold, extname = '.ts') {
  try {
    const files = await fs.readdir(fold);

    await Promise.all(files.map(async file => {
      const filePath = path.join(fold, file);

      if ((await fs.stat(filePath)).isFile() && file.endsWith(extname)) {
        await fs.remove(filePath);
        console.log(chalk.gray(`Deleted file: ${path.relative(process.cwd(), filePath)}`));
      } else if ((await fs.stat(filePath)).isDirectory()) {
        await deleteFiles(filePath, extname);
      }
    }));
  } catch (err) {
    console.error('Error occurred while deleting files', err);
  }
}

// 获取命令行参数
const args = minimist(process.argv.slice(2));
const { _: files } = args;

(async () => {
  if (!fs.existsSync(FLATC_EXEC)) {
    console.log(chalk.gray(`'flatc' not found, generate step is skipped.`));
    return;
  }

  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file);
    const outputDir = path.dirname(filePath);

    console.log(`Start delete files in ${outputDir}`);
    await deleteFiles(outputDir);
    console.log(chalk.green(`Delete success.`));

    // 执行 flatc 命令
    flatc(filePath, {
      outputDir,
      genObjectApi: true,
    });
  }
})();
