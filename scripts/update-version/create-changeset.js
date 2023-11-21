const chalk = require('chalk');
const cli = require('./cli-utilities');

async function getReleasePackageNames(packagesName) {
  function askInitialReleaseQuestion(defaultChoiceList) {
    return cli.askCheckboxPlus(
      `Which packages would you like to include?`,
      defaultChoiceList,
      x => {
        if (Array.isArray(x)) {
          return x
            .filter(x => x !== 'all packages')
            .map((x) => chalk.cyan(x))
            .join(', ');
        }
        return x;
      }
    );
  }

  if (packagesName.length > 1) {
    const defaultChoiceList = [{
      name: 'all packages',
      choices: packagesName,
    }].filter(({ choices }) => choices.length !== 0);
    const packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);

    return packagesToRelease.filter(pkgName => pkgName !== 'all packages');
  }

  return [packagesName[0]];
}

async function getReleasePackageVersion() {
  return cli.askQuestion(
    `Input new package version`,
  );
}

module.exports = {
  getReleasePackageNames,
  getReleasePackageVersion,
};
