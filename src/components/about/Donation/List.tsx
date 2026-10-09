import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icons } from '../../../assets/icons';

import DonationRow from './Row';

const DONATION_ADDRESSES = [
  {
    label: 'Ethereum',
    icon: Icons.ethereum,
    address: '0xF665E3D58DABa87d741A347674DCc4C4b794cAc9',
  },
  {
    label: 'Bitcoin',
    icon: Icons.bitcoin,
    address: 'bc1qpncfjnresszndse506zmvjya05xcs6493cm8xf',
  },
];

interface Props {
  onShowQR: (label: string, address: string) => void;
}

export default function DonationList({ onShowQR }: Props) {
  return (
    <View style={styles.list}>
      {DONATION_ADDRESSES.map(({ label, icon, address }) => (
        <DonationRow
          key={label}
          label={label}
          icon={icon}
          address={address}
          onShowQR={onShowQR}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
});
