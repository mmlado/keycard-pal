import SettingsLinkRow from '@/components/settings/SettingsLinkRow';

import { BUNDLED_TOKEN_COUNT } from '@/utils/bundledTokens';

export const BUNDLED_TOKENS_LABEL = 'Bundled tokens';

export default function BundledTokensSettingsSection({
  onOpen,
}: {
  onOpen: () => void;
}) {
  return (
    <SettingsLinkRow
      label={BUNDLED_TOKENS_LABEL}
      detail={String(BUNDLED_TOKEN_COUNT)}
      onPress={onOpen}
      testID="settings-bundled-tokens"
    />
  );
}
