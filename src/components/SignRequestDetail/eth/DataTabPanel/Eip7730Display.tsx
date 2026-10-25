import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import AddressInfoRow from '@/components/ens/AddressInfoRow.online';
import InfoRow from '@/components/InfoRow';

import { useCallDescription } from '@/hooks/useCallDescription';
import { useDescriptorSource } from '@/hooks/useDescriptorSource';

import type { CallRequest } from '@/utils/callDescription';
import {
  displayInnerCall,
  type DescriptorDisplay,
  type DisplayNode,
  type DisplayRow,
} from '@/utils/eip7730/display';

import TokenSymbolRow from './DecodedCallSection/TokenSymbolRow';
import { ElementBlock, SectionHeader, WarningRow } from './shared';

function Row({ row, padded = true }: { row: DisplayRow; padded?: boolean }) {
  const token = row.token && (
    <TokenSymbolRow token={row.token} style={styles.name} />
  );
  return (
    <>
      <View style={padded ? styles.row : undefined}>
        {row.kind === 'address' ? (
          <AddressInfoRow
            label={row.label}
            value={row.value}
            ens={row.ens}
            name={token}
          />
        ) : (
          <InfoRow label={row.label} value={row.value} name={token} />
        )}
        {row.caption && (
          <Text variant="labelSmall" style={styles.caption}>
            {row.caption}
          </Text>
        )}
      </View>
      {row.warnings.map(warning => (
        <WarningRow key={warning} text={warning} />
      ))}
    </>
  );
}

function InnerCall({ request }: { request: CallRequest }) {
  const { description } = useCallDescription(request);
  if (!description) return null;
  return <DisplayNodes nodes={displayInnerCall(request, description)} />;
}

function Node({ node }: { node: DisplayNode }) {
  switch (node.kind) {
    case 'text':
    case 'address':
      return <Row row={node} />;
    case 'warning':
      return <WarningRow text={node.text} />;
    case 'section':
      return <SectionHeader title={node.title} />;
    case 'item':
      return (
        <ElementBlock title={node.title}>
          <DisplayNodes nodes={node.nodes} />
        </ElementBlock>
      );
    case 'group':
      return (
        <View style={styles.row}>
          {node.rows.map((row, i) => (
            <Row key={`${row.label}-${i}`} row={row} padded={false} />
          ))}
        </View>
      );
    case 'call':
      return <InnerCall request={node.request} />;
    case 'token':
      return <TokenSymbolRow token={node.token} />;
    case 'entry':
      return <Eip7730Display display={node.display} />;
  }
}

export function DisplayNodes({ nodes }: { nodes: DisplayNode[] }) {
  return (
    <>
      {nodes.map((node, i) => (
        <Node key={`${node.kind}-${i}`} node={node} />
      ))}
    </>
  );
}

function SourceLine() {
  const text = useDescriptorSource();
  return (
    <Text variant="labelSmall" style={styles.source} testID="descriptor-source">
      {text}
    </Text>
  );
}

export default function Eip7730Display({
  display,
}: {
  display: DescriptorDisplay;
}) {
  return (
    <View>
      {display.heading && (
        <View style={styles.row}>
          <Text variant="titleSmall" style={styles.heading}>
            {display.heading}
          </Text>
        </View>
      )}
      {display.source && <SourceLine />}
      <Text
        variant="labelSmall"
        style={styles.source}
        testID="descriptor-review"
      >
        {display.review}
      </Text>
      <DisplayNodes nodes={display.nodes} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
  },
  name: {
    paddingVertical: 0,
  },
  caption: {
    color: theme.colors.onSurfaceVariant,
    paddingTop: 4,
  },
  heading: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  source: {
    color: theme.colors.onSurfaceVariant,
    paddingBottom: 4,
  },
});
