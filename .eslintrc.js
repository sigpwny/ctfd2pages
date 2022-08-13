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
  },
};
