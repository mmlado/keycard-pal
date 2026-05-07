export interface UseEnsNameResult {
  name: string | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

function noop() {}

export function useEnsName(_address: string): UseEnsNameResult {
  return { name: null, loading: false, error: false, retry: noop };
}
