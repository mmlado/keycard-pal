import React from 'react';

import { Eip7730DownloadProvider } from './eip7730/Provider.online';
import { WalletConnectProvider } from './walletConnect/Provider.online';

export function OnlineProviders({ children }: { children: React.ReactNode }) {
  return (
    <Eip7730DownloadProvider>
      <WalletConnectProvider>{children}</WalletConnectProvider>
    </Eip7730DownloadProvider>
  );
}
