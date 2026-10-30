import theme from '../../src/theme';

it('the monospace font is the monospace family on Android', () => {
  expect(theme.monospace).toBe('monospace');
});
