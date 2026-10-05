import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';

import { ERC191_DIGEST_EXPLAINER } from '@/constants/erc8213';
import theme from '@/theme';
import type { EthSignRequest } from '@/types';

import InfoRow from '@/components/InfoRow';

import type { EthPayload } from '@/utils/ethPayload';
import { decodeUtf8Strict } from '@/utils/utf8';

import { DigestExplainer, DigestRow } from './shared';

type Tab = 'message' | 'digests' | 'raw';

export type PersonalMessagePayload = Extract<
  EthPayload,
  { kind: 'personal-message' }
>;

export default function PersonalMessagePanel({
  message,
  request,
}: {
  message: PersonalMessagePayload;
  request: EthSignRequest;
}) {
  const [tab, setTab] = useState<Tab>('message');
  const text = useMemo(() => decodeUtf8Strict(message.raw), [message.raw]);

  return (
    <View style={styles.panel}>
      <SegmentedButtons
        value={tab}
        onValueChange={v => setTab(v as Tab)}
        buttons={[
          { value: 'message', label: 'Message' },
          { value: 'digests', label: 'Digests' },
          { value: 'raw', label: 'Raw' },
        ]}
      />
      <View style={styles.tabContent}>
        {tab === 'message' && text === null && (
          <>
            <View style={styles.row}>
              <InfoRow label="Message" value={request.signData} />
            </View>
            <Text variant="bodySmall" style={styles.note}>
              The message is not UTF-8 text, so its bytes are shown as hex.
            </Text>
          </>
        )}
        {tab === 'message' && text === '' && (
          <Text variant="bodySmall" style={styles.note}>
            The message is empty.
          </Text>
        )}
        {tab === 'message' && text && (
          <View style={styles.row}>
            <InfoRow label="Message" value={text} />
          </View>
        )}
        {tab === 'digests' && (
          <>
            <DigestRow label="ERC-191 Digest" value={message.digest} />
            <DigestExplainer text={ERC191_DIGEST_EXPLAINER} />
          </>
        )}
        {tab === 'raw' && (
          <View style={styles.row}>
            <InfoRow label="Data" value={request.signData} />
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
  note: {
    paddingTop: 8,
    color: theme.colors.onSurfaceMuted,
  },
});
