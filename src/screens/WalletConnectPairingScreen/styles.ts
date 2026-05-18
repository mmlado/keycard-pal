import { StyleSheet } from 'react-native';

import theme from '@/theme';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    gap: 16,
    padding: 24,
  },
  statusText: {
    color: theme.colors.onSurface,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  dAppName: {
    color: theme.colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
  },
  dAppUrl: {
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  section: {
    gap: 4,
  },
  label: {
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  chainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chainItem: {
    width: '50%',
    color: theme.colors.onSurface,
    paddingVertical: 2,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pathLabel: {
    color: theme.colors.onSurface,
    marginLeft: 4,
  },
  countdown: {
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  countdownUrgent: {
    color: theme.colors.error,
    fontWeight: '600',
  },
  countdownExpired: {
    color: theme.colors.error,
    fontWeight: '700',
  },
  verifyScam: {
    backgroundColor: theme.colors.errorContainer,
    borderRadius: 8,
    padding: 12,
  },
  verifyScamText: {
    color: theme.colors.onErrorContainer,
    fontWeight: '700',
  },
  verifyInvalid: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error,
  },
  verifyInvalidText: {
    color: theme.colors.onSurface,
  },
  verifyValid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifyValidText: {
    color: theme.colors.primary,
    fontSize: 13,
  },
  warningBox: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    padding: 12,
  },
  warningText: {
    color: theme.colors.onSurfaceVariant,
  },
  relayWarning: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  relayTitle: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  relayBody: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: theme.colors.onSurface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  list: {
    flex: 1,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  addrIndex: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 12,
    width: 24,
    textAlign: 'right',
    marginRight: 8,
  },
  addrText: {
    flex: 1,
    marginLeft: 8,
  },
  listFooter: {
    paddingVertical: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  proposalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  proposalActions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
});
