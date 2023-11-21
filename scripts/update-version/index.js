/**
 * some codes from https://github.com/changesets/changesets
 */
const fs = require('fs-extra');
const path = require('path');
const { getPackages } = require('@manypkg/get-packages');
const { listablePackage } = require('./listable-package');
const { getReleasePackageNames, getReleasePackageVersion } = require('./create-changeset');
const { error } = require('./logger');

(async () => {
  const { packages } = await getPackages(process.cwd());
  // 1. 筛选出所有需要更新的包名
  const packagesName = packages
    .filter(pkg => listablePackage(pkg.packageJson))
    .map(pkg => pkg.packageJson.name);
  // 2. 列出选择器：手动选择包
  const releasePackageNames = await getReleasePackageNames(packagesName);
  // 3. 获取选择包的 package.json 绝对路径
  const releasePackagePaths = packages
    .filter(pkg => releasePackageNames.includes(pkg.packageJson.name))
    .map(pkg => path.join(pkg.dir, 'package.json'));
  // 4. 输入：手动输入新版本号
  const version = await getReleasePackageVersion();

  try {
    const jobs = releasePackagePaths.map(async path => {
      const pkgJSON = await fs.readJson(path);

      pkgJSON.version = version;
      await fs.writeFile(path, JSON.stringify(pkgJSON, null, 2) + '\n');
    });

    await Promise.all(jobs);
  } catch (e) {
    error(`Read or write package.json file with some error: ${e.message}`);
  }
})();
