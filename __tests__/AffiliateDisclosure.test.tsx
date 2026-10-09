import { render, screen } from '@testing-library/react-native';

import AffiliateDisclosure from '../src/components/AffiliateDisclosure';

/**
 * The iOS arm. This project resolves modules the way Metro resolves the iOS
 * bundle, so the component under test is `AffiliateDisclosure.ios.tsx` and no
 * amount of Platform.OS pinning would reach the Android one from here. The
 * Advertisement copy is not imported and not assertable in this project:
 * `purchaseLink.ios.ts` exports no disclosure strings for a test to name.
 *
 * What is worth proving here is the inverse of the Android suite. There is no
 * commission on this build, so there is nothing to disclose, and a label that
 * quietly came back would be an unlabelled advertisement on the store that
 * forbids one. Absence is the whole contract.
 */
describe('AffiliateDisclosure where the link pays nothing', () => {
  // Call sites render it unconditionally and it decides for itself, which is
  // what keeps the coverage guard meaningful with no iOS exception in it.
  it.each([
    ['the full wording', false],
    ['the short wording', true],
  ])('renders nothing in place of %s', (_label, short) => {
    const { toJSON } = render(<AffiliateDisclosure short={short} />);

    // An empty tree, not just an empty label: a wrapper, a spacer or a Text
    // with anything in it turns this from null into a node.
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('affiliate-disclosure')).toBeNull();
    // Catches copy that returns under a different testID, or under none,
    // which a testID-only check would wave through.
    expect(
      screen.queryAllByText(/\S/).map(node => node.props.children),
    ).toEqual([]);
  });
});
