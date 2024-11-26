import { lexer, richTextParser as parser, generateProgram, isRichText, type RichTextAST, type Attribute } from '@galacean/effects-plugin-rich-text';
const { expect } = chai;
const richText = `
  We are <b>absolutely <i>definitely</i> not</b> amused
  We are <color=green>green</color> with envy
  We are <b></b> amused.
  We are <b>not</b> amused.
  We are <i>usually</i> not amused.
  We are <size=50>largely</size> unaffected.
  We are <color=#ff0000ff>colorfully</color> amused
`;

const richTextTokens = [
  {
    'tokenType': 'Text',
    'value': '\n  We are ',
  }, {
    'tokenType': 'ContextStart',
    'value': '<b>',
  }, {
    'tokenType': 'Text',
    'value': 'absolutely ',
  }, {
    'tokenType': 'ContextStart',
    'value': '<i>',
  }, {
    'tokenType': 'Text',
    'value': 'definitely',
  }, {
    'tokenType': 'ContextEnd',
    'value': '</i>',
  }, {
    'tokenType': 'Text',
    'value': ' not',
  }, {
    'tokenType': 'ContextEnd',
    'value': '</b>',
  }, {
    'tokenType': 'Text',
    'value': ' amused\n  We are ',
  }, {
    'tokenType': 'ContextStart',
    'value': '<color=green>',
  }, {
    'tokenType': 'Text',
    'value': 'green',
  }, {
    'tokenType': 'ContextEnd',
    'value': '</color>',
  }, {
    'tokenType': 'Text',
    'value': ' with envy\n  We are ',
  }, {
    'tokenType': 'ContextStart',
    'value': '<b>',
  }, {
    'tokenType': 'ContextEnd',
    'value': '</b>',
  }, {
    'tokenType': 'Text',
    'value': ' amused.\n  We are ',
  }, {
    'tokenType': 'ContextStart',
    'value': '<b>',
  }, {
    'tokenType': 'Text',
    'value': 'not',
  }, {
    'tokenType': 'ContextEnd',
    'value': '</b>',
  }, {
    'tokenType': 'Text',
    'value': ' amused.\n  We are ',
  }, {
    'tokenType': 'ContextStart',
    'value': '<i>',
  }, {
    'tokenType': 'Text',
    'value': 'usually',
  }, {
    'tokenType': 'ContextEnd',
    'value': '</i>',
  }, {
    'tokenType': 'Text',
    'value': ' not amused.\n  We are ',
  }, {
    'tokenType': 'ContextStart',
    'value': '<size=50>',
  }, {
    'tokenType': 'Text',
    'value': 'largely',
  }, {
    'tokenType': 'ContextEnd',
    'value': '</size>',
  }, {
    'tokenType': 'Text',
    'value': ' unaffected.\n  We are ',
  }, {
    'tokenType': 'ContextStart',
    'value': '<color=#ff0000ff>',
  }, {
    'tokenType': 'Text',
    'value': 'colorfully',
  }, {
    'tokenType': 'ContextEnd',
    'value': '</color>',
  }, {
    'tokenType': 'Text',
    'value': ' amused\n',
  },
];

const richTextTokenValues = [
  '\n'
  + '  We are ', '<b>', 'absolutely ', '<i>', 'definitely', '</i>', ' not', '</b>', ' amused\n'
  + '  We are ', '<color=green>', 'green', '</color>', ' with envy\n'
  + '  We are ', '<b>', '</b>', ' amused.\n'
  + '  We are ', '<b>', 'not', '</b>', ' amused.\n'
  + '  We are ', '<i>', 'usually', '</i>', ' not amused.\n'
  + '  We are ', '<size=50>', 'largely', '</size>', ' unaffected.\n'
  + '  We are ', '<color=#ff0000ff>', 'colorfully', '</color>', ' amused\n',
];

const richTextAst: RichTextAST[] = [
  { attributes: [], text: '\n  We are ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: 'absolutely ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }, { attributeName: 'i', attributeParam: '' }], text: 'definitely' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: ' not' },
  { attributes: [], text: ' amused\n  We are ' },
  { attributes: [{ attributeName: 'color', attributeParam: 'green' }], text: 'green' },
  { attributes: [], text: ' with envy\n  We are ' },
  { attributes: [], text: ' amused.\n  We are ' },
  { attributes: [{ attributeName: 'b', attributeParam: '' }], text: 'not' },
  { attributes: [], text: ' amused.\n  We are ' },
  { attributes: [{ attributeName: 'i', attributeParam: '' }], text: 'usually' },
  { attributes: [], text: ' not amused.\n  We are ' },
  { attributes: [{ attributeName: 'size', attributeParam: '50' }], text: 'largely' },
  { attributes: [], text: ' unaffected.\n  We are ' },
  { attributes: [{ attributeName: 'color', attributeParam: '#ff0000ff' }], text: 'colorfully' },
  { attributes: [], text: ' amused\n' },
];

const richTextAndContext = [
  { text: '\n  We are ', context: {} },
  { text: 'absolutely ', context: { b: '' } },
  { text: 'definitely', context: { b: '', i: '' } },
  { text: ' not', context: { b: '' } },
  { text: ' amused\n  We are ', context: {} },
  { text: 'green', context: { color: 'green' } },
  { text: ' with envy\n  We are ', context: {} },
  { text: ' amused.\n  We are ', context: {} },
  { text: 'not', context: { b: '' } },
  { text: ' amused.\n  We are ', context: {} },
  { text: 'usually', context: { i: '' } },
  { text: ' not amused.\n  We are ', context: {} },
  { text: 'largely', context: { size: '50' } },
  { text: ' unaffected.\n  We are ', context: {} },
  { text: 'colorfully', context: { color: '#ff0000ff' } },
  { text: ' amused\n', context: {} },
];

describe('test lexer and parser', () => {
  it('lexer', () => {
    const lexed = lexer(richText);

    expect(lexed).to.deep.equals(richTextTokens);

    expect(lexed.map(token => token.value)).to.deep.equals(richTextTokenValues);
  });

  it('parser', () => {
    const parsed = parser(richText);

    expect(parsed).to.deep.equals(richTextAst);
  });

  it('generateProgram', () => {
    const processedTextAndContext: Array<{ text: string, context: Record<string, string | undefined> }> = [];

    const program = generateProgram((text, context) => {
      processedTextAndContext.push({ text, context });
    });

    program(richText);

    expect(processedTextAndContext).to.deep.equals(richTextAndContext);
  });
});

describe('test lexer and parser with wrapped rich text', () => {
  const wrappedRichText = '<del>' + richText + '</del>';

  const wrappedRichTextTokens = [{
    tokenType: 'ContextStart',
    value: '<del>',
  }].concat(richTextTokens).concat([{
    tokenType: 'ContextEnd',
    value: '</del>',
  }]);

  const wrappedRichTextTokenValues = ['<del>'].concat(richTextTokenValues).concat(['</del>']);

  const wrappedRichTextAst: RichTextAST[] = richTextAst.map(node => ({
    ...node,
    attributes: ([{ attributeName: 'del', attributeParam: '' }] as Attribute[]).concat(node.attributes),
  }));

  const wrappedRichTextAndContext = richTextAndContext.map(node => ({
    ...node,
    context: { ...node.context, del: '' },
  }));

  it('lexer', () => {
    const lexed = lexer(wrappedRichText);

    expect(lexed).to.deep.equals(wrappedRichTextTokens);

    expect(lexed.map(token => token.value)).to.deep.equals(wrappedRichTextTokenValues);
  });

  it('parser', () => {
    const parsed = parser(wrappedRichText);

    expect(parsed).to.deep.equals(wrappedRichTextAst);
  });

  it('generateProgram', () => {
    const processedTextAndContext: Array<{ text: string, context: Record<string, string | undefined> }> = [];

    const program = generateProgram((text, context) => {
      processedTextAndContext.push({ text, context });
    });

    program(wrappedRichText);

    expect(processedTextAndContext).to.deep.equals(wrappedRichTextAndContext);
  });
});

const unparsableRichText1 = `
  We are <b>absolutely <i>definitely</b> not</i> amused
`;

const unparsableRichText2 = `
  We are <color=green>absolutely
`;

describe('test unparsable text', () => {
  it('case 1', () => {
    const lexed = lexer(unparsableRichText1);

    expect(lexed).to.deep.equals([
      { tokenType: 'Text', value: '\n  We are ' },
      { tokenType: 'ContextStart', value: '<b>' },
      { tokenType: 'Text', value: 'absolutely ' },
      { tokenType: 'ContextStart', value: '<i>' },
      { tokenType: 'Text', value: 'definitely' },
      { tokenType: 'ContextEnd', value: '</b>' },
      { tokenType: 'Text', value: ' not' },
      { tokenType: 'ContextEnd', value: '</i>' },
      { tokenType: 'Text', value: ' amused\n' },
    ]);

    expect(() => parser(unparsableRichText1)).to.throw('Expect an end tag marker "i" at position 41 but found tag "b"');
  });

  it('case 2', () => {
    const lexed = lexer(unparsableRichText2);

    expect(lexed).to.deep.equals([
      { tokenType: 'Text', value: '\n  We are ' },
      { tokenType: 'ContextStart', value: '<color=green>' },
      { tokenType: 'Text', value: 'absolutely\n' },
    ]);

    expect(() => parser(unparsableRichText2)).to.throw('Expect an end tag marker "color" at position 34 but found no tag!');
  });
});

describe('test isRichText', () => {
  it('should return true for rich text', () => {
    expect(isRichText(richText)).to.be.true;
  });

  it('should return false for unparsable rich text', () => {
    expect(isRichText(unparsableRichText1)).to.be.false;
    expect(isRichText(unparsableRichText2)).to.be.false;
  });
});
