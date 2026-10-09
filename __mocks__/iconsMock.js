const React = require('react');
const { View } = require('react-native');

// Every icon renders as a plain View that forwards its props, so tests can find
// one by testID and assert on width/height/color.
const Icon = props => React.createElement(View, props);

// Keys React, Jest and the module system probe for must not answer with a
// component, or a mocked module starts looking like an element or a thenable.
const RESERVED = new Set([
  '__esModule',
  '$$typeof',
  'then',
  'constructor',
  'prototype',
  'nodeType',
  'toJSON',
]);

const base = {
  nfc: { default: Icon, success: Icon, failure: Icon },
};

/**
 * Proxy over the icon registry: any semantic key resolves to `Icon`, so adding
 * an icon to `src/assets/icons` never breaks a screen test that mocks icons.
 */
const Icons = new Proxy(base, {
  get(target, key) {
    if (typeof key === 'symbol' || RESERVED.has(key)) {
      return target[key];
    }
    return key in target ? target[key] : Icon;
  },
  has() {
    return true;
  },
});

module.exports = { Icons };
