'use strict';

module.exports = require('eslint-config-sukka').sukka({
  js: {
    disableNoConsoleInCLI: ['Build/**']
  },
  node: true
}, {
  rules: {
    'sukka/unicorn/prefer-math-trunc': 'off',
    'sukka/unicorn/prefer-number-properties': ['warn', { checkInfinity: false }]
  }
});
