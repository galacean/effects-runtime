const path = require('path');
const { execSync } = require('child_process');

const flatcURI = `https://github.com/google/flatbuffers/releases/download`;
const binName = {
  'win32': 'Windows.flatc.binary.zip',
  'darwin': 'Mac.flatc.binary.zip',
};
const flatc = {
  'win32': 'flatc.exe',
  'darwin': 'flatc',
};
const BIN_DIR = execSync('pnpm -w bin').toString().trim();
const FLATC_EXEC = path.join(BIN_DIR, flatc[process.platform]);

module.exports = {
  flatcURI,
  binName,
  BIN_DIR,
  FLATC_EXEC,
};
