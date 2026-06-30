'use strict';

module.exports = require('eslint-config-sukka').sukka({
  ignores: [
    '**/*.conf',
    '**/*.txt'
  ],
  js: {
    disableNoConsoleInCLI: ['Build/**']
  },
  node: true,
  ts: true,
  yaml: false
}, {
  rules: {
    'sukka/unicorn/filename-case': 'off',
    'sukka/prefer-foxts-noop': 'off'
  }
}, {
  files: ['./Mock/**/*'],
  rules: {
    'sukka/unicorn/filename-case': 'off'
  }
});
