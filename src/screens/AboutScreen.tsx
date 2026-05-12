import React, { useCallback } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '../assets/icons';
import type { AboutScreenProps, DashboardAction } from '../navigation/types';
import theme from '../theme';

import AppIdentityHeader from '../components/about/AppIdentityHeader';
import ContributorsList from '../components/about/ContributorsList';
import SupportSection from '../components/about/SupportSection';
import KeycardPurchaseCard from '../components/KeycardPurchaseCard';
import LicenseList from '../components/about/LicenseList';

import { KEYCARD_PURCHASE_URL } from '../constants/keycard';
import type { LicenseEntry } from '../data/licenses';

const PROJECT_GITHUB_URL = 'https://github.com/mmlado/GapSign';

export const dashboardEntry: DashboardAction = {
  label: 'About',
  navigate: nav => nav.navigate('About'),
};

export default function AboutScreen({ navigation }: AboutScreenProps) {
  const insets = useSafeAreaInsets();
  const handleSelectLicense = useCallback(
    (entry: LicenseEntry) => {
      navigation.navigate('LicenseDetail', {
        packageName: entry.package,
        licenseType: entry.licenseType,
      });
    },
    [navigation],
  );

  return (
    <ScrollView
      style={[styles.scroll, { paddingTop: insets.top }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <AppIdentityHeader />

      <Text style={styles.description}>
        GapSign is an open-source air-gapped hardware wallet companion for
        Android and iOS. It communicates with a Keycard via NFC, scans and
        produces animated QR codes in UR format, and supports Ethereum and
        Bitcoin signing — keeping your private keys offline at all times.
      </Text>

      <View style={styles.projectLinkRow}>
        <Pressable
          style={styles.projectLink}
          onPress={() => Linking.openURL(PROJECT_GITHUB_URL)}
        >
          <Text style={styles.projectLinkText}>GitHub project</Text>
          <Icons.openInBrowser
            width={18}
            height={18}
            color={theme.colors.onSurface}
          />
        </Pressable>
        <Pressable
          style={styles.qrIconButton}
          accessibilityLabel="Show GitHub project QR code"
          onPress={() =>
            navigation.navigate('UrlQR', {
              url: PROJECT_GITHUB_URL,
              title: 'GitHub project',
            })
          }
        >
          <Icons.qr
            width={20}
            height={20}
            color={theme.colors.onSurfaceMuted}
          />
        </Pressable>
      </View>

      <KeycardPurchaseCard
        onShowQR={() =>
          navigation.navigate('UrlQR', {
            url: KEYCARD_PURCHASE_URL,
            title: 'Buy a Keycard',
          })
        }
      />

      <SupportSection
        onShowQR={(label, address) =>
          navigation.navigate('AddressDetail', {
            address,
            index: 0,
            title: `${label} address`,
          })
        }
      />

      <Text style={styles.sectionTitle}>Contributors</Text>
      <ContributorsList />

      <Text style={styles.sectionTitle}>Open-source licenses</Text>
      <LicenseList onSelectLicense={handleSelectLicense} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  projectLinkRow: {
    alignSelf: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  projectLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  qrIconButton: {
    padding: 8,
  },
  projectLinkText: {
    color: theme.colors.onSurface,
    fontFamily: 'Inter_18pt-Medium',
    fontSize: 15,
  },
  sectionTitle: {
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 18,
    color: theme.colors.onSurface,
    textAlign: 'center',
  },
});
