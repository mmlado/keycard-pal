import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { MISCASED_ADDRESS_WARNING } from '@/constants/eip712';
import { DESCRIPTOR_CHECK_FAILED_WARNING } from '@/constants/eip7730';
import { EIP712_DIGEST_EXPLAINER } from '@/constants/erc8213';
import type { EthSignRequest } from '@/types';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { useRegistryAnswer } from '@/hooks/useRegistryAnswer';

import { parseEip712RawTypedData, type Eip712Summary } from '@/utils/eip712';
import { displayMessage } from '@/utils/eip7730/display';
import { reviewerNames } from '@/utils/eip7730/source';
import type { EthPayload } from '@/utils/ethPayload';
import { describeMessage } from '@/utils/messageDescription';

import Eip7730Display from './Eip7730Display';
import {
  DigestExplainer,
  DigestRow,
  SectionHeader,
  WarningRow,
} from './shared';
import SpecialEip712Section from './SpecialEip712Section';

type Tab = 'details' | 'digests' | 'raw';

export default function Eip712JsonPanel({
  request,
  eip712,
  payload,
  chainId,
}: {
  request: EthSignRequest;
  eip712: Eip712Summary;
  payload: EthPayload;
  chainId: number | undefined;
}) {
  const [tab, setTab] = useState<Tab>('details');
  const specialEip712 = eip712.special;

  const ask = useCallback(
    () =>
      describeMessage(
        parseEip712RawTypedData(request.signData),
        request.address,
      ),
    [request.signData, request.address],
  );
  const { answer: description, loading } = useRegistryAnswer(ask);

  const matched = description?.descriptor ?? null;
  // The app's Permit and SafeTx reviews are reviewed code; an unreviewed descriptor is not.
  const descriptor =
    matched &&
    (!specialEip712 || reviewerNames(matched.format.reviewedBy).length > 0)
      ? matched
      : null;
  // Only the Details tab shows it, and a long message formats every row.
  const display =
    tab === 'details' && description && descriptor
      ? displayMessage(descriptor, description)
      : null;

  // The classification's digest is the one the card signs.
  const eip712Digest = payload.kind === 'eip712-json' ? payload.digest : null;

  return (
    <View style={styles.panel}>
      {description?.rejected && (
        <WarningRow text={DESCRIPTOR_CHECK_FAILED_WARNING} />
      )}
      <SegmentedButtons
        value={tab}
        onValueChange={v => setTab(v as Tab)}
        buttons={[
          { value: 'details', label: 'Details' },
          { value: 'digests', label: 'Digests' },
          { value: 'raw', label: 'Raw' },
        ]}
      />
      <View style={styles.tabContent}>
        {tab === 'details' && (
          <>
            {eip712.primaryType && (
              <View style={styles.row}>
                <InfoRow label="Primary type" value={eip712.primaryType} />
              </View>
            )}
            {Object.keys(eip712.domain).length > 0 && (
              <>
                <SectionHeader title="EIP-712 Domain" />
                {Object.entries(eip712.domain).map(([key, value]) => (
                  <View key={`domain-${key}`} style={styles.row}>
                    <AddressInfoRow label={key} value={value} />
                    {eip712.miscasedAddresses.includes(`domain.${key}`) && (
                      <WarningRow text={MISCASED_ADDRESS_WARNING} />
                    )}
                  </View>
                ))}
              </>
            )}
            {loading ? null : display ? (
              <Eip7730Display display={display} />
            ) : (
              <>
                {specialEip712 && (
                  <SpecialEip712Section
                    special={specialEip712}
                    fallbackChainId={chainId}
                  />
                )}
                {!specialEip712 && Object.keys(eip712.message).length > 0 && (
                  <>
                    <SectionHeader title="Message Fields" />
                    {Object.entries(eip712.message).map(([key, value]) => (
                      <View key={`message-${key}`} style={styles.row}>
                        <AddressInfoRow label={key} value={value} />
                        {eip712.miscasedAddresses.includes(
                          `message.${key}`,
                        ) && <WarningRow text={MISCASED_ADDRESS_WARNING} />}
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
        {tab === 'digests' && eip712Digest && (
          <>
            <DigestRow label="EIP-712 Digest" value={eip712Digest} />
            <DigestExplainer text={EIP712_DIGEST_EXPLAINER} />
          </>
        )}
        {tab === 'raw' && (
          <View style={styles.row}>
            <InfoRow label="Data" value={eip712.rawJson} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
  },
  tabContent: {
    paddingTop: 8,
  },
  row: {
    paddingVertical: 8,
  },
});
