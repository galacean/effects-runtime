const path = require('path');
const { execSync } = require('child_process');

const flatcURI = `https://mdn.alipayobjects.com/rms/uri/file/as/flatc`;
const flatcName = {
  'win32': {
    zip: 'Windows.flatc.binary.zip',
    bin: 'flatc.exe',
  },
  'darwin': {
    zip: 'Mac.flatc.binary.zip',
    bin: 'flatc',
  },
};
const BIN_DIR = execSync('pnpm -w bin').toString().trim();
const FLATC_EXEC = path.join(BIN_DIR, flatcName[process.platform].bin);

module.exports = {
  flatcURI,
  flatcName,
  BIN_DIR,
  FLATC_EXEC,
};
