import { createClient } from "genlayer-js";
import type { Eip1193Provider } from "@genlayer/transaction-kit";
import type { Address } from "viem";
import { MANDATE_CONTRACT_ADDRESS, studioNext } from "./network";

export type BrowserProvider = Eip1193Provider;
export type GenLayerClient = ReturnType<typeof createClient>;

let readClient: GenLayerClient | undefined;

export function getReadClient() {
  readClient ??= createClient({ chain: studioNext });
  return readClient;
}

export function getConnectedClient(provider: BrowserProvider, account: Address) {
  return createClient({ chain: studioNext, provider, account });
}

export function getInjectedProvider(): BrowserProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: BrowserProvider }).ethereum;
}

export { MANDATE_CONTRACT_ADDRESS };
