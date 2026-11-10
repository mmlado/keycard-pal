import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DELETE_TOKEN_FAILED,
  SAVE_TOKEN_FAILED,
} from '@/constants/customTokens';
import type { CustomTokenScreenProps } from '@/navigation/types';
import { useBlockNativeBack } from '@/navigation/useBlockNativeBack';
import theme from '@/theme';

import AddressText from '@/components/AddressText';
import BottomActionArea from '@/components/BottomActionArea';
import ConfirmPrompt from '@/components/ConfirmPropmpt';
import KeyboardAwareScrollView, {
  useKeepAboveKeyboard,
} from '@/components/KeyboardAwareScrollView';
import PrimaryButton from '@/components/PrimaryButton';
import { WarningRow } from '@/components/SignRequestDetail/eth/DataTabPanel/shared';

import { useCustomTokens } from '@/hooks/useCustomTokens';

import {
  deleteCustomToken,
  saveCustomToken,
} from '@/storage/customTokensStorage';

import { getChainName } from '@/utils/chainMetadata';
import {
  checkCustomTokenDraft,
  type CustomTokenDraft,
  type DraftField,
} from '@/utils/customTokenChecks';
import { findCustomToken } from '@/utils/customTokens';
import { checksumEthAddress } from '@/utils/ethereumAddress';

function Field({
  label,
  value,
  onChangeText,
  error,
  note,
  keyboardType,
  editable,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  note?: string;
  keyboardType?: KeyboardTypeOptions;
  editable: boolean;
  testID: string;
}) {
  const { block, input } = useKeepAboveKeyboard();
  return (
    <View onLayout={block.onLayout} style={styles.field}>
      <Text variant="bodySmall" style={styles.label}>
        {label}
      </Text>
      <TextInput
        onFocus={input.onFocus}
        onBlur={input.onBlur}
        onLayout={input.onLayout}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        editable={editable}
        testID={testID}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {note && !error ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

function Fixed({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="bodySmall" style={styles.label}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export default function CustomTokenScreen({
  navigation,
  route,
}: CustomTokenScreenProps) {
  const insets = useSafeAreaInsets();
  const params = route.params;
  const editing = params.mode === 'edit';
  // Re-checked whenever the list changes, which decides "already added" and the duplicate symbol.
  useCustomTokens();
  const [draft, setDraft] = useState<CustomTokenDraft>(() => {
    const saved =
      params.mode === 'edit'
        ? findCustomToken(params.chainId, params.address)
        : null;
    return {
      chainId: params.chainId === undefined ? '' : String(params.chainId),
      address: params.address ? checksumEthAddress(params.address) : '',
      symbol: saved?.symbol ?? '',
      decimals: saved ? String(saved.decimals) : '',
    };
  });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmingRef = useRef(false);

  const check = checkCustomTokenDraft(draft, editing);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit token' : 'Add token' });
  }, [navigation, editing]);

  const showConfirm = useCallback((show: boolean) => {
    confirmingRef.current = show;
    setConfirmingDelete(show);
  }, []);

  useBlockNativeBack(confirmingDelete);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (confirmingRef.current) {
          event.preventDefault();
          showConfirm(false);
        }
      }),
    [navigation, showConfirm],
  );

  const set = (field: DraftField) => (text: string) => {
    setDraft(current => ({ ...current, [field]: text }));
    setFailure(null);
  };

  // A complete address is judged at once: that is where the bundled entry and an existing one show.
  const errorOf = (field: DraftField) =>
    submitted || (field === 'address' && draft.address.length >= 42)
      ? check.errors[field]
      : undefined;

  const handleSave = async () => {
    setSubmitted(true);
    if (!check.token) return;
    setBusy(true);
    try {
      await saveCustomToken(check.token);
      navigation.goBack();
    } catch {
      setFailure(SAVE_TOKEN_FAILED);
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (params.mode !== 'edit' || busy) return;
    // Lifting the back block updates the header, which crashes react-native-screens mid-pop; so it stays up.
    confirmingRef.current = false;
    setBusy(true);
    try {
      await deleteCustomToken(params.chainId, params.address);
      navigation.goBack();
    } catch {
      showConfirm(false);
      setFailure(DELETE_TOKEN_FAILED);
      setBusy(false);
    }
  };

  if (confirmingDelete && params.mode === 'edit') {
    return (
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        <ConfirmPrompt
          title={`Delete ${draft.symbol} on ${getChainName(params.chainId)}?`}
          description="Reviews show this token as unknown again, until you add it back."
          yesLabel="Delete"
          noLabel="Keep"
          onYes={handleDelete}
          onNo={() => showConfirm(false)}
        />
      </View>
    );
  }

  const existing = check.existing;
  const filled = Object.values(draft).every(value => value !== '');

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {editing ? (
          <>
            <Fixed label="Chain">
              <Text variant="bodyLarge" style={styles.value}>
                {`${check.notes.chainId} (${draft.chainId})`}
              </Text>
            </Fixed>
            <Fixed label="Contract address">
              <AddressText address={draft.address} style={styles.address} />
              {check.notes.address ? (
                <Text style={styles.note}>{check.notes.address}</Text>
              ) : null}
            </Fixed>
          </>
        ) : (
          <>
            <Field
              label="Chain ID"
              value={draft.chainId}
              onChangeText={set('chainId')}
              error={errorOf('chainId')}
              note={check.notes.chainId}
              keyboardType="number-pad"
              editable={!busy}
              testID="custom-token-chain"
            />
            <Field
              label="Contract address"
              value={draft.address}
              onChangeText={set('address')}
              error={errorOf('address')}
              editable={!busy}
              testID="custom-token-address"
            />
            {existing && (
              <Pressable
                onPress={() =>
                  navigation.replace('CustomToken', {
                    mode: 'edit',
                    chainId: existing.chainId,
                    address: existing.address,
                  })
                }
                accessibilityRole="button"
                testID="custom-token-edit-existing"
              >
                <Text style={styles.link}>Edit it</Text>
              </Pressable>
            )}
          </>
        )}
        <Field
          label="Symbol"
          value={draft.symbol}
          onChangeText={set('symbol')}
          error={errorOf('symbol')}
          editable={!busy}
          testID="custom-token-symbol"
        />
        {check.duplicateSymbol && <WarningRow text={check.duplicateSymbol} />}
        <Field
          label="Decimals"
          value={draft.decimals}
          onChangeText={set('decimals')}
          error={errorOf('decimals')}
          note={check.notes.decimals}
          keyboardType="number-pad"
          editable={!busy}
          testID="custom-token-decimals"
        />
        {editing && (
          <Pressable
            onPress={() => showConfirm(true)}
            disabled={busy}
            accessibilityRole="button"
            testID="custom-token-delete"
          >
            <Text style={styles.delete}>Delete token</Text>
          </Pressable>
        )}
        {failure ? <Text style={styles.error}>{failure}</Text> : null}
      </KeyboardAwareScrollView>
      <BottomActionArea style={styles.actions}>
        <PrimaryButton
          label="Save"
          onPress={handleSave}
          disabled={busy || !filled}
          testID="custom-token-save"
        />
      </BottomActionArea>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: theme.colors.onSurfaceVariant,
  },
  input: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.onSurface,
    fontFamily: theme.monospace,
    fontSize: 14,
  },
  value: {
    color: theme.colors.onSurface,
  },
  address: {
    fontFamily: theme.monospace,
    fontSize: 14,
  },
  error: {
    color: theme.colors.error,
    fontSize: 12,
  },
  note: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 12,
  },
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  delete: {
    color: theme.colors.error,
    paddingVertical: 8,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
