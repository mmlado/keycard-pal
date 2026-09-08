import React from 'react';

import { WalletConnectProvider } from './walletConnect/Provider.online';

// Side effect only: turns NetInfo's reachability probe off before
// WalletKit subscribes to NetInfo below (see connectivity.online.ts).
import '@/utils/connectivity.online';

export function OnlineProviders({ children }: { children: React.ReactNode }) {
  return <WalletConnectProvider>{children}</WalletConnectProvider>;
}
