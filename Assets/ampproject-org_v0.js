(function () {
  'use strict';

  const head = document.head;
  if (!head) { return; }
  const style = document.createElement('style');
  style.textContent = [
    'body {',
    '  animation: none !important;',
    '  overflow: unset !important;',
    '}'
  ].join('\n');
  head.appendChild(style);
}());
