import { escape, unescape } from '@galacean/effects-plugin-rich-text';
const { expect } = chai;

describe('escape function', () => {

  it('standard usage', () => {
    const input = `
    We are <b>absolutely <i>definitely</i> not</b> amused
    We are <color=green>green</color> with envy
    We are <b>${escape('<b>not</b> amused')}</b>
    We are <size=50>${escape('largely=unaffected')}</size> by this
    We are <color=#ff0000ff>${escape('colorfully<>=\\')}</color> amused
    We are <b>${escape('text with \\ backslash')}</b> here
    We are <i>${escape('text with = equals')}</i> here
    We are <del>${escape('text with < less than')}</del> here
    We are <u>${escape('text with > greater than')}</u> here
    We are <code>${escape('text with / forward slash')}</code> here
`;

    const expected = `
    We are <b>absolutely <i>definitely</i> not</b> amused
    We are <color=green>green</color> with envy
    We are <b>\\<b\\>not\\<\\/b\\> amused</b>
    We are <size=50>largely\\=unaffected</size> by this
    We are <color=#ff0000ff>colorfully\\<\\>\\=\\\\</color> amused
    We are <b>text with \\\\ backslash</b> here
    We are <i>text with \\= equals</i> here
    We are <del>text with \\< less than</del> here
    We are <u>text with \\> greater than</u> here
    We are <code>text with \\/ forward slash</code> here
`;

    expect(input).to.equal(expected);
  });

  it('should escape special characters correctly', () => {
    expect(escape('hello world')).to.equal('hello world');
    expect(escape('<b>text</b>')).to.equal('\\<b\\>text\\<\\/b\\>');
    expect(escape('color=red')).to.equal('color\\=red');
    expect(escape('path/to/file')).to.equal('path\\/to\\/file');
    expect(escape('text with \\ backslash')).to.equal('text with \\\\ backslash');
  });

  it('should handle empty string', () => {
    expect(escape('')).to.equal('');
  });

  it('should handle string with only special characters', () => {
    expect(escape('<>=')).to.equal('\\<\\>\\=');
    expect(escape('\\')).to.equal('\\\\');
    expect(escape('/')).to.equal('\\/');
  });

  it('should handle mixed content', () => {
    expect(escape('Hello <b>world</b> with color=red')).to.equal('Hello \\<b\\>world\\<\\/b\\> with color\\=red');
    expect(escape('Path: /home/user/file.txt')).to.equal('Path: \\/home\\/user\\/file.txt');
  });

  it('should throw error for non-string input', () => {
    expect(() => escape(null as unknown as string)).to.throw('Input must be a string');
    expect(() => escape(undefined as unknown as string)).to.throw('Input must be a string');
    expect(() => escape(123 as unknown as string)).to.throw('Input must be a string');
    expect(() => escape({} as unknown as string)).to.throw('Input must be a string');
  });
});

describe('unescape function', () => {
  it('should unescape special characters correctly', () => {
    expect(unescape('hello world')).to.equal('hello world');
    expect(unescape('\\<b\\>text\\</b\\>')).to.equal('<b>text</b>');
    expect(unescape('color\\=red')).to.equal('color=red');
    expect(unescape('path\\/to\\/file')).to.equal('path/to/file');
    expect(unescape('text with \\\\\\\\ backslash')).to.equal('text with \\\\ backslash');
  });

  it('should handle empty string', () => {
    expect(unescape('')).to.equal('');
  });

  it('should handle string with only escaped characters', () => {
    expect(unescape('\\<\\>\\=')).to.equal('<>=');
    expect(unescape('\\\\')).to.equal('\\');
    expect(unescape('\\/')).to.equal('/');
  });

  it('should handle mixed content', () => {
    expect(unescape('Hello \\<b\\>world\\</b\\> with color\\=red')).to.equal('Hello <b>world</b> with color=red');
    expect(unescape('Path: \\/home\\/user\\/file.txt')).to.equal('Path: /home/user/file.txt');
  });

  it('should throw error for non-string input', () => {
    expect(() => unescape(null as unknown as string)).to.throw('Input must be a string');
    expect(() => unescape(undefined as unknown as string)).to.throw('Input must be a string');
    expect(() => unescape(123 as unknown as string)).to.throw('Input must be a string');
    expect(() => unescape({} as unknown as string)).to.throw('Input must be a string');
  });
});

describe('escape and unescape round-trip', () => {
  it('should preserve content through escape -> unescape cycle', () => {
    const testCases = [
      'Hello world',
      '<b>bold text</b>',
      'color=red',
      'path/to/file',
      'text with \\ backslash',
      'mixed <b>content</b> with color=blue and path\\/to\\/file',
      'special chars: <>=\\/',
      'nested <b><i>tags</i></b>',
      'attribute with = and < and >',
      'file path: /home/user/documents/file.txt',
    ];

    testCases.forEach(testCase => {
      const escaped = escape(testCase);
      const unescaped = unescape(escaped);

      expect(unescaped).to.equal(testCase);
    });
  });

  it('should handle complex nested structures', () => {
    const complexText = '<b>Hello <i>world</i> with <color=red>red text</color></b>';
    const escaped = escape(complexText);
    const unescaped = unescape(escaped);

    expect(unescaped).to.equal(complexText);
  });

  it('should handle multiple consecutive special characters', () => {
    const text = '<<<>>>===///\\\\\\';
    const escaped = escape(text);
    const unescaped = unescape(escaped);

    expect(unescaped).to.equal(text);
  });
});

describe('edge cases for escape and unescape', () => {
  it('should handle strings with no special characters', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz 0123456789';

    expect(escape(text)).to.equal(text);
    expect(unescape(text)).to.equal(text);
  });

  it('should handle strings with only special characters', () => {
    const text = '<>=/\\';
    const escaped = escape(text);
    const unescaped = unescape(escaped);

    expect(unescaped).to.equal(text);
  });

  it('should handle strings with mixed escaped and unescaped characters', () => {
    const text = '\\<b\\>text</b>';
    const escaped = escape(text);
    const unescaped = unescape(escaped);

    expect(unescaped).to.equal(text);
  });

  it('should handle very long strings', () => {
    const longText = `${'<b>'.repeat(1000) }text${ '</b>'.repeat(1000)}`;
    const escaped = escape(longText);
    const unescaped = unescape(escaped);

    expect(unescaped).to.equal(longText);
  });
});
