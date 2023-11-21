const fs = require('fs');
const path = require('path');

export default function glslInner() {
  return {
    name: 'rollup-plugin-glsl-inner',
    transform(code, id) {
      if (path.extname(id) !== '.glsl') {
        return;
      }
      const dirPath = path.dirname(id);
      // proceed with the transformation...
      const assembleImportContent = processContent(code, dirPath);
      const assemblePragmaContent = processContent(assembleImportContent, dirPath, 'pragma');

      return {
        code: `export default ${JSON.stringify(compressShader(assemblePragmaContent))}`,
        map: { mappings: '' }
      };
    },
  };
}

function processContent(content, dirPath, keyword = 'import') {
  const reg = new RegExp(`#${keyword}[\\s\\t]+('|")(.*?)\\1;?`);
  let ret;

  while (ret = reg.exec(content)) {
    const [matchLine, _, filepath] = ret;
    const filename = path.join(dirPath, filepath);
    const data = fs.readFileSync(filename, { encoding: 'utf8' });

    content = content.replace(matchLine, data);
  }

  return content;
}

// Based on https://github.com/vwochnik/rollup-plugin-glsl
function compressShader(code) {
  let needNewline = false;
  return code
    .replace(/\\(?:\r\n|\n\r|\n|\r)|\/\*.*?\*\/|\/\/(?:\\(?:\r\n|\n\r|\n|\r)|[^\n\r])*/gs, '')
    .split(/\n+/)
    .reduce(
      (result, line) => {
        line = line.trim().replace(/\s{2,}|\t/, ' '); // lgtm[js/incomplete-sanitization]
        if (line.charAt(0) === '#') {
          if (needNewline) {
            result.push('\n');
          }
          result.push(line, '\n');
          needNewline = false;
        } else {
          result.push(line.replace(/\s*({|}|=|\*|,|\+|\/|>|<|&|\||\[|\]|\(|\)|-|!|;)\s*/g, '$1'));
          needNewline = true;
        }
        return result;
      }, []
    )
    .join('')
    .replace(/\n+/g, '\n');
}

// TEST
// const filePath = path.join(process.cwd(), 'packages', 'mars-core', 'src', 'shader', 'item.frag.glsl');
// const code = fs.readFileSync(filePath, 'utf-8');
// const ins = glslInner();
// const { code: result } = ins.transform(code, filePath);

// console.log(result);
