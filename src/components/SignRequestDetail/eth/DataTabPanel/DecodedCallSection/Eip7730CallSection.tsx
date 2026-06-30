import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { formatEip7730Field } from '@/utils/eip7730/format';
import { buildCalldataPathResolver } from '@/utils/eip7730/paths';

import type { Eip7730DisplayFormat } from '@/utils/eip7730/zip';
import type { DecodedCall } from '@/utils/txParser';

type Props = {
  format: Eip7730DisplayFormat;
  call: DecodedCall;
  contractAddress?: string;
  chainId?: number;
};

export default function Eip7730CallSection({
  format,
  call,
  contractAddress,
  chainId,
}: Props) {
  const resolvePath = buildCalldataPathResolver(call);
  const ctx = { chainId, contractAddress, resolvePath };

  return (
    <View>
      {format.intent && (
        <View style={styles.intentRow}>
          <Text variant="titleSmall" style={styles.intent}>
            {format.intent}
          </Text>
        </View>
      )}
      {format.fields.map((field, index) => {
        const raw = resolvePath(field.path);
        const display = formatEip7730Field(field, raw, format, ctx);
        if (field.format === 'addressName' && raw && raw.startsWith('0x')) {
          return (
            <View key={`${field.path}-${index}`} style={styles.row}>
              <AddressInfoRow label={field.label} value={raw} />
            </View>
          );
        }
        return (
          <View key={`${field.path}-${index}`} style={styles.row}>
            <InfoRow label={field.label} value={display} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  intentRow: {
    paddingVertical: 8,
  },
  intent: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  row: {
    paddingVertical: 8,
  },
});
