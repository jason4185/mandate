import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createTransactionKit, type TransactionKit } from "@genlayer/transaction-kit";
import type { Address } from "viem";
import { Button } from "@/components/ui/button";
import { getConnectedClient, getInjectedProvider, type BrowserProvider } from "./client";
import {
  STUDIO_NEXT_CHAIN_ID,
  STUDIO_NEXT_EXPLORER_URL,
  STUDIO_NEXT_RPC_URL,
  explorerAddressUrl,
  studioNext,
  studioNextChainIdHex,
} from "./network";
import { normalizeMandateError } from "./errors";

export type WalletStatus = "disconnected" | "connecting" | "connected" | "wrong-network";

export type WalletState = {
  address?: Address;
  chainId?: number;
  status: WalletStatus;
  error?: string;
  provider?: BrowserProvider;
  kit?: TransactionKit;
  connectedClient?: ReturnType<typeof getConnectedClient>;
  connect: () => Promise<void>;
  disconnect: () => Promise<boolean>;
  switchToStudioNext: () => Promise<void>;
};

const WalletContext = createContext<WalletState | undefined>(undefined);

function asAddress(value: unknown): Address | undefined {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? (value as Address)
    : undefined;
}

function asChainId(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value);
  const parsed = Number.parseInt(text, text.startsWith("0x") ? 16 : 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readWallet(provider: BrowserProvider) {
  const [accounts, chainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  return {
    address: Array.isArray(accounts) ? asAddress(accounts[0]) : undefined,
    chainId: asChainId(chainId),
  };
}

async function switchWallet(provider: BrowserProvider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: studioNextChainIdHex }],
    });
  } catch (reason) {
    if ((reason as { code?: number }).code !== 4902) throw reason;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: studioNextChainIdHex,
          chainName: "GenLayer Studio Next",
          rpcUrls: [STUDIO_NEXT_RPC_URL],
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          blockExplorerUrls: [STUDIO_NEXT_EXPLORER_URL],
        },
      ],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: studioNextChainIdHex }],
    });
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider>();
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string>();

  const refresh = useCallback(async (nextProvider: BrowserProvider) => {
    const result = await readWallet(nextProvider);
    setProvider(nextProvider);
    setAddress(result.address);
    setChainId(result.chainId);
    setStatus(
      result.address
        ? result.chainId === STUDIO_NEXT_CHAIN_ID
          ? "connected"
          : "wrong-network"
        : "disconnected",
    );
  }, []);

  useEffect(() => {
    const injected = getInjectedProvider();
    if (!injected) return;
    void refresh(injected).catch((reason) => setError(normalizeMandateError(reason)));
    const onAccountsChanged = () =>
      void refresh(injected).catch((reason) => setError(normalizeMandateError(reason)));
    const onChainChanged = () =>
      void refresh(injected).catch((reason) => setError(normalizeMandateError(reason)));
    const emitter = injected as BrowserProvider & {
      on?: (event: string, listener: () => void) => void;
      removeListener?: (event: string, listener: () => void) => void;
    };
    emitter.on?.("accountsChanged", onAccountsChanged);
    emitter.on?.("chainChanged", onChainChanged);
    return () => {
      emitter.removeListener?.("accountsChanged", onAccountsChanged);
      emitter.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    const injected = getInjectedProvider();
    if (!injected) {
      setError("Install an injected EIP-1193 wallet such as MetaMask to connect.");
      return;
    }
    setStatus("connecting");
    setError(undefined);
    try {
      await injected.request({ method: "eth_requestAccounts" });
      await refresh(injected);
    } catch (reason) {
      setStatus("disconnected");
      setError(normalizeMandateError(reason));
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    setAddress(undefined);
    setChainId(undefined);
    setStatus("disconnected");
    setError(undefined);
    return true;
  }, []);

  const switchToStudioNext = useCallback(async () => {
    const injected = provider ?? getInjectedProvider();
    if (!injected) return connect();
    setError(undefined);
    try {
      await switchWallet(injected);
      await refresh(injected);
    } catch (reason) {
      setError(normalizeMandateError(reason));
    }
  }, [connect, provider, refresh]);

  const kit = useMemo<TransactionKit | undefined>(
    () =>
      provider && address && status === "connected"
        ? createTransactionKit({ chain: studioNext, provider, account: address })
        : undefined,
    [provider, address, status],
  );
  const connectedClient = useMemo(
    () =>
      provider && address && status === "connected"
        ? getConnectedClient(provider, address)
        : undefined,
    [provider, address, status],
  );
  const value = useMemo<WalletState>(
    () => ({
      status,
      connect,
      disconnect,
      switchToStudioNext,
      ...(address ? { address } : {}),
      ...(chainId === undefined ? {} : { chainId }),
      ...(error ? { error } : {}),
      ...(provider ? { provider } : {}),
      ...(kit ? { kit } : {}),
      ...(connectedClient ? { connectedClient } : {}),
    }),
    [
      address,
      chainId,
      status,
      error,
      provider,
      kit,
      connectedClient,
      connect,
      disconnect,
      switchToStudioNext,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletControl() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);

  if (wallet.status === "connecting") {
    return (
      <Button variant="outline" size="sm" disabled>
        Connecting…
      </Button>
    );
  }
  if (wallet.status === "wrong-network") {
    return (
      <Button variant="outline" size="sm" onClick={() => void wallet.switchToStudioNext()}>
        Switch network
      </Button>
    );
  }
  if (wallet.status === "connected" && wallet.address) {
    return (
      <div className="wallet-control">
        <button
          type="button"
          className="account-chip wallet-chip"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          title={wallet.error ?? wallet.address}
        >
          <span className="online-dot" /> {shortAddress(wallet.address)}
        </button>
        {open && (
          <div className="wallet-popover">
            <span className="tiny-label">CONNECTED WALLET</span>
            <strong className="address">{wallet.address}</strong>
            <small>GenLayer Studio Next · {STUDIO_NEXT_CHAIN_ID}</small>
            <div className="wallet-popover-actions">
              <a href={explorerAddressUrl(wallet.address)} target="_blank" rel="noreferrer">
                Explorer
              </a>
              <Button variant="ghost" size="sm" onClick={() => void wallet.disconnect()}>
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={() => void wallet.connect()} title={wallet.error}>
      Connect wallet
    </Button>
  );
}
