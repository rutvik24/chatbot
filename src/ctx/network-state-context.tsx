import {
  addNetworkStateListener,
  getNetworkStateAsync,
  NetworkStateType,
  type NetworkState,
} from "expo-network";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Milliseconds between automatic checks while the app thinks it’s offline. */
const OFFLINE_POLL_INTERVAL_MS = 5_000;

export function isNetworkReachable(state: NetworkState): boolean {
  if (state.type === NetworkStateType.NONE) return false;
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

type NetworkStateManagerValue = {
  /** Raw snapshot from `expo-network` (empty object until the first read). */
  networkState: NetworkState;
  /** Whether the device likely has a usable route to the internet. */
  isOnline: boolean;
  /** User- or poll-driven refresh in flight. */
  isRefreshing: boolean;
  /** Re-query state (e.g. Retry in the offline banner). */
  refresh: () => Promise<void>;
};

const NetworkStateContext = createContext<NetworkStateManagerValue | null>(
  null,
);

export function NetworkStateProvider({ children }: { children: ReactNode }) {
  const [networkState, setNetworkState] = useState<NetworkState>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshSeq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++refreshSeq.current;
    setIsRefreshing(true);
    try {
      const next = await getNetworkStateAsync();
      if (refreshSeq.current === id) {
        setNetworkState(next);
      }
    } finally {
      if (refreshSeq.current === id) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const initial = await getNetworkStateAsync();
        if (!cancelled) setNetworkState(initial);
      } catch {
        if (!cancelled) setNetworkState({});
      }
    })();
    const sub = addNetworkStateListener((event) => {
      setNetworkState(event);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const isOnline = useMemo(
    () => isNetworkReachable(networkState),
    [networkState],
  );

  useEffect(() => {
    if (isOnline) return;
    const id = setInterval(() => {
      void refresh();
    }, OFFLINE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isOnline, refresh]);

  const value = useMemo(
    () => ({
      networkState,
      isOnline,
      isRefreshing,
      refresh,
    }),
    [networkState, isOnline, isRefreshing, refresh],
  );

  return (
    <NetworkStateContext.Provider value={value}>
      {children}
    </NetworkStateContext.Provider>
  );
}

export function useNetworkStateManager(): NetworkStateManagerValue {
  const ctx = useContext(NetworkStateContext);
  if (!ctx) {
    throw new Error(
      "useNetworkStateManager must be used within NetworkStateProvider",
    );
  }
  return ctx;
}
