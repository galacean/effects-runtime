module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["**/tsconfig.json"],
  },
  env: {
    browser: true,
    node: true,
    jest: true,
  },
  globals: { 'THREE': true },
  ignorePatterns: [
    '**/{node_modules,libs}',
    '*.js',
    '*.d.ts',
    'temp',
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:promise/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  plugins: [
    "@typescript-eslint",
  ],
  rules: {
    "arrow-parens": ["error", "as-needed"],
    "array-bracket-spacing": ["error", "never"],
    "brace-style": ["error", "1tbs", { "allowSingleLine": true }],
    "comma-dangle": ["error", "always-multiline"],
    "curly": "error",
    "generator-star-spacing": ["error", {
      "before": false,
      "after": true,
      "anonymous": "neither",
      "method": "neither"
    }],
    "new-parens": "error",
    "no-multi-spaces": [
      "error",
      {
        "ignoreEOLComments": true
      }
    ],
    "no-console": ["error", { "allow": ["info", "warn", "error", "debug", "trace"] }],
    "no-inner-declarations": "error",
    "no-multiple-empty-lines": ["error", { "max": 1, "maxEOF": 1 }],
    "no-trailing-spaces": "error",
    "no-void": ["error", { "allowAsStatement": true }],
    "padding-line-between-statements": [
      "error",
      { "blankLine": "always", "prev": "*", "next": ["return", "break"] },
      { "blankLine": "never", "prev": "*", "next": ["case", "default"] },
      { "blankLine": "always", "prev": ["const", "let", "var"], "next": "*" },
      { "blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"] }
    ],
    "promise/always-return": "off",
    // TODO:: will be opened
    "promise/catch-or-return": "off",
    "prefer-rest-params": "off",
    "semi": ["error", "always"],
    "space-in-parens": ["error", "never"],
    "@typescript-eslint/comma-spacing": "error",
    "@typescript-eslint/no-namespace": "off",
    // TODO:: will be ["error", "never"]
    "import/prefer-default-export": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    // TODO:: will be opened
    "@typescript-eslint/ban-types": "off",
    "@typescript-eslint/indent": ["error", 2],
    "@typescript-eslint/keyword-spacing": "error",
    // TODO:: will be opened
    "@typescript-eslint/no-var-requires": "off",
    // TODO:: will be opened
    "@typescript-eslint/no-non-null-assertion": "off",
    // TODO:: will be opened
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-unnecessary-type-arguments": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/no-unnecessary-type-constraint": "error",
    // TODO:: will be opened
    "@typescript-eslint/no-unsafe-return": "off",
    // TODO:: will be opened
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/object-curly-spacing": ["error", "always"],
    "@typescript-eslint/prefer-includes": "error",
    "@typescript-eslint/prefer-reduce-type-parameter": "error",
    "@typescript-eslint/prefer-ts-expect-error": "error",
    "@typescript-eslint/return-await": "error",
    // TODO:: will be opened
    "@typescript-eslint/restrict-plus-operands": "off",
    // TODO:: will be opened
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/space-infix-ops": ["error", { "int32Hint": false }],
    // TODO:: will be "error"
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/no-floating-promises": ["error", { "ignoreVoid": true, "ignoreIIFE": true }],
    "@typescript-eslint/quotes": ["error", "single"],
    // TODO:: will be opened
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/space-before-blocks": "error",
    "@typescript-eslint/space-before-function-paren": ["error", "always"],
    "@typescript-eslint/type-annotation-spacing": "error",
    "@typescript-eslint/unbound-method": "off",
    // TODO:: will be opened
    "@typescript-eslint/no-misused-promises": "off",
    "@typescript-eslint/prefer-regexp-exec": "off",
    "@typescript-eslint/semi": "error",
    // TODO:: will be opened
    "@typescript-eslint/member-delimiter-style": ["error", {
      "multiline": {
        "delimiter": "comma",
        "requireLast": true
      },
      "singleline": {
        "delimiter": "comma",
        "requireLast": false
      }
    }],
    "@typescript-eslint/no-unsafe-enum-comparison": "warn",
    "@typescript-eslint/no-base-to-string": "off",
    "@typescript-eslint/no-duplicate-enum-values": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    // TODO:: will be opened
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        "prefer": "type-imports",
        "disallowTypeAnnotations": false,
      },
    ],
  },
};
