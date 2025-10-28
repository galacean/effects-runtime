enum TokenType {
  ContextStart = 'ContextStart',
  Text = 'Text',
  ContextEnd = 'ContextEnd',
  EscapedChar = 'EscapedChar',
}

export type Token = {
  tokenType: TokenType,
  value: string,
};

const contextStartRegexp = /^<([a-z]+)(=([^>]+))?>$/;
const contextEndRegexp = /^<\/([a-z]+)>$/;

const rules: [TokenType, RegExp][] = [
  [TokenType.EscapedChar, /^\\([=<>\\/])/],
  [TokenType.ContextStart, /^<[a-z]+(=[^>]+)?>/],
  [TokenType.ContextEnd, /^<\/[a-z]+>/],
  [TokenType.Text, /^[^</>=\\]+/],
];

export const lexer = (input: string, lexed: Token[] = [], cursor = 0): Token[] => {
  if (!input) {
    return lexed;
  }

  const escapedMatch = /^\\([=<>\\/])/.exec(input);

  if (escapedMatch) {
    const actualChar = escapedMatch[1];

    return lexer(input.slice(2), lexed.concat({ tokenType: TokenType.Text, value: actualChar }), cursor + 2);
  }

  for (const [tokenType, regex] of rules) {
    if (tokenType === TokenType.EscapedChar) { continue; }

    const match = regex.exec(input);

    if (!match) { continue; }

    const tokenMatch = match[0];
    const len = tokenMatch.length;

    return lexer(input.slice(len), lexed.concat({ tokenType, value: tokenMatch }), cursor + len);
  }

  if (input.length > 0) {
    return lexer(input.slice(1), lexed.concat({ tokenType: TokenType.Text, value: input[0] }), cursor + 1);
  }

  throw new Error(`Unexpected token: "${input[0]}" at position ${cursor} while reading "${input}"`);
};

export type Attribute = {
  attributeName?: string,
  attributeParam?: string,
};

export type RichTextAST = {
  attributes: Attribute[],
  text: string,
};

export const richTextParser = (input: string): RichTextAST[] => {
  const lexed = lexer(input);
  let cursor = 0;

  const shift = () => {
    const shifted = lexed.shift();

    cursor += shifted?.value.length ?? 0;

    return shifted;
  };

  const peek = () => {
    return lexed[0];
  };

  const ast: RichTextAST[] = [];

  function Grammar (attributes: Attribute[] = [], expectedEndAttributeName = '') {
    const parsing = true;

    while (parsing) {
      const maybeText = Text();

      if (maybeText) {
        ast.push({
          attributes,
          text: maybeText,
        });

        continue;
      }

      const { attributeName, attributeParam } = ContextStart();

      if (attributeName) {
        Grammar(attributes.concat({ attributeName, attributeParam: attributeParam ?? '' }), attributeName);

        continue;
      }

      if (expectedEndAttributeName) {
        const { attributeName: endAttributeName } = ContextEnd();

        if (!endAttributeName) {
          throw new Error(`Expect an end tag marker "${expectedEndAttributeName}" at position ${cursor} but found no tag!`);
        }

        if (endAttributeName !== expectedEndAttributeName) {
          throw new Error(`Expect an end tag marker "${expectedEndAttributeName}" at position ${cursor} but found tag "${endAttributeName}"`);
        }

        return;
      }

      break;
    }
  }

  function Text (): string | undefined {
    let combinedText = '';
    let hasTextToken = false;

    while (lexed.length > 0 && lexed[0]?.tokenType === TokenType.Text) {
      const textToken = shift();

      if (textToken) {
        combinedText += textToken.value;
        hasTextToken = true;
      }
    }

    return hasTextToken ? combinedText : undefined;
  }

  function ContextStart (): { attributeName?: string, attributeParam?: string } {
    const maybeContextStart = peek();

    if (maybeContextStart?.tokenType === TokenType.ContextStart) {
      shift();

      const matches = maybeContextStart.value.match(contextStartRegexp);

      if (matches) {
        const attributeName = matches[1];
        const attributeParam = matches[3] ?? '';

        return { attributeName, attributeParam };
      }

      throw new Error(`Expected a start tag marker at position ${cursor}`);
    }

    return {};
  }

  function ContextEnd (): { attributeName?: string } {
    const maybeContextEnd = peek();

    if (maybeContextEnd?.tokenType === TokenType.ContextEnd) {
      shift();

      const matches = maybeContextEnd.value.match(contextEndRegexp);

      if (matches) {
        const attributeName = matches[1];

        return { attributeName };
      }

      throw new Error(`Expect an end tag marker at position ${cursor}`);
    }

    return {};
  }

  Grammar();

  return ast;
};

export function generateProgram (textHandler: (text: string, context: Record<string, string | undefined>) => void) {
  return (richText: string) => {
    const ast = richTextParser(richText);

    for (const node of ast) {
      const text = node.text;
      const context = node.attributes.reduce<Record<string, string | undefined>>((ctx, { attributeName, attributeParam }) => {
        if (attributeName) {
          ctx[attributeName] = attributeParam;
        }

        return ctx;
      }, {});

      textHandler(text, context);
    }
  };
}

export function isRichText (text: string): boolean {
  const lexed = lexer(text);

  const contextTokens = lexed.filter(({ tokenType }) => tokenType === TokenType.ContextStart || tokenType === TokenType.ContextEnd);

  const contextStartTokens = contextTokens.filter(({ tokenType }) => tokenType === TokenType.ContextStart);
  const contextEndTokens = contextTokens.filter(({ tokenType }) => tokenType === TokenType.ContextEnd);

  if (contextStartTokens.length !== contextEndTokens.length || !contextStartTokens.length) {
    return false;
  }

  const tokensOfAttribute = contextTokens.map(({ tokenType, value }) => ({ tokenType, value: tokenType === TokenType.ContextStart ? value.match(contextStartRegexp)![1] : value.match(contextEndRegexp)![1] }));

  function checkPaired ([token, ...restToken]: Token[], startContextAttributes: string[] = []): boolean {
    if (!token) {
      return startContextAttributes.length === 0;
    }

    if (token.tokenType === TokenType.ContextStart) {
      return checkPaired(restToken, startContextAttributes.concat(token.value));
    } else if (token.tokenType === TokenType.ContextEnd) {
      const attributeName = startContextAttributes[startContextAttributes.length - 1];

      if (attributeName !== token.value) {
        return false;
      }

      return checkPaired(restToken, startContextAttributes.slice(0, -1));
    }

    throw new Error(`Unexpected token: ${token.tokenType}`);
  }

  return checkPaired(tokensOfAttribute);
}

/**
 * 转义富文本中的特殊字符
 * @param input - 需要转义的输入字符串
 * @returns 转义后的字符串
 */
export function escape (input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  return input
    .replace(/\\/g, '\\\\')
    .replace(/=/g, '\\=')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/\//g, '\\/');
}

/**
 * 反转义富文本中的特殊字符
 * @param input - 需要反转义的输入字符串
 * @returns 反转义后的字符串
 */
export function unescape (input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  return input
    .replace(/\\\//g, '/')
    .replace(/\\>/g, '>')
    .replace(/\\</g, '<')
    .replace(/\\=/g, '=')
    .replace(/\\\\/g, '\\');
}
