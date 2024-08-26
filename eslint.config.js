'use strict';

module.exports = require('eslint-config-sukka').sukka({
  js: {
    disableNoConsoleInCLI: ['Build/**']
  },
  node: true,
  ts: true
});
