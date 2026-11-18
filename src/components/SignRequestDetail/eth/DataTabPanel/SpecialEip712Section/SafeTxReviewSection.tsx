import { StyleSheet, View } from 'react-native';

import { MISCASED_ADDRESS_WARNING } from '@/constants/eip712';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { delegateCallWarnings } from '@/utils/decodedCallDisplay';
import { type Eip712SpecialReview } from '@/utils/eip712';

import { DisplayNodes } from '../Eip7730Display';
import { SectionHeader, WarningRow } from '../shared';

// The call a Safe makes sits one level below the message.
const SAFE_TX_CALL_DEPTH = 1;

export default function SafeTxReviewSection({
  special,
  chainId,
}: {
  special: Extract<Eip712SpecialReview, { kind: 'safe-tx' }>;
  chainId: number | undefined;
}) {
  return (
    <>
      <SectionHeader title="Safe Transaction" />
      {special.safeAddress && (
        <View style={styles.row}>
          <AddressInfoRow label="Safe" value={special.safeAddress} />
          {special.miscased.includes('safeAddress') && (
            <WarningRow text={MISCASED_ADDRESS_WARNING} />
          )}
        </View>
      )}
      <View style={styles.row}>
        <AddressInfoRow label="To" value={special.to} />
        {special.miscased.includes('to') && (
          <WarningRow text={MISCASED_ADDRESS_WARNING} />
        )}
      </View>
      <View style={styles.row}>
        <InfoRow label="Value" value={special.value} />
      </View>
      <View style={styles.row}>
        <InfoRow label="Operation" value={special.operation} />
        {special.safeOperation === 'delegatecall' &&
          delegateCallWarnings(
            special.to,
            SAFE_TX_CALL_DEPTH,
            special.data,
          ).map(warning => <WarningRow key={warning} text={warning} />)}
      </View>
      <View style={styles.row}>
        <InfoRow label="Nonce" value={special.nonce} />
      </View>
      <View style={styles.row}>
        <InfoRow label="Safe tx gas" value={special.safeTxGas} />
        <InfoRow label="Base gas" value={special.baseGas} />
        <InfoRow label="Gas price" value={special.gasPrice} />
      </View>
      <View style={styles.row}>
        <AddressInfoRow label="Gas token" value={special.gasToken} />
        {special.miscased.includes('gasToken') && (
          <WarningRow text={MISCASED_ADDRESS_WARNING} />
        )}
        <AddressInfoRow
          label="Refund receiver"
          value={special.refundReceiver}
        />
        {special.miscased.includes('refundReceiver') && (
          <WarningRow text={MISCASED_ADDRESS_WARNING} />
        )}
      </View>
      {special.data && (
        <DisplayNodes
          nodes={[
            {
              kind: 'call',
              calleeShown: true,
              request: {
                chainId,
                contract: special.to,
                data: special.data,
                // A delegate call carries no value.
                ...(special.safeOperation === 'call' && {
                  value: special.value,
                }),
                depth: SAFE_TX_CALL_DEPTH,
              },
            },
          ]}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
  },
});
