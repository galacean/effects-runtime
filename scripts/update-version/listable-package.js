const config = require('./config');

function listablePackage(packageJSON) {
  const packageIgnoredInConfig = config.ignore.includes(packageJSON.name);

  if (packageIgnoredInConfig) {
    return false;
  }

  if (packageJSON.private) {
    return false;
  }

  const hasVersionField = !!packageJSON.version;

  return hasVersionField;
}

module.exports = { listablePackage };
