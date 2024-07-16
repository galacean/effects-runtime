const path = require('path');
const { execSync } = require('child_process');

const flatcURI = `https://github.com/google/flatbuffers/releases/download/`;
const binName = {
  'win32': 'Windows.flatc.binary.zip',
  'darwin': 'Mac.flatc.binary.zip',
};
const BIN_DIR = execSync('pnpm -w bin').toString().trim();
const FLATC_EXEC = path.join(BIN_DIR, 'flatc');

module.exports = {
  flatcURI,
  binName,
  BIN_DIR,
  FLATC_EXEC,
};
