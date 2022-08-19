module.exports = {
  'env': {
    'browser': true,
    'node': true,
    'commonjs': true,
    'es2021': true,
  },
  'extends': [
    'google',
  ],
  'parserOptions': {
    'ecmaVersion': 12,
  },
  'rules': {
    'no-undef': 'error',
    'prefer-const': 'error',
    'require-jsdoc': 'off',
    'quotes': ['error', 'single', {avoidEscape: true}],
    'prefer-const': 'error',
    'func-style': ['error', 'expression'],
    'eqeqeq': 'error',
    'no-var': 'error',
  },
};
