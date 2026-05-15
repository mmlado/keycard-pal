import { StyleSheet, View } from 'react-native';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { type Eip712SpecialReview } from '@/utils/eip712';

import DecodedCallSection from '../DecodedCallSection';
import { SectionHeader } from '../shared';

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
        </View>
      )}
      <View style={styles.row}>
        <AddressInfoRow label="To" value={special.to} />
      </View>
      <View style={styles.row}>
        <InfoRow label="Value" value={special.value} />
      </View>
      <View style={styles.row}>
        <InfoRow label="Operation" value={special.operation} />
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
        <AddressInfoRow
          label="Refund receiver"
          value={special.refundReceiver}
        />
      </View>
      {special.decodedCall ? (
        <DecodedCallSection
          call={special.decodedCall}
          tokenContract={special.to}
          chainId={chainId}
        />
      ) : (
        special.data && (
          <View style={styles.row}>
            <InfoRow label="Data" value={special.data} />
          </View>
        )
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
  },
});
