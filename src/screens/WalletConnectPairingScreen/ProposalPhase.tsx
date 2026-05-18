import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Button, RadioButton, Text } from 'react-native-paper';
import { EdgeInsets } from 'react-native-safe-area-context';

import theme from '@/theme';
import PrimaryButton from '@/components/PrimaryButton';
import type { VerifyValidation } from '@/providers/walletConnect/context';

import styles from './styles';

function useSecondsRemaining(expiryTimestamp: number): number {
  const [secs, setSecs] = useState(() =>
    Math.max(0, expiryTimestamp - Math.floor(Date.now() / 1000)),
  );
  useEffect(() => {
    if (secs === 0) return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        expiryTimestamp - Math.floor(Date.now() / 1000),
      );
      setSecs(remaining);
      if (remaining === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiryTimestamp, secs]);
  return secs;
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const RELAY_PRIVACY_URL = 'https://walletconnect.com/privacy';

type PathOption = {
  label: string;
  accountPath: string;
  hasExternalChain: boolean;
};

function VerifyBanner({
  validation,
  isScam,
}: {
  validation: VerifyValidation;
  isScam?: boolean;
}) {
  if (isScam) {
    return (
      <View style={styles.verifyScam}>
        <Text style={styles.verifyScamText}>
          ⚠ This site has been flagged as a scam. Do not connect.
        </Text>
      </View>
    );
  }
  if (validation === 'INVALID') {
    return (
      <View style={styles.verifyInvalid}>
        <Text style={styles.verifyInvalidText}>
          ⚠ Domain could not be verified. Proceed with caution.
        </Text>
      </View>
    );
  }
  if (validation === 'VALID') {
    return (
      <View style={styles.verifyValid}>
        <Text style={styles.verifyValidText}>✓ Verified domain</Text>
      </View>
    );
  }
  return null;
}

export default function ProposalPhase({
  dAppName,
  dAppUrl,
  requestedChains,
  pathOptions,
  selectedPathIdx,
  activeSessionName,
  verification,
  expiryTimestamp,
  proposalError,
  insets,
  onSelectPath,
  onConfirm,
  onReject,
}: {
  dAppName: string;
  dAppUrl: string;
  requestedChains: string[];
  pathOptions: PathOption[];
  selectedPathIdx: number;
  activeSessionName: string | null;
  verification: { validation: VerifyValidation; isScam?: boolean } | null;
  expiryTimestamp: number;
  proposalError: string | null;
  insets: EdgeInsets;
  onSelectPath: (idx: number) => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const isScam = verification?.isScam ?? false;
  const hasExpiry = expiryTimestamp > 0;
  const secsRemaining = useSecondsRemaining(expiryTimestamp);
  const expired = hasExpiry && secsRemaining === 0;
  const urgent = hasExpiry && secsRemaining <= 30 && !expired;

  return (
    <View
      style={[styles.proposalContainer, { paddingBottom: insets.bottom + 16 }]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16 },
        ]}
      >
        <Text variant="titleLarge" style={styles.dAppName}>
          {dAppName}
        </Text>
        {!!dAppUrl && (
          <Text variant="bodySmall" style={styles.dAppUrl}>
            {dAppUrl}
          </Text>
        )}

        {hasExpiry && (
          <Text
            variant="bodySmall"
            style={[
              styles.countdown,
              urgent && styles.countdownUrgent,
              expired && styles.countdownExpired,
            ]}
          >
            {expired
              ? 'Proposal expired'
              : `Expires in ${formatCountdown(secsRemaining)}`}
          </Text>
        )}

        {verification && (
          <VerifyBanner
            validation={verification.validation}
            isScam={verification.isScam}
          />
        )}

        {!!proposalError && (
          <View style={styles.verifyScam}>
            <Text style={styles.verifyScamText}>⚠ {proposalError}</Text>
          </View>
        )}

        {requestedChains.length > 0 && (
          <View style={styles.section}>
            <Text variant="labelMedium" style={styles.label}>
              Requested networks
            </Text>
            <View style={styles.chainGrid}>
              {requestedChains.map(c => (
                <Text key={c} style={styles.chainItem}>
                  {c}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text variant="labelMedium" style={styles.label}>
            Derivation path
          </Text>
          <RadioButton.Group
            onValueChange={val => onSelectPath(Number(val))}
            value={String(selectedPathIdx)}
          >
            {pathOptions.map((opt, idx) => (
              <Pressable
                key={opt.label}
                style={styles.pathRow}
                onPress={() => onSelectPath(idx)}
              >
                <RadioButton.Android
                  value={String(idx)}
                  color={theme.colors.primary}
                />
                <Text style={styles.pathLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </RadioButton.Group>
        </View>

        {activeSessionName && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Connecting will close your existing session with{' '}
              {activeSessionName}.
            </Text>
          </View>
        )}

        <View style={styles.relayWarning}>
          <Text variant="labelMedium" style={styles.relayTitle}>
            Relay privacy notice
          </Text>
          <Text style={styles.relayBody}>
            This connection is routed through WalletConnect relay servers.
            WalletConnect can observe pairing metadata and traffic patterns even
            though signing content is end-to-end encrypted.
          </Text>
          <Button
            compact
            onPress={() => Linking.openURL(RELAY_PRIVACY_URL)}
            textColor={theme.colors.primary}
          >
            WalletConnect Privacy Policy
          </Button>
        </View>
      </ScrollView>

      <View style={styles.proposalActions}>
        <Button
          mode="outlined"
          onPress={onReject}
          textColor={theme.colors.error}
        >
          Reject
        </Button>
        <PrimaryButton
          label="Confirm"
          onPress={onConfirm}
          disabled={isScam || expired || !!proposalError}
        />
      </View>
    </View>
  );
}
