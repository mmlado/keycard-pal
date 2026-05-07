import { createPublicClient, getAddress, http } from 'viem';
import { mainnet } from 'viem/chains';

export type ResolveEnsNameResult =
  | { name: string }
  | { name: null; reason: 'not-found' | 'mismatch' | 'rpc-error' };

export async function resolveEnsName(
  address: string,
  rpcUrl: string,
): Promise<ResolveEnsNameResult> {
  try {
    const checksummedAddress = getAddress(address);

    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
    const name = await client.getEnsName({ address: checksummedAddress });
    if (!name) {
      return { name: null, reason: 'not-found' };
    }

    const resolvedAddress = await client.getEnsAddress({ name });
    if (
      !resolvedAddress ||
      getAddress(resolvedAddress) !== checksummedAddress
    ) {
      return { name: null, reason: 'mismatch' };
    }

    return { name };
  } catch {
    return { name: null, reason: 'rpc-error' };
  }
}

export async function validateRpcUrl(
  url: string,
): Promise<'ok' | 'non-mainnet' | 'timeout' | 'unreachable'> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(url, { timeout: 5000 }),
    });

    const chainId = await client.getChainId();

    if (chainId === 1) {
      return 'ok';
    }

    return 'non-mainnet';
  } catch (error: any) {
    if (
      error?.name === 'TimeoutError' ||
      error?.code === 'TIMEOUT' ||
      error?.message?.toLowerCase().includes('timeout')
    ) {
      return 'timeout';
    }

    return 'unreachable';
  }
}
