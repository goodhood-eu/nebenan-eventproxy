const register = require('@babel/register').default;

register({ extensions: ['.ts', '.tsx', '.js', '.jsx'] });

module.exports = {
  'check-leaks': false,
  recursive: true,
  ui: 'bdd',
  reporter: 'nyan',
  timeout: 2000,
  exclude: [
    'node_modules/**',
  ],
  extension: ['ts'],
  spec: '**/*.test.js',
};
