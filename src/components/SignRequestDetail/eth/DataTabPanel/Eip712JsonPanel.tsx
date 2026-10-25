import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';

import { MISCASED_ADDRESS_WARNING } from '@/constants/eip712';
import { DESCRIPTOR_CHECK_FAILED_WARNING } from '@/constants/eip7730';
import { EIP712_DIGEST_EXPLAINER } from '@/constants/erc8213';
import type { EthSignRequest } from '@/types';
import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { useRegistryAnswer } from '@/hooks/useRegistryAnswer';

import {
  eip712DomainChainId,
  encodeEip712Type,
  parseEip712RawTypedData,
  type Eip712Summary,
} from '@/utils/eip712';
import {
  interpolateIntent,
  type Eip7730FieldContext,
} from '@/utils/eip7730/format';
import { lookupEip712 } from '@/utils/eip7730/lookup';
import { buildEip712Resolvers } from '@/utils/eip7730/paths';
import { reviewerNames } from '@/utils/eip7730/source';
import { fitsRequest, shownFields } from '@/utils/eip7730/visibility';
import type { EthPayload } from '@/utils/ethPayload';

import Eip7730FieldList from './Eip7730FieldList';
import {
  DescriptorSourceLine,
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

  const rawTypedData = useMemo(
    () => parseEip712RawTypedData(request.signData),
    [request.signData],
  );
  const verifyingContract = eip712.domain?.verifyingContract;
  // ERC-7730 binds a message to its domain's chain; WalletConnect requests carry no other.
  const domainChainId = rawTypedData
    ? eip712DomainChainId(rawTypedData.domain)
    : undefined;

  const lookup = useCallback(() => {
    if (domainChainId === undefined || !verifyingContract || !rawTypedData) {
      return null;
    }
    const encodedType = encodeEip712Type(
      rawTypedData.primaryType,
      rawTypedData.types,
    );
    if (!encodedType) return null;
    return lookupEip712(
      domainChainId,
      verifyingContract,
      encodedType,
      rawTypedData.domain,
    );
  }, [domainChainId, verifyingContract, rawTypedData]);
  const { answer: matchedFormat, loading } = useRegistryAnswer(lookup);

  const fieldContext = useMemo<Eip7730FieldContext>(() => {
    const container = {
      from: request.address,
      to: verifyingContract,
      value: '0',
      chainId: domainChainId,
    };
    return {
      chainId: domainChainId,
      contractAddress: verifyingContract,
      ...buildEip712Resolvers(
        rawTypedData ?? { types: {}, primaryType: '', message: {} },
        container,
      ),
      depth: 0,
      // The Domain section above names it.
      shownContract: verifyingContract,
    };
  }, [domainChainId, verifyingContract, rawTypedData, request.address]);

  const rejected =
    matchedFormat !== null && !fitsRequest(matchedFormat, fieldContext);
  const fitting = rejected ? null : matchedFormat;
  // The app's Permit and SafeTx reviews are reviewed code; an unreviewed descriptor is not.
  const eip7730Descriptor =
    fitting && (!specialEip712 || reviewerNames(fitting.reviewedBy).length > 0)
      ? fitting
      : null;
  const eip7730Fields = eip7730Descriptor
    ? shownFields(eip7730Descriptor, fieldContext)
    : [];

  const eip7730Title = eip7730Descriptor
    ? interpolateIntent(eip7730Descriptor, fieldContext) ??
      eip7730Descriptor.intent
    : undefined;

  // The classification's digest is the one the card signs.
  const eip712Digest = payload.kind === 'eip712-json' ? payload.digest : null;

  return (
    <View style={styles.panel}>
      {rejected && <WarningRow text={DESCRIPTOR_CHECK_FAILED_WARNING} />}
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
            {loading ? null : eip7730Descriptor ? (
              <>
                {eip7730Title && (
                  <View style={styles.row}>
                    <Text variant="titleSmall" style={styles.intent}>
                      {eip7730Title}
                    </Text>
                  </View>
                )}
                <DescriptorSourceLine
                  reviewedBy={eip7730Descriptor.reviewedBy}
                />
                {eip7730Fields.length > 0 && <SectionHeader title="Message" />}
                <Eip7730FieldList
                  fields={eip7730Descriptor.fields}
                  format={eip7730Descriptor}
                  ctx={fieldContext}
                />
              </>
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
  intent: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
