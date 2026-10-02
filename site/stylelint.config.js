const SO_VARIAVEL = /^(?!var\().+/;

export default {
  rules: {
    'at-rule-no-unknown': [
      true,
      { ignoreAtRules: ['theme', 'utility', 'apply', 'source', 'custom-variant', 'variant'] },
    ],
    'property-no-unknown': true,
    'block-no-empty': true,
    'no-duplicate-selectors': true,
    'declaration-block-no-duplicate-properties': true,
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
    ],
    'at-rule-disallowed-list': ['font-face'],
    'declaration-property-value-disallowed-list': {
      'font-family': [SO_VARIAVEL],
      'font-size': [SO_VARIAVEL],
      font: [SO_VARIAVEL],
    },
  },
  overrides: [
    {
      files: ['**/cores.css'],
      rules: {
        'color-no-hex': null,
        'color-named': null,
        'function-disallowed-list': null,
      },
    },
    {
      files: ['**/fontes.css'],
      rules: {
        'at-rule-disallowed-list': null,
        'declaration-property-value-disallowed-list': null,
      },
    },
  ],
};
