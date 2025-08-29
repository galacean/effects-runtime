import { lexer, richTextParser as parser, generateProgram, isRichText, type RichTextAST } from '@galacean/effects-plugin-rich-text';
const { expect } = chai;

const escapedRichText = `
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

const escapedRichTextTokens = [
  {
    tokenType: 'Text',
    value: '\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<b>',
  }, {
    tokenType: 'Text',
    value: 'absolutely ',
  }, {
    tokenType: 'ContextStart',
    value: '<i>',
  }, {
    tokenType: 'Text',
    value: 'definitely',
  }, {
    tokenType: 'ContextEnd',
    value: '</i>',
  }, {
    tokenType: 'Text',
    value: ' not',
  }, {
    tokenType: 'ContextEnd',
    value: '</b>',
  }, {
    tokenType: 'Text',
    value: ' amused\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<color=green>',
  }, {
    tokenType: 'Text',
    value: 'green',
  }, {
    tokenType: 'ContextEnd',
    value: '</color>',
  }, {
    tokenType: 'Text',
    value: ' with envy\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<b>',
  }, {
    tokenType: 'Text',
    value: '<',
  }, {
    tokenType: 'Text',
    value: 'b',
  }, {
    tokenType: 'Text',
    value: '>',
  }, {
    tokenType: 'Text',
    value: 'not',
  }, {
    tokenType: 'Text',
    value: '<',
  }, {
    tokenType: 'Text',
    value: '/',
  }, {
    tokenType: 'Text',
    value: 'b',
  }, {
    tokenType: 'Text',
    value: '>',
  }, {
    tokenType: 'Text',
    value: ' amused',
  }, {
    tokenType: 'ContextEnd',
    value: '</b>',
  }, {
    tokenType: 'Text',
    value: '\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<size=50>',
  }, {
    tokenType: 'Text',
    value: 'largely',
  }, {
    tokenType: 'Text',
    value: '=',
  }, {
    tokenType: 'Text',
    value: 'unaffected',
  }, {
    tokenType: 'ContextEnd',
    value: '</size>',
  }, {
    tokenType: 'Text',
    value: ' by this\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<color=#ff0000ff>',
  }, {
    tokenType: 'Text',
    value: 'colorfully',
  }, {
    tokenType: 'Text',
    value: '<',
  }, {
    tokenType: 'Text',
    value: '>',
  }, {
    tokenType: 'Text',
    value: '=',
  }, {
    tokenType: 'Text',
    value: '\\',
  }, {
    tokenType: 'ContextEnd',
    value: '</color>',
  }, {
    tokenType: 'Text',
    value: ' amused\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<b>',
  }, {
    tokenType: 'Text',
    value: 'text with ',
  }, {
    tokenType: 'Text',
    value: '\\',
  }, {
    tokenType: 'Text',
    value: ' backslash',
  }, {
    tokenType: 'ContextEnd',
    value: '</b>',
  }, {
    tokenType: 'Text',
    value: ' here\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<i>',
  }, {
    tokenType: 'Text',
    value: 'text with ',
  }, {
    tokenType: 'Text',
    value: '=',
  }, {
    tokenType: 'Text',
    value: ' equals',
  }, {
    tokenType: 'ContextEnd',
    value: '</i>',
  }, {
    tokenType: 'Text',
    value: ' here\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<del>',
  }, {
    tokenType: 'Text',
    value: 'text with ',
  }, {
    tokenType: 'Text',
    value: '<',
  }, {
    tokenType: 'Text',
    value: ' less than',
  }, {
    tokenType: 'ContextEnd',
    value: '</del>',
  }, {
    tokenType: 'Text',
    value: ' here\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<u>',
  }, {
    tokenType: 'Text',
    value: 'text with ',
  }, {
    tokenType: 'Text',
    value: '>',
  }, {
    tokenType: 'Text',
    value: ' greater than',
  }, {
    tokenType: 'ContextEnd',
    value: '</u>',
  }, {
    tokenType: 'Text',
    value: ' here\n  We are ',
  }, {
    tokenType: 'ContextStart',
    value: '<code>',
  }, {
    tokenType: 'Text',
    value: 'text with ',
  }, {
    tokenType: 'Text',
    value: '/',
  }, {
    tokenType: 'Text',
    value: ' forward slash',
  }, {
    tokenType: 'ContextEnd',
    value: '</code>',
  }, {
    tokenType: 'Text',
    value: ' here\n',
  },
];

const escapedRichTextAst: RichTextAST[] = [
  { attributes: [], text: '\n  We are ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: 'absolutely ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }, { attributeName: 'i', attributeParam: '' }], text: 'definitely' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: ' not' },
  { attributes: [], text: ' amused\n  We are ' },
  { attributes: [{ attributeName: 'color', attributeParam: 'green' }], text: 'green' },
  { attributes: [], text: ' with envy\n  We are ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: '<b>not</b> amused' },
  { attributes: [], text: '\n  We are ' },
  { attributes: [{ attributeName: 'size', attributeParam: '50' }], text: 'largely=unaffected' },
  { attributes: [], text: ' by this\n  We are ' },
  { attributes: [{ attributeName: 'color', attributeParam: '#ff0000ff' }], text: 'colorfully<>=\\' },
  { attributes: [], text: ' amused\n  We are ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: 'text with \\ backslash' },
  { attributes: [], text: ' here\n  We are ' },
  { attributes: [{ attributeName: 'i', attributeParam: '' }], text: 'text with = equals' },
  { attributes: [], text: ' here\n  We are ' },
  { attributes: [{ attributeName: 'del', attributeParam: '' }], text: 'text with < less than' },
  { attributes: [], text: ' here\n  We are ' },
  { attributes: [{ attributeName: 'u', attributeParam: '' }], text: 'text with > greater than' },
  { attributes: [], text: ' here\n  We are ' },
  { attributes: [{ attributeName: 'code', attributeParam: '' }], text: 'text with / forward slash' },
  { attributes: [], text: ' here\n' },
];

const escapedRichTextAndContext = [
  { text: '\n  We are ', context: {} },
  { text: 'absolutely ', context: { b: '' } },
  { text: 'definitely', context: { b: '', i: '' } },
  { text: ' not', context: { b: '' } },
  { text: ' amused\n  We are ', context: {} },
  { text: 'green', context: { color: 'green' } },
  { text: ' with envy\n  We are ', context: {} },
  { text: '<b>not</b> amused', context: { b: '' } },
  { text: '\n  We are ', context: {} },
  { text: 'largely=unaffected', context: { size: '50' } },
  { text: ' by this\n  We are ', context: {} },
  { text: 'colorfully<>=\\', context: { color: '#ff0000ff' } },
  { text: ' amused\n  We are ', context: {} },
  { text: 'text with \\ backslash', context: { b: '' } },
  { text: ' here\n  We are ', context: {} },
  { text: 'text with = equals', context: { i: '' } },
  { text: ' here\n  We are ', context: {} },
  { text: 'text with < less than', context: { del: '' } },
  { text: ' here\n  We are ', context: {} },
  { text: 'text with > greater than', context: { u: '' } },
  { text: ' here\n  We are ', context: {} },
  { text: 'text with / forward slash', context: { code: '' } },
  { text: ' here\n', context: {} },
];

describe('test lexer and parser with escaped characters', () => {
  it('lexer with escaped characters', () => {
    const lexed = lexer(escapedRichText);

    expect(lexed).to.deep.equals(escapedRichTextTokens);
  });

  it('parser with escaped characters', () => {
    const parsed = parser(escapedRichText);

    expect(parsed).to.deep.equals(escapedRichTextAst);
  });

  it('generateProgram with escaped characters', () => {
    const processedTextAndContext: Array<{ text: string, context: Record<string, string | undefined> }> = [];

    const program = generateProgram((text, context) => {
      processedTextAndContext.push({ text, context });
    });

    program(escapedRichText);

    expect(processedTextAndContext).to.deep.equals(escapedRichTextAndContext);
  });
});

const complexEscapedRichText = `
  <b>Text with \\<b>nested\\</b> tags</b>
  <color=red>Text with \\= in attribute</color>
  <size=20>Text with \\\\ backslashes</size>
  <i>Text with \\< and \\> symbols</i>
  <del>Text with \\/ forward slash</del>
`;

const complexEscapedRichTextTokens = [
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<b>' },
  { tokenType: 'Text', value: 'Text with ' },
  { tokenType: 'Text', value: '<' },
  { tokenType: 'Text', value: 'b' },
  { tokenType: 'Text', value: '>' },
  { tokenType: 'Text', value: 'nested' },
  { tokenType: 'Text', value: '<' },
  { tokenType: 'Text', value: '/' },
  { tokenType: 'Text', value: 'b' },
  { tokenType: 'Text', value: '>' },
  { tokenType: 'Text', value: ' tags' },
  { tokenType: 'ContextEnd', value: '</b>' },
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<color=red>' },
  { tokenType: 'Text', value: 'Text with ' },
  { tokenType: 'Text', value: '=' },
  { tokenType: 'Text', value: ' in attribute' },
  { tokenType: 'ContextEnd', value: '</color>' },
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<size=20>' },
  { tokenType: 'Text', value: 'Text with ' },
  { tokenType: 'Text', value: '\\' },
  { tokenType: 'Text', value: ' backslashes' },
  { tokenType: 'ContextEnd', value: '</size>' },
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<i>' },
  { tokenType: 'Text', value: 'Text with ' },
  { tokenType: 'Text', value: '<' },
  { tokenType: 'Text', value: ' and ' },
  { tokenType: 'Text', value: '>' },
  { tokenType: 'Text', value: ' symbols' },
  { tokenType: 'ContextEnd', value: '</i>' },
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<del>' },
  { tokenType: 'Text', value: 'Text with ' },
  { tokenType: 'Text', value: '/' },
  { tokenType: 'Text', value: ' forward slash' },
  { tokenType: 'ContextEnd', value: '</del>' },
  { tokenType: 'Text', value: '\n' },
];

const complexEscapedRichTextAst: RichTextAST[] = [
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: 'Text with <b>nested</b> tags' },
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'color', attributeParam: 'red' }], text: 'Text with = in attribute' },
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'size', attributeParam: '20' }], text: 'Text with \\ backslashes' },
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'i', attributeParam: '' }], text: 'Text with < and > symbols' },
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'del', attributeParam: '' }], text: 'Text with / forward slash' },
  { attributes: [], text: '\n' },
];

describe('test complex escaped characters scenarios', () => {
  it('lexer with complex escaped characters', () => {
    const lexed = lexer(complexEscapedRichText);

    expect(lexed).to.deep.equals(complexEscapedRichTextTokens);
  });

  it('parser with complex escaped characters', () => {
    const parsed = parser(complexEscapedRichText);

    expect(parsed).to.deep.equals(complexEscapedRichTextAst);
  });
});

const edgeCaseEscapedRichText = `
  <b>\\<\\>\\=</b>
  <i>\\\\</i>
  <color=blue>\\=</color>
  <size=10>\\<\\>\\=</size>
`;

const edgeCaseEscapedRichTextTokens = [
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<b>' },
  { tokenType: 'Text', value: '<' },
  { tokenType: 'Text', value: '>' },
  { tokenType: 'Text', value: '=' },
  { tokenType: 'ContextEnd', value: '</b>' },
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<i>' },
  { tokenType: 'Text', value: '\\' },
  { tokenType: 'ContextEnd', value: '</i>' },
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<color=blue>' },
  { tokenType: 'Text', value: '=' },
  { tokenType: 'ContextEnd', value: '</color>' },
  { tokenType: 'Text', value: '\n  ' },
  { tokenType: 'ContextStart', value: '<size=10>' },
  { tokenType: 'Text', value: '<' },
  { tokenType: 'Text', value: '>' },
  { tokenType: 'Text', value: '=' },
  { tokenType: 'ContextEnd', value: '</size>' },
  { tokenType: 'Text', value: '\n' },
];

const edgeCaseEscapedRichTextAst: RichTextAST[] = [
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: '<>=' },
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'i', attributeParam: '' }], text: '\\' },
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'color', attributeParam: 'blue' }], text: '=' },
  { attributes: [], text: '\n  ' },
  { attributes: [{ attributeName: 'size', attributeParam: '10' }], text: '<>=' },
  { attributes: [], text: '\n' },
];

describe('test edge cases with escaped characters', () => {
  it('lexer with edge case escaped characters', () => {
    const lexed = lexer(edgeCaseEscapedRichText);

    expect(lexed).to.deep.equals(edgeCaseEscapedRichTextTokens);
  });

  it('parser with edge case escaped characters', () => {
    const parsed = parser(edgeCaseEscapedRichText);

    expect(parsed).to.deep.equals(edgeCaseEscapedRichTextAst);
  });
});

describe('test isRichText with escaped characters', () => {
  it('should return true for rich text with escaped characters', () => {
    expect(isRichText(escapedRichText)).to.be.true;
    expect(isRichText(complexEscapedRichText)).to.be.true;
    expect(isRichText(edgeCaseEscapedRichText)).to.be.true;
  });

  it('should handle escaped characters in isRichText validation', () => {
    const validWithEscapes = '<b>text with \\< and \\></b>';

    expect(isRichText(validWithEscapes)).to.be.true;
  });
});
