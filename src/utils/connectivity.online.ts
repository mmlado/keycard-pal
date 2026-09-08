import NetInfo from '@react-native-community/netinfo';

// NetInfo's default "is the internet reachable" check pings a Google URL.
// This app only needs the OS's own network state (isConnected), so that
// probe is switched off here, at module load. configure() replaces NetInfo's
// state and drops every existing listener, so it must run before WalletKit
// subscribes on provider mount: onlineProviders.online.tsx imports this
// module for that side effect.
NetInfo.configure({ reachabilityShouldRun: () => false });

let lastKnown: boolean | null = null;

function connectedFrom(state: { isConnected: boolean | null }): boolean {
  // Unknown counts as disconnected: better a QR code than a dead browser tab.
  return state.isConnected === true;
}

/**
 * Last network state pushed by the OS, synchronously. Assumes connected until
 * the first event arrives so the online build's icons start in their default
 * state. Pair with subscribeNetworkConnected in useSyncExternalStore.
 */
export function getNetworkConnected(): boolean {
  return lastKnown ?? true;
}

/** Subscribes to OS network-state changes. Returns the unsubscribe. */
export function subscribeNetworkConnected(onChange: () => void): () => void {
  return NetInfo.addEventListener(state => {
    lastKnown = connectedFrom(state);
    onChange();
  });
}

/**
 * Whether the device has a network interface up right now. OS state only:
 * no request leaves the phone. Resolves false when the state is unknown or
 * NetInfo fails.
 */
export async function isNetworkConnected(): Promise<boolean> {
  try {
    lastKnown = connectedFrom(await NetInfo.fetch());
    return lastKnown;
  } catch {
    // Keep the snapshot in step with the decision just taken.
    lastKnown = false;
    return false;
  }
}
