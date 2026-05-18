import React from 'react';

import { WalletConnectProvider } from './walletConnect/Provider.online';

export function OnlineProviders({ children }: { children: React.ReactNode }) {
  return <WalletConnectProvider>{children}</WalletConnectProvider>;
}
