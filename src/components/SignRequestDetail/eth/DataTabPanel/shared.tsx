import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import {
  ERC8213_LINK_LABEL,
  ERC8213_QR_TITLE,
  ERC8213_URL,
} from '@/constants/erc8213';
import theme from '@/theme';

import InfoRow from '@/components/InfoRow';

import { useExternalLink } from '@/hooks/useExternalLink';

export function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="labelMedium" style={styles.sectionHeaderText}>
        {title}
      </Text>
    </View>
  );
}

export function WarningRow({ text }: { text: string }) {
  return (
    <View style={styles.warningRow}>
      <Icon source="alert" size={16} color={theme.colors.negative} />
      <Text variant="labelSmall" style={styles.warningText}>
        {text}
      </Text>
    </View>
  );
}

export function ElementBlock({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.element}>
      {title && (
        <Text variant="labelSmall" style={styles.elementTitle}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

export function DigestRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <InfoRow label={label} value={value} />
    </View>
  );
}

export function DigestExplainer({ text }: { text: string }) {
  const { open, opensInBrowser } = useExternalLink({
    url: ERC8213_URL,
    title: ERC8213_QR_TITLE,
  });
  const LinkIcon = opensInBrowser ? Icons.openInBrowser : Icons.qr;

  return (
    <View style={styles.explainer} testID="digest-explainer">
      <Text variant="bodySmall" style={styles.explainerText}>
        {text}
      </Text>
      <Pressable
        accessibilityRole="link"
        style={styles.link}
        onPress={open}
        testID="erc8213-link"
      >
        <LinkIcon width={16} height={16} color={theme.colors.primary} />
        <Text variant="labelMedium" style={styles.linkText}>
          {ERC8213_LINK_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  warningText: {
    color: theme.colors.negative,
    flexShrink: 1,
  },
  element: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.surfaceVariant,
    paddingLeft: 12,
    marginVertical: 4,
  },
  elementTitle: {
    color: theme.colors.onSurfaceVariant,
    paddingTop: 4,
  },
  sectionHeader: {
    paddingTop: 8,
  },
  sectionHeaderText: {
    color: theme.colors.onSurfaceVariant,
  },
  explainer: {
    paddingTop: 8,
    gap: 8,
  },
  explainerText: {
    color: theme.colors.onSurfaceMuted,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
  },
  linkText: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
});
