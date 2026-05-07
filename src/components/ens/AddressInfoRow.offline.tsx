import InfoRow from '../InfoRow';

export default function AddressInfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return <InfoRow label={label} value={value} />;
}
