const React = require('react');

// Forwards its props so a test can assert the glyph name, size and colour the
// icon registry passed down. Rendering a bare element would hide all of that.
const IconMock = props => React.createElement('text', props);

IconMock.default = IconMock;
module.exports = IconMock;
module.exports.default = IconMock;
