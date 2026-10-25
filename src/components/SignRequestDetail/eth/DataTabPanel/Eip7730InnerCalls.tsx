import { StyleSheet, View } from 'react-native';

import { DESCRIPTOR_CHECK_FAILED_WARNING } from '@/constants/eip7730';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { useCallDescription } from '@/hooks/useCallDescription';

import { checksumEthAddress } from '@/utils/ethereumAddress';
import type { Eip7730FieldContext } from '@/utils/eip7730/format';
import type { Eip7730Field } from '@/utils/eip7730/zip';

import CallSection from './CallSection';
import { ElementBlock, SectionHeader, WarningRow } from './shared';

type InnerCallProps = {
  data: string;
  callee: string | undefined;
  chainId: number | undefined;
  amount: string | undefined;
  spender: string | undefined;
  depth: number;
};

function InnerCall({
  data,
  callee,
  chainId,
  amount,
  spender,
  depth,
}: InnerCallProps) {
  const { description } = useCallDescription({
    chainId,
    contract: callee,
    data,
    from: spender,
    value: amount,
    depth,
  });
  if (!description) return null;

  return (
    <>
      {description.rejected && (
        <WarningRow text={DESCRIPTOR_CHECK_FAILED_WARNING} />
      )}
      {description.contractRow === 'contract' && (
        <View style={styles.row}>
          <AddressInfoRow
            label="Contract"
            value={callee ? checksumEthAddress(callee) : '—'}
          />
        </View>
      )}
      {description.view === 'raw' ? (
        <>
          {/* A call with no data only moves value, so it has no function to name. */}
          {description.selector && (
            <View style={styles.row}>
              <InfoRow label="Contract call" value={description.selector} />
            </View>
          )}
          <View style={styles.row}>
            <InfoRow label="Data" value={data.length > 2 ? data : '—'} />
          </View>
        </>
      ) : (
        <CallSection
          description={description}
          contract={callee}
          chainId={chainId}
          depth={depth}
        />
      )}
    </>
  );
}

const SELECTOR_RE = /^0x[0-9a-f]{8}$/i;

// The spec lets the selector come apart from the arguments.
function withSelector(data: string, selector: string | undefined): string {
  return selector &&
    SELECTOR_RE.test(selector) &&
    !data.toLowerCase().startsWith(selector.toLowerCase())
    ? `${selector}${data.slice(2)}`
    : data;
}

function pick(
  params: Record<string, unknown> | undefined,
  pathKey: string,
  valueKey: string,
  each: (path: string) => string[],
): string[] {
  const path = params?.[pathKey];
  if (typeof path === 'string') return each(path);
  const value = params?.[valueKey];
  return typeof value === 'string' || typeof value === 'number'
    ? [String(value)]
    : [];
}

export default function Eip7730InnerCalls({
  field,
  ctx,
}: {
  field: Eip7730Field;
  ctx: Eip7730FieldContext;
}) {
  const each =
    ctx.resolveEach ??
    ((path: string) => {
      const value = ctx.resolvePath(path);
      return value === null ? [] : [value];
    });
  const calls = field.value !== undefined ? [field.value] : each(field.path);
  const callees = pick(field.params, 'calleePath', 'callee', each);
  const amounts = pick(field.params, 'amountPath', 'amount', each);
  const spenders = pick(field.params, 'spenderPath', 'spender', each);
  const chainIds = pick(field.params, 'chainIdPath', 'chainId', each);
  const selectors = pick(field.params, 'selectorPath', 'selector', each);
  // The spec lets one callee or value stand for every call.
  const at = (list: string[], i: number) =>
    list.length === 1 ? list[0] : list[i];
  const depth = (ctx.depth ?? 0) + 1;

  if (calls.length === 0) {
    return (
      <View style={styles.row}>
        <InfoRow label={field.label} value="—" />
      </View>
    );
  }
  return (
    <View>
      <SectionHeader title={field.label} />
      {calls.map((data, i) => {
        const chainId = Number(at(chainIds, i) ?? ctx.chainId);
        return (
          <ElementBlock
            key={`${i}-${data.slice(0, 10)}`}
            title={
              calls.length > 1 ? `Call ${i + 1} of ${calls.length}` : undefined
            }
          >
            <InnerCall
              data={withSelector(data, at(selectors, i))}
              callee={at(callees, i)}
              chainId={Number.isSafeInteger(chainId) ? chainId : undefined}
              amount={at(amounts, i)}
              spender={at(spenders, i)}
              depth={depth}
            />
          </ElementBlock>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
  },
});
