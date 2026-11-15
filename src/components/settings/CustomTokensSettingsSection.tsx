import SettingsLinkRow from '@/components/settings/SettingsLinkRow';

import { useCustomTokens } from '@/hooks/useCustomTokens';

export const CUSTOM_TOKENS_LABEL = 'Custom tokens';

export default function CustomTokensSettingsSection({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const count = useCustomTokens().length;
  return (
    <SettingsLinkRow
      label={CUSTOM_TOKENS_LABEL}
      detail={String(count)}
      onPress={onOpen}
      testID="settings-custom-tokens"
    />
  );
}
